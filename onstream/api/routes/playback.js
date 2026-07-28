const router = require("express").Router();
const mongoose = require("mongoose");
const verify = require("../verifyToken");
const User = require("../models/User");
const Movie = require("../models/Movie");
const Episode = require("../models/Episode");
const TVShow = require("../models/TVShow");
const TVProgress = require("../models/TVProgress");
const WatchSession = require("../models/WatchSession");
const { parseUserAgent } = require("../services/deviceInfo");
const { computeProgressUpdate } = require("../services/tvCatalog");
const {
  HEARTBEAT_INTERVAL_SEC,
  computePosition,
  genreKey,
  mergeQoe,
  reconcileSeconds,
} = require("../services/playbackMetrics");

/**
 * Playback telemetry ingestion — one endpoint for movies and episodes.
 *
 * The player owns a session id for each sitting and re-sends its running
 * totals every few seconds. Every field the client sends is absolute, never a
 * delta, so a retried or out-of-order heartbeat converges instead of
 * compounding: the session row is rewritten, and the only `$inc` in here is
 * derived server-side from the difference against what was already stored.
 *
 * Three things happen per heartbeat, in this order:
 *   1. the WatchSession row is upserted   — analytics
 *   2. the progress store is updated      — resume position
 *   3. user-level rollups are advanced    — cheap reads elsewhere
 *
 * Steps 2 and 3 are best-effort relative to step 1: telemetry is the thing we
 * cannot reconstruct later, so it is written first.
 */

router.use(verify);

function fail(res, code, err) {
  console.error(`${code}:`, err);
  return res.status(500).json({ error: code, message: err.message });
}

/**
 * Resolves what is being watched into the denormalised fields a session row
 * carries, or null when the content does not exist / is unpublished.
 */
async function resolveContent(contentType, contentId) {
  if (!mongoose.isValidObjectId(contentId)) return null;

  if (contentType === "movie") {
    const movie = await Movie.findById(contentId).select("title genre duration").lean();
    if (!movie) return null;
    return {
      contentType: "movie",
      contentId: movie._id,
      title: movie.title || "",
      genre: movie.genre || "",
      showId: null,
      seasonNumber: null,
      episodeNumber: null,
      // Movie.duration is free text ("2h 14m"), so there is no reliable
      // catalogue fallback; percentages rely on the player's own duration.
      catalogueDurationMin: 0,
    };
  }

  if (contentType === "episode") {
    const episode = await Episode.findById(contentId)
      .select("title showId seasonId seasonNumber episodeNumber published duration")
      .lean();
    if (!episode || !episode.published) return null;

    const show = await TVShow.findById(episode.showId).select("title genres").lean();
    return {
      contentType: "episode",
      contentId: episode._id,
      title: show?.title
        ? `${show.title} — S${episode.seasonNumber}E${episode.episodeNumber}`
        : episode.title || "",
      genre: (show?.genres && show.genres[0]) || "",
      showId: episode.showId,
      seasonId: episode.seasonId,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      catalogueDurationMin: episode.duration || 0,
    };
  }

  return null;
}

/**
 * Movie resume state, updated in place.
 *
 * `arrayFilters` rather than read-modify-write: two tabs playing the same
 * title would otherwise each save a whole User document built from a stale
 * read, and whichever landed last would erase the other's lists.
 *
 * Ensure-then-update, in two unconditional writes. The obvious shape —
 * "update, and push if nothing was modified" — cannot work here: UserSchema
 * carries `timestamps: true`, so Mongoose adds `updatedAt` to every update and
 * the modified count is 1 whether or not an array element actually matched.
 * The `$ne` guard makes the push a no-op when the entry is already there, and
 * makes it idempotent against a racing heartbeat, so neither write needs to
 * know what the other found.
 */
