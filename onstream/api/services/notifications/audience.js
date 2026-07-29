const mongoose = require("mongoose");
const User = require("../../models/User");
const TVProgress = require("../../models/TVProgress");
const WatchSession = require("../../models/WatchSession");
const { normaliseGenres } = require("../recommendations");

/**
 * Who should be told about an event, and how strongly it applies to them.
 *
 * The two halves of this file answer very different questions, and conflating
 * them is how notification systems become spam.
 *
 *   **Declared interest** — `forShow` and `forSaved`. The viewer followed the
 *   show, saved the title, or is part-way through it. There is no scoring to do:
 *   they asked, and the only job is to find them cheaply.
 *
 *   **Inferred interest** — `forTaste`. Nobody asked. A new title is offered
 *   only to viewers whose watch history says it is the sort of thing they watch,
 *   with a score that the catalog's `minScore` floor can refuse. This is the
 *   difference between "new series on Nextream" reaching everyone and reaching
 *   the people who will open it.
 *
 * Every query here is bounded. A fan-out is the one place in the API where the
 * work is proportional to the size of the user base rather than to one request,
 * so the ceilings are explicit and the callers are told when they were hit
 * rather than being handed a quietly truncated list.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const LIMITS = {
  /** Recipients resolved for one catalogue event. */
  recipients: 5_000,
  /** Progress rows scanned to find a show's current viewers. */
  progressRows: 20_000,
  /** Session rows scanned to build taste vectors. */
  sessionGroups: 50_000,
  /** Users considered for a taste-driven send. */
  tasteUsers: 20_000,
};

/** How far back a session still counts as evidence of what someone watches. */
const TASTE_WINDOW_DAYS = 120;

/** Below this affinity, a title is not "the sort of thing you watch". */
const MIN_AFFINITY = 0.3;

/** Under this, a session is a mis-tap. Same threshold the home feed uses. */
const MIN_MEANINGFUL_SEC = 60;

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

// --- pure scoring ------------------------------------------------------------

/**
 * How well a title's genres match one viewer's taste vector, 0..1.
 *
 * Weighted toward the single best-matching genre rather than the average, for
 * the same reason the home feed is: someone who only watches horror should be
 * told about a horror-comedy, and an average would rank it below a title in
 * three genres they are lukewarm about.
 */
function affinity(genres, taste) {
  if (!genres?.length || !taste?.size) return 0;

  let best = 0;
  let total = 0;
  for (const genre of genres) {
    const weight = taste.get(genre) || 0;
    if (weight > best) best = weight;
    total += weight;
  }
  return clamp01(0.7 * best + 0.3 * (total / genres.length));
}

/**
 * Turns `{userId, genre, seconds}` rows into per-viewer taste vectors.
 *
 * Normalised so each viewer's strongest genre is 1. The absolute totals say
 * only how much someone watches, and comparing them across viewers would make
 * every notification go to the heaviest users.
 */
function tasteVectors(rows) {
  const byUser = new Map();

  for (const row of rows || []) {
    const userId = String(row.userId || row._id?.userId || "");
    const genre = normaliseGenres(row.genre || row._id?.genre)[0];
    if (!userId || !genre) continue;

    const seconds = Math.max(0, Number(row.seconds) || 0);
    if (!byUser.has(userId)) byUser.set(userId, new Map());
    const vector = byUser.get(userId);
    vector.set(genre, (vector.get(genre) || 0) + seconds);
  }

  for (const vector of byUser.values()) {
    let peak = 0;
    for (const weight of vector.values()) if (weight > peak) peak = weight;
    if (peak > 0) for (const [genre, weight] of vector) vector.set(genre, weight / peak);
  }

  return byUser;
}

/**
 * Taste from the legacy per-genre counter on the User document.
 *
 * The fallback for viewers whose watching predates session telemetry. Counts
 * titles rather than time, so it is a weaker signal — reflected by capping its
 * contribution below 1 so a session-backed match always outranks it.
 */
function tasteFromPreferences(genrePreferences) {
  const vector = new Map();
  const entries =
    genrePreferences instanceof Map
      ? [...genrePreferences.entries()]
      : Object.entries(genrePreferences || {});

  let peak = 0;
  for (const [genre, count] of entries) {
    const key = normaliseGenres(genre)[0];
    const value = Math.max(0, Number(count) || 0);
    if (!key || !value) continue;
    vector.set(key, value);
    if (value > peak) peak = value;
  }
  if (peak > 0) for (const [genre, value] of vector) vector.set(genre, (value / peak) * 0.8);

  return vector;
}

