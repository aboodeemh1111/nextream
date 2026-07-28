const TVShow = require("../models/TVShow");
const Season = require("../models/Season");
const Episode = require("../models/Episode");
const TVProgress = require("../models/TVProgress");

/**
 * Read helpers shared by the public TV router and the authenticated /tv/me one.
 *
 * Everything here batches across shows on purpose. The obvious shape for
 * "continue watching" is a loop that fetches each show's episodes in turn, and
 * that is an N+1 against Episode on a row the home page renders on every visit.
 */

// Enough to render an episode card without shipping videoSources/subtitles,
// which are large and only the player needs them.
const EPISODE_CARD_FIELDS =
  "showId seasonId seasonNumber episodeNumber title overview airDate duration stillPath createdAt";

// "Published" for an episode means the season is published too — a draft season
// must not leak its episodes just because the episodes themselves were flagged.
async function orderedEpisodes(showIds, fields = EPISODE_CARD_FIELDS) {
  const ids = (Array.isArray(showIds) ? showIds : [showIds]).filter(Boolean);
  const byShow = new Map(ids.map((id) => [String(id), []]));
  if (!ids.length) return byShow;

  const seasons = await Season.find({ showId: { $in: ids }, published: true })
    .select("_id")
    .lean();
  if (!seasons.length) return byShow;

  const episodes = await Episode.find({
    seasonId: { $in: seasons.map((s) => s._id) },
    published: true,
  })
    .select(fields)
    .sort({ seasonNumber: 1, episodeNumber: 1 })
    .lean();

  for (const episode of episodes) {
    const key = String(episode.showId);
    if (!byShow.has(key)) byShow.set(key, []);
    byShow.get(key).push(episode);
  }
  return byShow;
}

// Past this point an episode counts as watched, so "next up" advances instead of
// offering to resume the last 40 seconds of credits.
const COMPLETE_PERCENT = 95;

function isComplete(progress) {
  if (!progress) return false;
  return progress.completed || (progress.percent || 0) >= COMPLETE_PERCENT;
}

/**
 * Where the viewer should land on this show.
 *
 * `episodes` must be ordered by (seasonNumber, episodeNumber); `progressByEpisode`
 * is a Map keyed by episode id string.
 *
 * reason: start | resume | next | rewatch — the UI uses it for the button label
 * and to decide whether the show still belongs in Continue Watching.
 */
function computeNextUp(episodes, progressByEpisode) {
  if (!episodes || !episodes.length) return null;

  let latest = null;
  for (const episode of episodes) {
    const progress = progressByEpisode.get(String(episode._id));
    if (!progress) continue;
    if (!latest || new Date(progress.watchedAt) > new Date(latest.progress.watchedAt)) {
      latest = { episode, progress };
    }
  }

  if (!latest) {
    return { episode: episodes[0], resumeSec: 0, percent: 0, reason: "start" };
  }

  if (!isComplete(latest.progress)) {
    return {
      episode: latest.episode,
      resumeSec: latest.progress.positionSec || 0,
      percent: latest.progress.percent || 0,
      reason: "resume",
    };
  }

  const index = episodes.findIndex(
    (e) => String(e._id) === String(latest.episode._id)
  );
  const next = episodes[index + 1];
  if (next) {
    return { episode: next, resumeSec: 0, percent: 0, reason: "next" };
  }

  // Caught up on everything published.
  return { episode: episodes[0], resumeSec: 0, percent: 0, reason: "rewatch" };
}

/**
 * Turns a player ping into the fields a progress row should store.
 *
 * Pure so the rules are testable without a database — they are subtle enough to
 * be worth pinning: the duration fallback, and the fact that `completed` only
 * ever latches on.
 */
function computeProgressUpdate({
  positionSec,
  durationSec,
  catalogueDurationMin,
  completedFlag,
  previouslyCompleted,
}) {
  const position = Math.max(0, Number(positionSec) || 0);
  const reported = Math.max(0, Number(durationSec) || 0);

  // Trust the player's duration when it has one; fall back to the catalogue
  // value (authored in minutes) so a ping that arrives before loadedmetadata
  // still yields a usable percentage instead of 0.
  const duration = reported || (Number(catalogueDurationMin) || 0) * 60;
  const percent = duration ? Math.min(100, Math.round((position / duration) * 100)) : 0;

  const reachedEnd = duration > 0 && percent >= COMPLETE_PERCENT;
  // Never un-complete an episode: scrubbing back to rewatch the opening would
  // otherwise drop it out of "watched" and rewind next-up.
  const completed = completedFlag === true || reachedEnd || Boolean(previouslyCompleted);

  return { positionSec: position, durationSec: duration, percent, completed };
}