async function updateMovieProgress(userId, contentId, { percent, positionSec, completed, delta }) {
  const now = new Date();

  // Seeded at zero, because the $inc below runs on this same call and would
  // otherwise count the first heartbeat's seconds twice.
  await User.updateOne(
    { _id: userId, "currentlyWatching.movie": { $ne: contentId } },
    {
      $push: {
        currentlyWatching: {
          movie: contentId,
          lastWatchedAt: now,
          progress: 0,
          watchTime: 0,
        },
      },
    }
  );

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        "currentlyWatching.$[entry].progress": percent,
        "currentlyWatching.$[entry].lastWatchedAt": now,
      },
      $inc: { "currentlyWatching.$[entry].watchTime": delta },
    },
    { arrayFilters: [{ "entry.movie": contentId }] }
  );

  if (!completed) return;

  await User.updateOne(
    { _id: userId, "watchHistory.movie": { $ne: contentId } },
    {
      $push: {
        watchHistory: {
          movie: contentId,
          watchedAt: now,
          progress: percent,
          completed: true,
          watchTime: 0,
          dropOffPoint: positionSec,
          rewatchCount: 0,
        },
      },
    }
  );

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        "watchHistory.$[entry].watchedAt": now,
        "watchHistory.$[entry].progress": percent,
        "watchHistory.$[entry].completed": true,
        "watchHistory.$[entry].dropOffPoint": positionSec,
      },
      $inc: { "watchHistory.$[entry].watchTime": delta },
    },
    { arrayFilters: [{ "entry.movie": contentId }] }
  );

  // Finished titles belong in history, not in the Continue Watching row.
  await User.updateOne(
    { _id: userId },
    { $pull: { currentlyWatching: { movie: contentId } } }
  );
}

/** Episode resume state — the same upsert tvMe/progress performs. */
async function updateEpisodeProgress(userId, content, { positionSec, durationSec, completed }) {
  const existing = await TVProgress.findOne({ userId, episodeId: content.contentId })
    .select("_id completed")
    .lean();

  const update = computeProgressUpdate({
    positionSec,
    durationSec,
    catalogueDurationMin: content.catalogueDurationMin,
    completedFlag: completed,
    previouslyCompleted: existing?.completed,
  });

  await TVProgress.updateOne(
    { userId, episodeId: content.contentId },
    {
      $set: {
        showId: content.showId,
        seasonId: content.seasonId,
        seasonNumber: content.seasonNumber,
        episodeNumber: content.episodeNumber,
        ...update,
        watchedAt: new Date(),
      },
    },
    { upsert: true }
  );

  // One view per viewer per episode. Guarded on the progress row rather than
  // on the session so this agrees with tvMe/progress: whichever path a client
  // uses, the second one to arrive counts nothing.
  return !existing;
}

// --- ingestion --------------------------------------------------------------

