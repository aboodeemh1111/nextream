const crypto = require("crypto");
const mongoose = require("mongoose");
const Episode = require("../../models/Episode");
const Movie = require("../../models/Movie");
const Season = require("../../models/Season");
const TVShow = require("../../models/TVShow");
const Comment = require("../../models/Comment");
const Review = require("../../models/Review");
const User = require("../../models/User");
const { parseUserAgent, describeDevice } = require("../deviceInfo");
const audience = require("./audience");
const { dispatch } = require("./dispatch");

/**
 * What the rest of the API calls when something happens.
 *
 * Every function here is safe to call without awaiting, and none of them can
 * fail the request that triggered them. That is the entire reason this layer
 * exists rather than routes calling `dispatch` directly: publishing an episode
 * must not 500 because the notification pipeline hit a Mongo timeout, and a
 * route author should not have to remember that.
 *
 * The other job is coalescing. An admin publishing a ten-episode season produces
 * ten events in a few seconds, and the naive result is ten pushes — the single
 * most reliable way to get notifications switched off. `episodePublished`
 * therefore buffers briefly and decides afterwards whether what happened was
 * "an episode arrived" or "a season dropped", which is the distinction a viewer
 * actually experiences.
 */

/**
 * How long to wait before deciding what a burst of episode publishes was.
 *
 * Long enough to absorb a bulk create and an admin clicking Publish down a list;
 * short enough that a genuinely single episode is announced while the admin is
 * still on the page to see it. Deliberately in-process and deliberately not
 * durable — a notification lost to a restart mid-window is a non-event, and the
 * alternative is a queue this deployment has no need for.
 */
const COALESCE_MS = Number(process.env.NOTIFY_COALESCE_MS) || 60_000;

/** At or above this many episodes of one season, it is a season drop. */
const SEASON_DROP_THRESHOLD = 3;

/** Suppresses the whole feature without touching the routes that call it. */
function enabled() {
  return process.env.NOTIFICATIONS_DISABLED !== "true";
}

/**
 * Runs a dispatch detached from its caller.
 *
 * The `void` is the point: the caller gets control back immediately and no
 * unhandled rejection can escape. Errors are logged with the event name so a
 * silently missing notification is diagnosable from the API log alone.
 */
function emit(name, work) {
  if (!enabled()) return;
  Promise.resolve()
    .then(work)
    .catch((err) => console.error(`NOTIFY_${name}_FAILED:`, err?.message || err));
}

function objectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

// --- episode & season publishing --------------------------------------------

/** Episode ids waiting for the coalescing window to close. */
const pendingEpisodes = new Set();
let coalesceTimer = null;

/**
 * Decides what a buffered burst of episode publishes should say, and says it.
 *
 * Grouped by season rather than by show: two seasons of the same show landing at
 * once are two announcements, because "Season 3 is here" is the news and "12 new
 * episodes across two seasons" is not something anyone acts on.
 */
async function flushEpisodes() {
  const ids = [...pendingEpisodes];
  pendingEpisodes.clear();
  coalesceTimer = null;
  if (!ids.length) return;

  const episodes = await Episode.find({ _id: { $in: ids }, published: true })
    .select("_id showId seasonId seasonNumber episodeNumber title stillPath overview")
    .lean();
  if (!episodes.length) return;

  const showIds = [...new Set(episodes.map((episode) => String(episode.showId)))];
  const shows = await TVShow.find({ _id: { $in: showIds }, published: true })
    .select("_id title poster backdrop genres releaseYear")
    .lean();
  const showById = new Map(shows.map((show) => [String(show._id), show]));

  // Group by season. An unpublished show has no audience to notify: nobody can
  // have followed or watched something that was never visible.
  const bySeason = new Map();
  for (const episode of episodes) {
    if (!showById.has(String(episode.showId))) continue;
    const key = `${episode.showId}:${episode.seasonId}`;
    if (!bySeason.has(key)) bySeason.set(key, []);
    bySeason.get(key).push(episode);
  }

  for (const group of bySeason.values()) {
    const show = showById.get(String(group[0].showId));
    // The audience is the same for either shape of announcement, so it is
    // resolved once per season group rather than once per episode.
    const recipients = await audience.forShow(show._id);
    if (!recipients.length) continue;

    if (group.length >= SEASON_DROP_THRESHOLD) {
      const season = await Season.findById(group[0].seasonId).select("_id seasonNumber backdrop").lean();
      await dispatch("season.published", recipients, {
        show,
        season: season || { _id: group[0].seasonId, seasonNumber: group[0].seasonNumber },
        seasonNumber: group[0].seasonNumber,
        episodeCount: group.length,
      });
      continue;
    }

    // Oldest first, so a viewer reading top-down in the inbox sees them in the
    // order they would watch them.
    group.sort((a, b) => a.episodeNumber - b.episodeNumber);
    for (const episode of group) {
      await dispatch("episode.published", recipients, { show, episode });
    }
  }
}