/** Map of episodeId -> progress row, for one or many shows. */
async function progressByEpisode(userId, showIds) {
  const map = new Map();
  if (!userId) return map;
  const ids = (Array.isArray(showIds) ? showIds : [showIds]).filter(Boolean);
  if (!ids.length) return map;

  const rows = await TVProgress.find({ userId, showId: { $in: ids } }).lean();
  for (const row of rows) map.set(String(row.episodeId), row);
  return map;
}

/** Attaches the viewer's position to each episode, without leaking other users' rows. */
function withProgress(episodes, progressMap) {
  return episodes.map((episode) => {
    const progress = progressMap.get(String(episode._id));
    return {
      ...episode,
      progress: progress
        ? {
            positionSec: progress.positionSec || 0,
            percent: progress.percent || 0,
            completed: isComplete(progress),
            watchedAt: progress.watchedAt,
          }
        : null,
    };
  });
}

/**
 * Shows the viewer has started but not finished, newest activity first.
 *
 * The 400-row cap bounds the read; it covers far more distinct shows than the
 * row will ever display, since only the newest row per show survives the dedupe.
 */
async function getContinueWatching(userId, limit = 20) {
  if (!userId) return [];

  const recent = await TVProgress.find({ userId })
    .sort({ watchedAt: -1 })
    .limit(400)
    .lean();
  if (!recent.length) return [];

  const orderedShowIds = [];
  const seen = new Set();
  const progressByShow = new Map();

  for (const row of recent) {
    const key = String(row.showId);
    if (!seen.has(key)) {
      seen.add(key);
      orderedShowIds.push(row.showId);
      progressByShow.set(key, new Map());
    }
    progressByShow.get(key).set(String(row.episodeId), row);
  }

  const [shows, episodesByShow] = await Promise.all([
    TVShow.find({ _id: { $in: orderedShowIds }, published: true }).lean(),
    orderedEpisodes(orderedShowIds),
  ]);
  const showById = new Map(shows.map((s) => [String(s._id), s]));

  const out = [];
  for (const showId of orderedShowIds) {
    const key = String(showId);
    const show = showById.get(key);
    if (!show) continue; // unpublished or deleted since the last watch

    const nextUp = computeNextUp(
      episodesByShow.get(key) || [],
      progressByShow.get(key)
    );
    // A finished show drops out of the row rather than sitting there forever.
    if (!nextUp || nextUp.reason === "rewatch") continue;

    out.push({
      show,
      episode: nextUp.episode,
      resumeSec: nextUp.resumeSec,
      percent: nextUp.percent,
      reason: nextUp.reason,
      lastWatchedAt: recent.find((r) => String(r.showId) === key)?.watchedAt,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Catalogue neighbours, ranked by how many genres they share.
 *
 * Mongo can filter on $in but cannot order by overlap size without an
 * aggregation stage per genre, so the ranking happens here over a bounded set.
 */
async function similarShows(show, limit = 12) {
  const genres = (show.genres || []).filter(Boolean);
  if (!genres.length) {
    return TVShow.find({ published: true, _id: { $ne: show._id } })
      .sort({ views: -1, rating: -1 })
      .limit(limit)
      .lean();
  }

  const candidates = await TVShow.find({
    published: true,
    _id: { $ne: show._id },
    genres: { $in: genres },
  })
    .sort({ views: -1, rating: -1 })
    .limit(limit * 4)
    .lean();

  const wanted = new Set(genres.map((g) => String(g).toLowerCase()));
  return candidates
    .map((candidate) => ({
      candidate,
      overlap: (candidate.genres || []).filter((g) =>
        wanted.has(String(g).toLowerCase())
      ).length,
    }))
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        (b.candidate.views || 0) - (a.candidate.views || 0)
    )
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

/** Case-insensitive exact match, so admin's "Comedy" answers a "comedy" filter. */
function genreFilter(genre) {
  const escaped = String(genre).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { $elemMatch: { $regex: `^${escaped}$`, $options: "i" } };
}

module.exports = {
  COMPLETE_PERCENT,
  EPISODE_CARD_FIELDS,
  computeNextUp,
  computeProgressUpdate,
  genreFilter,
  getContinueWatching,
  isComplete,
  orderedEpisodes,
  progressByEpisode,
  similarShows,
  withProgress,
};