/** One line the viewer can read, explaining why this arrived. */
function tasteReason(genres, taste) {
  if (!genres?.length || !taste?.size) return "";
  let best = null;
  let bestWeight = 0;
  for (const genre of genres) {
    const weight = taste.get(genre) || 0;
    if (weight > bestWeight) {
      bestWeight = weight;
      best = genre;
    }
  }
  if (!best || bestWeight < MIN_AFFINITY) return "";
  return `Because you watch ${best.charAt(0).toUpperCase()}${best.slice(1)}`;
}

// --- declared interest -------------------------------------------------------

/**
 * Everyone who has told us they care about one show.
 *
 * Two sources, unioned: `User.myShows` is an explicit follow, and a TVProgress
 * row is someone part-way through it. The second matters more than it looks —
 * most viewers never press the follow button on a show they are actively
 * bingeing, and announcing a new episode only to followers would miss them.
 */
async function forShow(showId, { now = new Date() } = {}) {
  const oid = toObjectId(showId);
  if (!oid) return [];

  const [followers, progress] = await Promise.all([
    User.find({ myShows: oid }).select("_id").limit(LIMITS.recipients).lean(),
    TVProgress.find({ showId: oid })
      .select("userId watchedAt")
      .sort({ watchedAt: -1 })
      .limit(LIMITS.progressRows)
      .lean(),
  ]);

  const out = new Map();

  for (const user of followers) {
    out.set(String(user._id), { userId: String(user._id), score: 1, reason: "From your list" });
  }

  for (const row of progress) {
    const key = String(row.userId);
    if (out.has(key)) continue;
    // A viewer who stopped watching a year ago is not waiting for episode 9.
    // They still get the inbox row via a lower score if the type has no floor,
    // but the decay is what keeps a long-dormant audience from being paged.
    const ageDays = (now.getTime() - new Date(row.watchedAt || 0).getTime()) / DAY_MS;
    const score = Number.isFinite(ageDays) ? clamp01(1 - ageDays / 365) * 0.95 : 0.5;
    out.set(key, { userId: key, score, reason: "You're watching this" });
  }

  return [...out.values()].slice(0, LIMITS.recipients);
}

/**
 * Everyone with a specific movie saved.
 *
 * Three fields hold the same intention for historical reasons — `myList`,
 * `watchlist` and `favorites` — and a viewer who used any of them has asked to
 * be told when the title is watchable.
 */
async function forSavedMovie(movieId) {
  const oid = toObjectId(movieId);
  if (!oid) return [];

  const users = await User.find({
    $or: [{ myList: oid }, { watchlist: oid }, { favorites: oid }],
  })
    .select("_id")
    .limit(LIMITS.recipients)
    .lean();

  return users.map((user) => ({
    userId: String(user._id),
    score: 1,
    reason: "From your list",
  }));
}

// --- inferred interest -------------------------------------------------------

/**
 * Builds taste vectors for a bounded population, in two queries total.
 *
 * The obvious implementation — `buildTasteProfile` per candidate — is three
 * queries per viewer, so a thousand-viewer fan-out is three thousand queries
 * for one new title. One aggregation over the session collection produces the
 * same genre vectors for everybody at once, and the `User` read that follows
 * only exists to catch viewers whose history predates session telemetry.
 */
async function loadTaste({ now = new Date(), userIds = null } = {}) {
  const since = new Date(now.getTime() - TASTE_WINDOW_DAYS * DAY_MS);
  const scope = userIds?.length ? userIds.map(toObjectId).filter(Boolean) : null;

  const match = { startedAt: { $gte: since }, secondsWatched: { $gte: MIN_MEANINGFUL_SEC } };
  if (scope) match.userId = { $in: scope };

  const rows = await WatchSession.aggregate([
    { $match: match },
    {
      $group: {
        _id: { userId: "$userId", genre: "$genre" },
        seconds: { $sum: "$secondsWatched" },
      },
    },
    { $sort: { seconds: -1 } },
    { $limit: LIMITS.sessionGroups },
    { $project: { _id: 0, userId: "$_id.userId", genre: "$_id.genre", seconds: 1 } },
  ]);

  const vectors = tasteVectors(rows);

  // Fill in viewers the sessions did not cover, from the legacy counter.
  const query = scope ? { _id: { $in: scope } } : { updatedAt: { $gte: since } };
  const users = await User.find(query)
    .select("genrePreferences")
    .limit(LIMITS.tasteUsers)
    .lean();

  for (const user of users) {
    const key = String(user._id);
    if (vectors.has(key)) continue;
    const vector = tasteFromPreferences(user.genrePreferences);
    if (vector.size) vectors.set(key, vector);
  }

  return vectors;
}

