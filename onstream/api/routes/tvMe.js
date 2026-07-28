const router = require("express").Router();
const mongoose = require("mongoose");
const verify = require("../verifyToken");
const TVShow = require("../models/TVShow");
const Episode = require("../models/Episode");
const Season = require("../models/Season");
const TVProgress = require("../models/TVProgress");
const User = require("../models/User");
const {
  COMPLETE_PERCENT,
  computeNextUp,
  computeProgressUpdate,
  getContinueWatching,
  orderedEpisodes,
  progressByEpisode,
} = require("../services/tvCatalog");

// Viewer state for the TV catalogue: playback progress and My List.
//
// Mounted at /api/tv/me, ahead of the public router — same reason tvAdmin is:
// the public router ends in a "/:showId" wildcard that would otherwise match
// "/me" and try to cast it to an ObjectId. It also keeps the public router
// GET-only, which routes/tvRouting.test.js asserts.

router.use(verify);

function fail(res, code, err) {
  console.error(`${code}:`, err);
  return res.status(500).json({ error: code, message: err.message });
}

function validId(res, value, label) {
  if (!mongoose.isValidObjectId(value)) {
    res.status(400).json({ error: "BAD_REQUEST", message: `${label} is not a valid id` });
    return false;
  }
  return true;
}

// --- my list ----------------------------------------------------------------

router.get("/my-list", async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("myShows").lean();
    const ids = user?.myShows || [];
    if (!ids.length) return res.json([]);

    const shows = await TVShow.find({ _id: { $in: ids }, published: true }).lean();

    // Preserve the order the viewer added them in, newest first.
    const byId = new Map(shows.map((s) => [String(s._id), s]));
    const ordered = ids
      .map(String)
      .reverse()
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((show) => ({ ...show, inMyList: true }));

    res.json(ordered);
  } catch (err) {
    return fail(res, "TV_MYLIST_FAILED", err);
  }
});

router.post("/my-list", async (req, res) => {
  try {
    const { showId } = req.body || {};
    if (!validId(res, showId, "showId")) return;

    const show = await TVShow.findById(showId).select("_id published").lean();
    if (!show || !show.published) return res.status(404).json({ message: "Show not found" });

    // $addToSet keeps this idempotent — a double-tap on the card must not
    // produce two entries or a 409 the UI has to special-case.
    await User.updateOne({ _id: req.user.id }, { $addToSet: { myShows: show._id } });
    res.json({ ok: true, showId: String(show._id), inMyList: true });
  } catch (err) {
    return fail(res, "TV_MYLIST_ADD_FAILED", err);
  }
});

router.delete("/my-list/:showId", async (req, res) => {
  try {
    if (!validId(res, req.params.showId, "showId")) return;

    // Mongoose casts the string against the schema path; constructing an
    // ObjectId by hand here breaks on driver versions that require `new`.
    await User.updateOne({ _id: req.user.id }, { $pull: { myShows: req.params.showId } });
    res.json({ ok: true, showId: req.params.showId, inMyList: false });
  } catch (err) {
    return fail(res, "TV_MYLIST_REMOVE_FAILED", err);
  }
});

// --- continue watching ------------------------------------------------------

router.get("/continue-watching", async (req, res) => {
  try {
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 20));
    res.json(await getContinueWatching(req.user.id, limit));
  } catch (err) {
    return fail(res, "TV_CONTINUE_FAILED", err);
  }
});

// "Remove from Continue Watching" — drops the whole show's history so the row
// does not resurrect it from an older episode's row on the next render.
router.delete("/continue-watching/:showId", async (req, res) => {
  try {
    if (!validId(res, req.params.showId, "showId")) return;

    const result = await TVProgress.deleteMany({
      userId: req.user.id,
      showId: req.params.showId,
    });
    res.json({ ok: true, removed: result.deletedCount ?? result.n ?? 0 });
  } catch (err) {
    return fail(res, "TV_CONTINUE_REMOVE_FAILED", err);
  }
});