router.post("/heartbeat", async (req, res) => {
  try {
    const {
      sessionId,
      contentType,
      contentId,
      positionSec,
      durationSec,
      secondsWatched,
      completed,
      ended,
      qoe,
    } = req.body || {};

    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 100) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "sessionId is required" });
    }

    const content = await resolveContent(contentType, contentId);
    if (!content) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Content not found" });
    }

    const userId = req.user.id;
    const now = new Date();
    const existing = await WatchSession.findOne({ userId, sessionId })
      .select("secondsWatched maxPositionSec startedAt completed qoe")
      .lean();

    const { seconds: nextSeconds, delta } = reconcileSeconds({
      priorSeconds: existing?.secondsWatched,
      reportedSeconds: secondsWatched,
      startedAt: existing?.startedAt || now,
      now,
    });

    const { position, duration, maxPosition, percent, completed: isComplete } = computePosition({
      positionSec,
      durationSec,
      catalogueDurationMin: content.catalogueDurationMin,
      storedMaxPositionSec: existing?.maxPositionSec,
      completedFlag: completed,
      previouslyCompleted: existing?.completed,
    });

    await WatchSession.updateOne(
      { userId, sessionId },
      {
        $set: {
          contentType: content.contentType,
          contentId: content.contentId,
          showId: content.showId,
          seasonNumber: content.seasonNumber,
          episodeNumber: content.episodeNumber,
          title: content.title,
          genre: content.genre,
          lastHeartbeatAt: now,
          endedAt: ended ? now : null,
          secondsWatched: nextSeconds,
          positionSec: position,
          maxPositionSec: maxPosition,
          durationSec: duration,
          percent,
          completed: isComplete,
          device: parseUserAgent(req.headers["user-agent"]),
          qoe: mergeQoe(existing?.qoe, qoe),
        },
        $setOnInsert: { startedAt: now },
      },
      { upsert: true }
    );

    let countedView = false;

    if (content.contentType === "episode") {
      const isFirstProgressRow = await updateEpisodeProgress(userId, content, {
        positionSec: position,
        durationSec: duration,
        completed: isComplete,
      });
      if (isFirstProgressRow) {
        await TVShow.updateOne({ _id: content.showId }, { $inc: { views: 1 } });
        countedView = true;
      }
    } else {
      await updateMovieProgress(userId, content.contentId, {
        percent,
        positionSec: position,
        completed: isComplete,
        delta,
      });
      // One view per sitting, counted when the session row is created — not
      // per heartbeat, and not per page load, so a reload mid-film does not
      // inflate the title's view count.
      if (!existing) {
        await Movie.updateOne({ _id: content.contentId }, { $inc: { views: 1 } });
        countedView = true;
      }
    }

    // Rollups on the User document. `delta` is server-derived, so replaying a
    // heartbeat adds nothing. The genre counter advances once per session
    // rather than once per ping, which is what makes it a play count.
    const rollup = { $inc: { totalWatchTime: delta } };
    const key = !existing && genreKey(content.genre);
    if (key) rollup.$inc[`genrePreferences.${key}`] = 1;
    await User.updateOne({ _id: userId }, rollup);

    res.json({
      ok: true,
      sessionId,
      secondsWatched: nextSeconds,
      percent,
      completed: isComplete,
      countedView,
      nextHeartbeatSec: HEARTBEAT_INTERVAL_SEC,
    });
  } catch (err) {
    return fail(res, "PLAYBACK_HEARTBEAT_FAILED", err);
  }
});

// --- resume -----------------------------------------------------------------

/**
 * Where to drop the viewer back in. The player asks before its first frame, so
 * this stays a single indexed read and never touches the session collection.
 */
router.get("/resume/:contentType/:contentId", async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    if (!mongoose.isValidObjectId(contentId)) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "contentId is not valid" });
    }

    if (contentType === "episode") {
      const row = await TVProgress.findOne({ userId: req.user.id, episodeId: contentId })
        .select("positionSec durationSec percent completed watchedAt")
        .lean();
      return res.json({
        positionSec: row?.positionSec || 0,
        durationSec: row?.durationSec || 0,
        percent: row?.percent || 0,
        completed: Boolean(row?.completed),
        watchedAt: row?.watchedAt || null,
      });
    }

    if (contentType === "movie") {
      const user = await User.findById(req.user.id).select("currentlyWatching").lean();
      const entry = (user?.currentlyWatching || []).find(
        (item) => String(item.movie) === String(contentId)
      );
      // Percent is all the movie progress store keeps, so the seconds have to
      // come back from the last session that measured a duration.
      const session = await WatchSession.findOne({
        userId: req.user.id,
        contentType: "movie",
        contentId,
      })
        .sort({ lastHeartbeatAt: -1 })
        .select("maxPositionSec durationSec percent completed lastHeartbeatAt")
        .lean();

      return res.json({
        positionSec: session?.maxPositionSec || 0,
        durationSec: session?.durationSec || 0,
        percent: entry?.progress || session?.percent || 0,
        completed: Boolean(session?.completed),
        watchedAt: entry?.lastWatchedAt || session?.lastHeartbeatAt || null,
      });
    }

    return res.status(400).json({ error: "BAD_REQUEST", message: "Unknown contentType" });
  } catch (err) {
    return fail(res, "PLAYBACK_RESUME_FAILED", err);
  }
});

module.exports = router;