/**
 * An episode became visible.
 *
 * Called from every route that can flip `published` — create, bulk create and
 * patch — and it is the route's job only to say which episode, not to work out
 * whether it is newsworthy.
 */
function episodePublished(episodeId) {
  if (!enabled()) return;
  const id = objectId(episodeId);
  if (!id) return;

  pendingEpisodes.add(String(id));
  if (coalesceTimer) return;

  coalesceTimer = setTimeout(() => {
    emit("EPISODE_PUBLISHED", flushEpisodes);
  }, COALESCE_MS);
  // Never hold the process open for a pending announcement.
  if (typeof coalesceTimer.unref === "function") coalesceTimer.unref();
}

/** Flushes the buffer now. Used by the admin "send test" path and by tests. */
function flushNow() {
  if (coalesceTimer) {
    clearTimeout(coalesceTimer);
    coalesceTimer = null;
  }
  return flushEpisodes();
}

/**
 * A show became visible for the first time.
 *
 * Taste-driven, so the audience is everyone whose history says this is their
 * sort of thing — and the catalog's score floor is what stops it being everyone.
 */
function showPublished(showId) {
  emit("SHOW_PUBLISHED", async () => {
    const show = await TVShow.findById(showId)
      .select("_id title overview poster backdrop genres releaseYear published")
      .lean();
    if (!show?.published) return;

    // Followers of an unreleased show — added from a preview page — asked for it
    // by name, so they are notified regardless of taste and excluded from the
    // taste pass so they are not told twice.
    const followers = await audience.forShow(show._id);
    const matched = await audience.forTaste(show.genres, {
      exclude: followers.map((row) => row.userId),
    });

    if (followers.length) {
      await dispatch("list.available", followers, {
        entityTitle: show.title,
        entityKind: "show",
        entityId: String(show._id),
        deepLink: `/series/${show._id}`,
        image: show.backdrop || show.poster,
      });
    }
    if (matched.length) await dispatch("show.published", matched, { show });
  });
}

/** A movie was added to the catalogue. */
function moviePublished(movieId) {
  emit("MOVIE_PUBLISHED", async () => {
    const movie = await Movie.findById(movieId)
      .select("_id title desc img imgSm genre year video")
      .lean();
    if (!movie) return;

    const saved = await audience.forSavedMovie(movie._id);
    const matched = await audience.forTaste(movie.genre, {
      exclude: saved.map((row) => row.userId),
    });

    if (saved.length) {
      await dispatch("list.available", saved, {
        entityTitle: movie.title,
        entityKind: "movie",
        entityId: String(movie._id),
        deepLink: `/details/${movie._id}`,
        image: movie.img || movie.imgSm,
      });
    }
    if (matched.length) await dispatch("movie.published", matched, { movie });
  });
}

// --- playback ---------------------------------------------------------------

/**
 * A viewer finished an episode and there is another one waiting.
 *
 * In-app only by design (see the catalog): the value is that the inbox points at
 * the right episode when they come back, not that their phone buzzes while they
 * are watching.
 */
function nextEpisodeReady(userId, showId, nextEpisodeId) {
  emit("NEXT_EPISODE_READY", async () => {
    const [show, episode] = await Promise.all([
      TVShow.findById(showId).select("_id title poster backdrop published").lean(),
      Episode.findById(nextEpisodeId).select("_id title seasonNumber episodeNumber stillPath published").lean(),
    ]);
    if (!show?.published || !episode?.published) return;

    await dispatch("next_episode.ready", [{ userId, score: 1, reason: "" }], { show, episode });
  });
}

// --- social ------------------------------------------------------------------

/**
 * Somebody commented on a title.
 *
 * The recipients are the other people already in that conversation — anyone who
 * has commented or reviewed the same title — minus the author, who does not need
 * to be told what they just typed. Bounded, because a popular title's thread is
 * not a mailing list.
 */
function commentPosted(comment) {
  emit("COMMENT_POSTED", async () => {
    if (!comment?.movieId || !comment?.userId) return;

    const [comments, reviews, movie, actor] = await Promise.all([
      Comment.find({ movieId: String(comment.movieId), userId: { $ne: String(comment.userId) } })
        .select("userId")
        .limit(200)
        .lean(),
      Review.find({ movieId: String(comment.movieId), userId: { $ne: String(comment.userId) } })
        .select("userId")
        .limit(200)
        .lean(),
      Movie.findById(comment.movieId).select("title img").lean(),
      User.findById(comment.userId).select("username").lean(),
    ]);

    const recipients = [...new Set([...comments, ...reviews].map((row) => String(row.userId)))]
      .filter((userId) => mongoose.isValidObjectId(userId))
      .map((userId) => ({ userId, score: 1, reason: "You're in this conversation" }));
    if (!recipients.length) return;

    await dispatch("comment.reply", recipients, {
      actorName: actor?.username || comment.username || "Someone",
      actorId: String(comment.userId),
      commentId: String(comment._id),
      entityId: String(comment.movieId),
      entityTitle: movie?.title || comment.title || "",
      excerpt: comment.comment || "",
      deepLink: `/details/${comment.movieId}`,
    });
  });
}