/**
 * Viewers whose taste matches a new title.
 *
 * `exclude` carries the people already reached by a stronger, declared-interest
 * notification about the same thing — being told twice about one title, once
 * because you saved it and once because we guessed, is worse than either.
 */
async function forTaste(genres, { now = new Date(), exclude = [] } = {}) {
  const wanted = normaliseGenres(genres);
  if (!wanted.length) return [];

  const skip = new Set((exclude || []).map(String));
  const vectors = await loadTaste({ now });

  const out = [];
  for (const [userId, taste] of vectors) {
    if (skip.has(userId)) continue;
    const score = affinity(wanted, taste);
    if (score < MIN_AFFINITY) continue;
    out.push({ userId, score, reason: tasteReason(wanted, taste) });
  }

  // Best matches first, so a ceiling drops the weakest rather than an arbitrary
  // slice of the middle.
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, LIMITS.recipients);
}

// --- admin segments ----------------------------------------------------------

/**
 * The audience builder behind the admin composer.
 *
 * Its real job is the *count*. An admin about to interrupt some number of people
 * should be told which number before they press send, and every segment here is
 * therefore resolvable cheaply enough to run on every keystroke of the form.
 */
async function resolveSegment(segment = {}, { now = new Date(), limit = LIMITS.recipients } = {}) {
  const query = {};
  const notes = [];

  const activeWithinDays = Number(segment.activeWithinDays);
  if (Number.isFinite(activeWithinDays) && activeWithinDays > 0) {
    query.updatedAt = { $gte: new Date(now.getTime() - activeWithinDays * DAY_MS) };
    notes.push(`active in the last ${activeWithinDays} days`);
  }

  const inactiveForDays = Number(segment.inactiveForDays);
  if (Number.isFinite(inactiveForDays) && inactiveForDays > 0) {
    // Overwrites rather than combines: "active within 7" and "inactive for 30"
    // together describe nobody, and silently returning zero reads as a bug.
    query.updatedAt = { $lt: new Date(now.getTime() - inactiveForDays * DAY_MS) };
    notes.push(`inactive for ${inactiveForDays}+ days`);
  }

  if (segment.plan) {
    query["subscriptionStatus.plan"] = String(segment.plan);
    notes.push(`on the ${segment.plan} plan`);
  }

  if (typeof segment.isAdmin === "boolean") {
    query.isAdmin = segment.isAdmin;
    notes.push(segment.isAdmin ? "admins only" : "excluding admins");
  }

  if (segment.hasPush === true) {
    query["deviceTokens.0"] = { $exists: true };
    notes.push("with a registered device");
  } else if (segment.hasPush === false) {
    query["deviceTokens.0"] = { $exists: false };
    notes.push("with no registered device");
  }

  const genres = normaliseGenres(segment.genres);

  // The genre filter needs taste vectors, so it cannot be a Mongo predicate.
  // Everything else narrows first, which keeps the vector build scoped.
  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .select("_id")
    .limit(genres.length ? LIMITS.tasteUsers : limit)
    .lean();

  let recipients = users.map((user) => ({ userId: String(user._id), score: 1, reason: "" }));

  if (genres.length) {
    const vectors = await loadTaste({ now, userIds: recipients.map((row) => row.userId) });
    recipients = recipients
      .map((row) => {
        const score = affinity(genres, vectors.get(row.userId));
        return { ...row, score, reason: tasteReason(genres, vectors.get(row.userId)) };
      })
      .filter((row) => row.score >= MIN_AFFINITY)
      .sort((a, b) => b.score - a.score);
    notes.push(`who watch ${genres.join(" or ")}`);
  }

  const truncated = recipients.length > limit;
  return {
    recipients: recipients.slice(0, limit),
    /** Matching the Mongo predicate, before the taste filter narrowed it. */
    total: genres.length ? recipients.length : total,
    truncated: truncated || (!genres.length && total > limit),
    description: notes.length ? notes.join(", ") : "everyone",
  };
}

module.exports = {
  LIMITS,
  MIN_AFFINITY,
  TASTE_WINDOW_DAYS,
  affinity,
  forSavedMovie,
  forShow,
  forTaste,
  loadTaste,
  resolveSegment,
  tasteFromPreferences,
  tasteReason,
  tasteVectors,
};