// --- progress ---------------------------------------------------------------

router.post("/progress", async (req, res) => {
  try {
    const { episodeId, positionSec, durationSec } = req.body || {};
    if (!validId(res, episodeId, "episodeId")) return;

    const episode = await Episode.findById(episodeId)
      .select("_id showId seasonId seasonNumber episodeNumber published duration")
      .lean();
    if (!episode || !episode.published) {
      return res.status(404).json({ message: "Episode not found" });
    }

    const existing = await TVProgress.findOne({
      userId: req.user.id,
      episodeId: episode._id,
    })
      .select("_id completed")
      .lean();

    const update = computeProgressUpdate({
      positionSec,
      durationSec,
      catalogueDurationMin: episode.duration,
      completedFlag: req.body?.completed,
      previouslyCompleted: existing?.completed,
    });

    await TVProgress.updateOne(
      { userId: req.user.id, episodeId: episode._id },
      {
        $set: {
          showId: episode.showId,
          seasonId: episode.seasonId,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          ...update,
          watchedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // One view per viewer per episode, counted the first time they start it.
    if (!existing) {
      await TVShow.updateOne({ _id: episode.showId }, { $inc: { views: 1 } });
    }

    res.json({ ok: true, percent: update.percent, completed: update.completed });
  } catch (err) {
    return fail(res, "TV_PROGRESS_FAILED", err);
  }
});

// Progress for one show: every episode the viewer has touched, plus next-up.
router.get("/progress/:showId", async (req, res) => {
  try {
    if (!validId(res, req.params.showId, "showId")) return;

    const [episodesByShow, progressMap] = await Promise.all([
      orderedEpisodes(req.params.showId),
      progressByEpisode(req.user.id, req.params.showId),
    ]);

    const episodes = episodesByShow.get(String(req.params.showId)) || [];
    const byEpisode = {};
    for (const [episodeId, row] of progressMap) {
      byEpisode[episodeId] = {
        positionSec: row.positionSec || 0,
        percent: row.percent || 0,
        completed: row.completed || (row.percent || 0) >= COMPLETE_PERCENT,
        watchedAt: row.watchedAt,
      };
    }

    res.json({ byEpisode, nextUp: computeNextUp(episodes, progressMap) });
  } catch (err) {
    return fail(res, "TV_PROGRESS_GET_FAILED", err);
  }
});

// Everything the viewer has watched, newest first — the "Watch history" view.
router.get("/history", async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));

    const rows = await TVProgress.find({ userId: req.user.id })
      .sort({ watchedAt: -1 })
      .limit(limit)
      .lean();
    if (!rows.length) return res.json([]);

    const [shows, episodes, seasons] = await Promise.all([
      TVShow.find({ _id: { $in: rows.map((r) => r.showId) } })
        .select("title poster backdrop genres releaseYear")
        .lean(),
      Episode.find({ _id: { $in: rows.map((r) => r.episodeId) } })
        .select("title seasonNumber episodeNumber stillPath duration")
        .lean(),
      Season.find({ _id: { $in: rows.map((r) => r.seasonId) } })
        .select("name seasonNumber")
        .lean(),
    ]);

    const showById = new Map(shows.map((s) => [String(s._id), s]));
    const episodeById = new Map(episodes.map((e) => [String(e._id), e]));
    const seasonById = new Map(seasons.map((s) => [String(s._id), s]));

    res.json(
      rows
        .map((row) => ({
          show: showById.get(String(row.showId)) || null,
          episode: episodeById.get(String(row.episodeId)) || null,
          season: seasonById.get(String(row.seasonId)) || null,
          positionSec: row.positionSec,
          percent: row.percent,
          completed: row.completed,
          watchedAt: row.watchedAt,
        }))
        .filter((entry) => entry.show && entry.episode)
    );
  } catch (err) {
    return fail(res, "TV_HISTORY_FAILED", err);
  }
});

module.exports = router;