/** Somebody liked a review. Goes to its author, and only if it is not their own. */
function reviewLiked(review, actorId) {
  emit("REVIEW_LIKED", async () => {
    if (!review?.userId || !actorId) return;
    if (String(review.userId) === String(actorId)) return;
    if (!mongoose.isValidObjectId(String(review.userId))) return;

    const [movie, actor] = await Promise.all([
      Movie.findById(review.movieId).select("title").lean(),
      User.findById(actorId).select("username").lean(),
    ]);

    await dispatch(
      "review.liked",
      [{ userId: String(review.userId), score: 1, reason: "" }],
      {
        actorName: actor?.username || "Someone",
        actorId: String(actorId),
        reviewId: String(review._id),
        entityId: String(review.movieId),
        entityTitle: movie?.title || review.title || "",
        deepLink: `/details/${review.movieId}`,
      }
    );
  });
}

// --- account -----------------------------------------------------------------

/**
 * A stable identity for a device class.
 *
 * Hashed from the *bucketed* device rather than the raw user-agent, so a browser
 * silently updating its version number is the same laptop and not a break-in.
 */
function deviceFingerprint(device) {
  return crypto
    .createHash("sha1")
    .update(`${device?.type || ""}|${device?.os || ""}|${device?.browser || ""}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * A sign-in, and an alert if the device is one this account has not used before.
 *
 * Three cases, and the second is the one worth being careful about:
 *
 *   - Known device — recorded, nothing said. Alerting on every login is how a
 *     security notification becomes the one people mute.
 *   - The account's *first* device — recorded, nothing said. There is nothing to
 *     compare it against, and opening a new account with a security warning
 *     reads as something having already gone wrong.
 *   - A new device on an established account — the alert this exists for.
 *
 * The fingerprint is recorded before the decision either way, so the alert fires
 * at most once per device however many times they sign in from it.
 */
function signedIn(user, userAgent) {
  emit("SIGNED_IN", async () => {
    if (!user?._id) return;

    const device = parseUserAgent(userAgent);
    const label = describeDevice(device) || "a new device";
    const fingerprint = deviceFingerprint(device);
    const now = new Date();

    const record = await User.findById(user._id).select("knownDevices").lean();
    if (!record) return;

    const known = record.knownDevices || [];
    const seen = known.some((entry) => entry.fingerprint === fingerprint);

    // Recorded first, and unconditionally: an alert that fires because the write
    // that would have suppressed the next one failed is worse than no alert.
    if (seen) {
      await User.updateOne(
        { _id: user._id, "knownDevices.fingerprint": fingerprint },
        { $set: { "knownDevices.$.lastSeenAt": now, "knownDevices.$.label": label } }
      );
      return;
    }

    await User.updateOne(
      { _id: user._id, "knownDevices.fingerprint": { $ne: fingerprint } },
      {
        // Bounded: a viewer who signs in from many machines should not grow an
        // unbounded array on their own document.
        $push: {
          knownDevices: {
            $each: [{ fingerprint, label, firstSeenAt: now, lastSeenAt: now }],
            $slice: -20,
          },
        },
      }
    );

    if (!known.length) return; // first device on the account: not news

    await dispatch(
      "account.security",
      [{ userId: String(user._id), score: 1, reason: "" }],
      { userId: String(user._id), device: label, fingerprint }
    );
  });
}

// --- admin -------------------------------------------------------------------

/**
 * An admin broadcast. Awaited, unlike everything else here, because the admin is
 * waiting on a result and "how many did that reach" is the answer they need.
 */
function announce({ title, body, deepLink, image, recipients, campaignId, createdBy }) {
  return dispatch("system.announcement", recipients, {
    title,
    body,
    deepLink,
    image,
    campaignId,
    createdBy,
  });
}

module.exports = {
  COALESCE_MS,
  SEASON_DROP_THRESHOLD,
  announce,
  commentPosted,
  deviceFingerprint,
  emit,
  enabled,
  episodePublished,
  flushNow,
  moviePublished,
  nextEpisodeReady,
  reviewLiked,
  showPublished,
  signedIn,
};
