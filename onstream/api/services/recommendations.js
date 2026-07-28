const mongoose = require("mongoose");
const Movie = require("../models/Movie");
const TVShow = require("../models/TVShow");
const Episode = require("../models/Episode");
const TVProgress = require("../models/TVProgress");
const User = require("../models/User");
const WatchSession = require("../models/WatchSession");
const { computeNextUp, getContinueWatching, orderedEpisodes } = require("./tvCatalog");

/**
 * The home feed's recommendation engine.
 *
 * The home page used to render whatever curated `List` documents happened to
 * exist, in whatever order Mongo returned them, and only ever from the Movie
 * collection — so the TVShow catalogue the admin app manages never appeared,
 * and "recommended" meant "the newest row we found". This replaces both halves:
 * one catalogue spanning movies *and* shows, ranked per viewer.
 *
 * The shape of the thing:
 *
 *   1. buildTasteProfile  — every signal we hold about one viewer, collapsed
 *                           into a genre vector plus the set of titles they
 *                           have already seen.
 *   2. coWatchScores      — item-to-item collaborative filtering: what did
 *                           viewers with the same recent titles watch next.
 *   3. scoreItem          — a linear blend of affinity, co-watch, quality,
 *                           popularity and freshness, each normalised to 0..1
 *                           so the weights below are directly comparable.
 *   4. diversify / mixKinds — re-ranking, so a row is not ten thrillers, and
 *                           a "for you" row is never all movies or all shows.
 *
 * Everything above `--- data access ---` is pure, and covered by
 * recommendations.test.js. The ranking rules are the part worth pinning; the
 * queries are the part worth keeping bounded.
 */

// --- tuning ------------------------------------------------------------------

/**
 * Score weights. Deliberately in the same unit (each term is 0..1) so the
 * relative importance is readable off the numbers rather than hidden in the
 * scale of whatever field feeds them.
 */
const WEIGHTS = {
  affinity: 3.2, // genre overlap with what this viewer actually watches
  collab: 2.6, // "viewers like you also watched"
  quality: 1.4, // rating, shrunk toward the mean by vote count
  popularity: 1.0, // catalogue-wide views
  freshness: 0.8, // recently added
  intent: 1.6, // saved to My List / watchlist but never started
};

/** Already finished. Still allowed in "Watch It Again", excluded elsewhere. */
const SEEN_PENALTY = 2.4;

/** How fast a watch stops counting toward taste. Half its weight per 45 days. */
const TASTE_HALF_LIFE_DAYS = 45;
/** How fast a title stops counting as "new". */
const FRESHNESS_HALF_LIFE_DAYS = 60;
/** How far back "New on Nextream" reaches before the row is dropped entirely. */
const NEW_RELEASE_WINDOW_DAYS = 120;
/** Titles that have actually been watched, before a Top 10 means anything. */
const MIN_TRENDING_TITLES = 5;

/** Bayesian prior strength for ratings: how many votes before R beats the mean. */
const RATING_PRIOR_VOTES = 6;
/** Editorial (admin-authored) show ratings carry this much implied confidence. */
const EDITORIAL_RATING_VOTES = 8;

/** Under this, a session is a mis-tap and says nothing about taste. */
const MIN_MEANINGFUL_SEC = 60;

/** Query ceilings. Every read below is bounded by one of these. */
const LIMITS = {
  candidateMovies: 400,
  candidateShows: 400,
  sessions: 300,
  peerRows: 600,
  peers: 200,
  coWatchRows: 3000,
  peerUsers: 200,
};

/** Weight each kind of signal contributes before recency decay is applied. */
const SIGNAL_WEIGHTS = {
  session: 6, // measured watch time — the only signal we did not have to guess
  favorite: 5,
  currentlyWatching: 4,
  tvProgress: 3.5,
  history: 3,
  myList: 2,
  watchlist: 1.5,
  genrePreference: 1, // legacy counter on the User document
};

// --- pure helpers ------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Exponential decay, expressed as a half-life so the constant is meaningful. */
function recencyDecay(date, halfLifeDays = TASTE_HALF_LIFE_DAYS, now = Date.now()) {
  if (!date) return 0.35; // undated signal: real, but not evidence of *when*
  const stamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (!Number.isFinite(stamp)) return 0.35;
  const ageDays = Math.max(0, (now - stamp) / DAY_MS);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Rating shrunk toward the catalogue mean by how many votes back it.
 *
 * Without this a single 5-star review outranks a title with a hundred 4.5s,
 * which is exactly the failure mode a "top rated" row cannot afford.
 *
 * `rating` and `mean` must already be on the same 0..1 scale.
 */
function bayesianRating(rating, votes, mean = 0.5, prior = RATING_PRIOR_VOTES) {
  const r = Number(rating);
  const v = Math.max(0, Number(votes) || 0);
  if (!Number.isFinite(r) || r <= 0 || v <= 0) return mean;
  return (v * clamp01(r) + prior * mean) / (v + prior);
}

/** Lower-cased, de-duplicated, empties dropped. Genres arrive in every casing. */
function normaliseGenres(input) {
  const values = Array.isArray(input) ? input : [input];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (!value) continue;
    const key = String(value).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * How well a title matches a taste vector, on 0..1.
 *
 * Weighted toward the *best* matching genre rather than the average: a viewer
 * who loves horror should be offered a horror-comedy, and averaging would rank
 * it below a genre they are merely lukewarm about across the board.
 */
function genreAffinity(genres, taste) {
  if (!genres || !genres.length || !taste || !taste.size) return 0;

  let best = 0;
  let total = 0;
  for (const genre of genres) {
    const weight = taste.get(genre) || 0;
    if (weight > best) best = weight;
    total += weight;
  }
  return clamp01(0.65 * best + 0.35 * (total / genres.length));
}

/**
 * The blend. Returns the score *and* its parts, because a recommendation you
 * cannot explain is a recommendation you cannot debug — the row subtitles and
 * the "% match" badge both read straight off this.
 */
function scoreItem(item, profile, context = {}) {
  const taste = profile?.taste || new Map();
  const maxViews = context.maxViews || 0;
  const meanRating = context.meanRating ?? 0.5;
  const now = context.now || Date.now();

  const affinity = genreAffinity(item.genres, taste);

  const quality = bayesianRating(
    item.ratingNormalised,
    item.ratingVotes,
    meanRating,
    RATING_PRIOR_VOTES
  );

  const popularity = maxViews > 0 ? clamp01(Math.log1p(item.views || 0) / Math.log1p(maxViews)) : 0;

  const freshness = recencyDecay(item.addedAt, FRESHNESS_HALF_LIFE_DAYS, now);

  const collab = clamp01(context.collab?.get(item.uid) || 0);

  // Saved-but-unstarted is the clearest statement of intent a viewer makes.
  const intent = item.inMyList && !item.watched ? 1 : 0;

  let score =
    WEIGHTS.affinity * affinity +
    WEIGHTS.collab * collab +
    WEIGHTS.quality * quality +
    WEIGHTS.popularity * popularity +
    WEIGHTS.freshness * freshness +
    WEIGHTS.intent * intent;

  if (item.watched) score -= SEEN_PENALTY;

  return {
    score,
    parts: { affinity, collab, quality, popularity, freshness, intent },
  };
}

/**
 * A 0-100 "match", shown on cards the way every streaming service does it.
 *
 * Built only from the personalised terms. Quality and popularity are properties
 * of the title, not of the fit, and folding them in would promise a 97% match
 * on a blockbuster the viewer has shown no interest in.
 *
 * Null when there is nothing to personalise against, so the badge is omitted
 * rather than claiming a match we cannot back.
 */
function matchPercent(parts, personalised) {
  if (!personalised) return null;
  const fit = 0.7 * (parts.affinity || 0) + 0.3 * (parts.collab || 0);
  if (fit <= 0.02) return null;
  return Math.round(Math.max(0.55, Math.min(0.99, 0.55 + 0.44 * fit)) * 100);
}

/** Genre overlap between two titles, 0..1. Jaccard, plus a nudge for kind. */
function itemSimilarity(a, b) {
  const left = new Set(a.genres || []);
  const right = b.genres || [];
  if (!left.size || !right.length) return a.kind === b.kind ? 0.2 : 0;

  let shared = 0;
  for (const genre of right) if (left.has(genre)) shared += 1;

  const union = left.size + right.length - shared;
  const jaccard = union > 0 ? shared / union : 0;
  return clamp01(0.85 * jaccard + (a.kind === b.kind ? 0.15 : 0));
}

/**
 * Maximal-marginal-relevance re-rank.
 *
 * Straight score ordering produces a row of near-duplicates, because the things
 * that make one title score well make its ten closest neighbours score well
 * too. Each pick is penalised by how similar it is to what has already been
 * taken, so the row spans the viewer's taste instead of one corner of it.
 *
 * lambda = 1 is pure score; lower trades relevance for spread.
 */
function diversify(scored, { limit = 20, lambda = 0.74 } = {}) {
  // MMR is quadratic in the pool, and a title outside the top 3x can never win
  // a seat no matter how novel it is — so the pool is capped rather than the
  // whole catalogue being re-compared on every pick.
  const pool = scored.slice(0, Math.max(limit * 3, limit));
  const picked = [];

  // The novelty penalty has to be on the same scale as the scores it competes
  // with; similarity is 0..1, so it is stretched by the pool's own top score.
  const scale = pool.reduce((max, entry) => Math.max(max, Math.abs(entry.score)), 0) || 1;

  while (pool.length && picked.length < limit) {
    let bestIndex = 0;
    let bestValue = -Infinity;

    for (let index = 0; index < pool.length; index += 1) {
      const candidate = pool[index];
      let maxSimilarity = 0;
      for (const chosen of picked) {
        const similarity = itemSimilarity(candidate.item, chosen.item);
        if (similarity > maxSimilarity) maxSimilarity = similarity;
      }
      const value = lambda * candidate.score - (1 - lambda) * maxSimilarity * scale;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    }

    picked.push(pool.splice(bestIndex, 1)[0]);
  }

  return picked;
}

/**
 * Guarantees both movies and shows appear in a mixed row.
 *
 * Diversification alone does not: with a catalogue weighted toward one kind,
 * the top of every personalised row is that kind, and the home page silently
 * becomes the movies page again. This reserves a share of the row for the
 * minority kind — but only as far as there are titles to fill it, so a
 * catalogue with no shows still produces a full row of movies.
 */
function mixKinds(scored, { limit = 20, minRatio = 0.3 } = {}) {
  const size = Math.min(limit, scored.length);
  if (!size) return [];

  const byKind = { movie: [], show: [] };
  for (const entry of scored) {
    if (byKind[entry.item.kind]) byKind[entry.item.kind].push(entry);
  }
  // Only one kind in the catalogue: nothing to reserve, and a quota would just
  // truncate the row.
  if (!byKind.movie.length || !byKind.show.length) return scored.slice(0, size);

  const reserved = Math.floor(size * minRatio);
  const chosen = new Set();
  const picked = [];

  // Seat the best of each kind first, up to the reservation.
  for (const kind of ["movie", "show"]) {
    for (const entry of byKind[kind].slice(0, Math.min(reserved, byKind[kind].length))) {
      chosen.add(entry.item.uid);
      picked.push(entry);
    }
  }

  // Everything left goes strictly by score — the quota is a floor, not a cap.
  for (const entry of scored) {
    if (picked.length >= size) break;
    if (chosen.has(entry.item.uid)) continue;
    chosen.add(entry.item.uid);
    picked.push(entry);
  }

  return picked.slice(0, size).sort((a, b) => b.score - a.score);
}

// --- normalisation -----------------------------------------------------------

/**
 * One envelope for two collections.
 *
 * Movies and shows disagree about almost every field name — `img` vs `poster`,
 * `genre` (one string) vs `genres` (an array), `avgRating` on 1-5 vs `rating`
 * on 0-10 — and the client should not have to know that. `uid` is prefixed by
 * kind because a Movie and a TVShow can hold the same ObjectId.
 */
function movieItem(doc) {
  const genres = normaliseGenres(doc.genre);
  const votes = Number(doc.numRatings) || 0;
  return {
    uid: `movie:${doc._id}`,
    id: String(doc._id),
    kind: "movie",
    // Legacy Movie rows carry an isSeries flag. They still play as one file
    // through /watch/:id, so the *behaviour* is a movie; only the label differs.
    badge: doc.isSeries ? "Series" : "Film",
    title: doc.title,
    overview: doc.desc || "",
    poster: doc.imgSm || doc.img || "",
    backdrop: doc.img || doc.imgSm || "",
    titleArt: doc.imgTitle || "",
    trailer: doc.trailer || "",
    genres,
    genreLabels: doc.genre ? [String(doc.genre)] : [],
    year: doc.year ? Number(doc.year) || null : null,
    maturity: Number.isFinite(doc.limit) ? doc.limit : null,
    runtime: doc.duration || "",
    rating10: votes > 0 && doc.avgRating ? Math.round(doc.avgRating * 2 * 10) / 10 : null,
    ratingNormalised: doc.avgRating ? clamp01(doc.avgRating / 5) : 0,
    ratingVotes: votes,
    views: Number(doc.views) || 0,
    addedAt: doc.createdAt || null,
    href: `/details/${doc._id}`,
    // Null when there is no file behind the title. A Play button that lands on
    // a player with nothing to play is worse than no Play button, and the hero
    // picker uses this to skip unplayable candidates.
    playHref: doc.video ? `/watch/${doc._id}` : null,
  };
}

function showItem(doc) {
  const genres = normaliseGenres(doc.genres);
  return {
    uid: `show:${doc._id}`,
    id: String(doc._id),
    kind: "show",
    badge: "Series",
    title: doc.title,
    overview: doc.overview || "",
    poster: doc.poster || doc.backdrop || "",
    backdrop: doc.backdrop || doc.poster || "",
    titleArt: "",
    trailer: doc.trailerUrl || "",
    genres,
    genreLabels: Array.isArray(doc.genres) ? doc.genres.filter(Boolean) : [],
    year: Number(doc.releaseYear) || null,
    maturity: null,
    runtime: "",
    seasonsCount: Number(doc.seasonsCount) || 0,
    episodesCount: Number(doc.episodesCount) || 0,
    status: doc.status || "ongoing",
    lastAirDate: doc.lastAirDate || null,
    rating10: doc.rating ? Math.round(doc.rating * 10) / 10 : null,
    ratingNormalised: doc.rating ? clamp01(doc.rating / 10) : 0,
    // Editorial ratings have no vote count; treat them as moderately confident
    // rather than as unrated, which would shrink every show to the mean.
    ratingVotes: doc.rating ? EDITORIAL_RATING_VOTES : 0,
    views: Number(doc.views) || 0,
    addedAt: doc.createdAt || null,
    href: `/series/${doc._id}`,
    // Resolved per-viewer from next-up: a show is not a file, and which episode
    // Play should open depends on how far in they are.
    playHref: null,
  };
}

// --- data access -------------------------------------------------------------

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

/**
 * Everything we know about one viewer's taste, in a single pass over every
 * store that holds a signal.
 *
 * Returns a genre vector normalised so its strongest entry is 1 — the absolute
 * magnitudes are meaningless (they depend only on how much someone has watched)
 * but the ratios are exactly what affinity needs.
 */
async function buildTasteProfile(userId) {
  const empty = {
    userId: null,
    taste: new Map(),
    watchedMovies: new Set(),
    watchedShows: new Set(),
    startedMovies: new Set(),
    startedShows: new Set(),
    myListMovies: new Set(),
    myListShows: new Set(),
    seeds: [],
    signalCount: 0,
    personalised: false,
  };
  if (!userId) return empty;

  const oid = toObjectId(userId);
  if (!oid) return empty;

  const [user, sessions, tvRows] = await Promise.all([
    User.findById(oid)
      .select(
        "myList myShows favorites watchlist watchHistory currentlyWatching genrePreferences"
      )
      .populate({ path: "watchHistory.movie", select: "genre title createdAt" })
      .populate({ path: "currentlyWatching.movie", select: "genre title" })
      .populate({ path: "favorites", select: "genre title" })
      .populate({ path: "myList", select: "genre title" })
      .populate({ path: "watchlist", select: "genre title" })
      .lean(),
    WatchSession.find({ userId: oid })
      .select("contentType contentId showId title genre secondsWatched percent completed startedAt")
      .sort({ startedAt: -1 })
      .limit(LIMITS.sessions)
      .lean(),
    TVProgress.find({ userId: oid })
      .select("showId percent completed watchedAt")
      .sort({ watchedAt: -1 })
      .limit(LIMITS.sessions)
      .lean(),
  ]);

  if (!user) return empty;

  const profile = {
    ...empty,
    userId: String(oid),
    taste: new Map(),
    watchedMovies: new Set(),
    watchedShows: new Set(),
    startedMovies: new Set(),
    startedShows: new Set(),
    myListMovies: new Set((user.myList || []).map((m) => String(m?._id || m))),
    myListShows: new Set((user.myShows || []).map(String)),
    seeds: [],
  };
  const watchlistIds = new Set((user.watchlist || []).map((m) => String(m?._id || m)));
  for (const id of watchlistIds) profile.myListMovies.add(id);

  const now = Date.now();
  let signals = 0;

  const add = (genres, weight, at) => {
    const list = normaliseGenres(genres);
    if (!list.length || weight <= 0) return;
    const decayed = weight * recencyDecay(at, TASTE_HALF_LIFE_DAYS, now);
    if (decayed <= 0) return;
    signals += 1;
    // A title tagged with three genres should not vote three times as hard as
    // a single-genre one, so its weight is shared across them.
    const share = decayed / list.length;
    for (const genre of list) {
      profile.taste.set(genre, (profile.taste.get(genre) || 0) + share);
    }
  };

  // Genres of shows referenced by TV signals, resolved in one query.
  const showIds = new Set();
  for (const row of tvRows) if (row.showId) showIds.add(String(row.showId));
  for (const session of sessions) if (session.showId) showIds.add(String(session.showId));
  for (const id of profile.myListShows) showIds.add(id);

  const shows = showIds.size
    ? await TVShow.find({ _id: { $in: [...showIds] } })
        .select("genres title")
        .lean()
    : [];
  const showById = new Map(shows.map((show) => [String(show._id), show]));

  // 1. Measured playback — the strongest signal, weighted by how much of the
  //    title was actually watched rather than by the fact it was opened.
  for (const session of sessions) {
    const isEpisode = session.contentType === "episode";
    const key = isEpisode ? String(session.showId || "") : String(session.contentId);
    if (!key) continue;

    if (isEpisode) profile.startedShows.add(key);
    else profile.startedMovies.add(key);

    if (session.completed) {
      if (isEpisode) profile.watchedShows.add(key);
      else profile.watchedMovies.add(key);
    }

    if ((session.secondsWatched || 0) < MIN_MEANINGFUL_SEC) continue;

    const genres = isEpisode
      ? showById.get(key)?.genres
      : session.genre || null;

    // Completion is the difference between "sampled" and "liked".
    const engagement = 0.4 + 0.6 * clamp01((session.percent || 0) / 100);
    add(genres, SIGNAL_WEIGHTS.session * engagement, session.startedAt);

    if (profile.seeds.length < 8) {
      profile.seeds.push({
        kind: isEpisode ? "show" : "movie",
        id: key,
        contentId: String(session.contentId),
        title: isEpisode ? showById.get(key)?.title || session.title : session.title,
        at: session.startedAt,
        weight: engagement,
      });
    }
  }

  // 2. Episode progress — covers viewers who watched before session tracking
  //    existed, and shows started on a device that never sent heartbeats.
  for (const row of tvRows) {
    const key = String(row.showId || "");
    if (!key) continue;
    profile.startedShows.add(key);
    if (row.completed) profile.watchedShows.add(key);

    const engagement = 0.4 + 0.6 * clamp01((row.percent || 0) / 100);
    add(showById.get(key)?.genres, SIGNAL_WEIGHTS.tvProgress * engagement, row.watchedAt);

    if (profile.seeds.length < 8 && !profile.seeds.some((seed) => seed.id === key)) {
      profile.seeds.push({
        kind: "show",
        id: key,
        contentId: key,
        title: showById.get(key)?.title || "",
        at: row.watchedAt,
        weight: engagement,
      });
    }
  }

  // 3. Movie history and in-progress rows on the User document.
  for (const entry of user.watchHistory || []) {
    const movie = entry?.movie;
    if (!movie?._id) continue;
    const id = String(movie._id);
    profile.startedMovies.add(id);
    if (entry.completed !== false) profile.watchedMovies.add(id);
    add(movie.genre, SIGNAL_WEIGHTS.history, entry.watchedAt);

    if (profile.seeds.length < 8 && !profile.seeds.some((seed) => seed.id === id)) {
      profile.seeds.push({
        kind: "movie",
        id,
        contentId: id,
        title: movie.title,
        at: entry.watchedAt,
        weight: 1,
      });
    }
  }

  for (const entry of user.currentlyWatching || []) {
    const movie = entry?.movie;
    if (!movie?._id) continue;
    profile.startedMovies.add(String(movie._id));
    add(movie.genre, SIGNAL_WEIGHTS.currentlyWatching, entry.lastWatchedAt);
  }

  // 4. Explicit taste: favourites are a rating, lists are an intention.
  for (const movie of user.favorites || []) {
    if (movie?.genre) add(movie.genre, SIGNAL_WEIGHTS.favorite, null);
  }
  for (const movie of user.myList || []) {
    if (movie?.genre) add(movie.genre, SIGNAL_WEIGHTS.myList, null);
  }
  for (const movie of user.watchlist || []) {
    if (movie?.genre) add(movie.genre, SIGNAL_WEIGHTS.watchlist, null);
  }
  for (const id of profile.myListShows) {
    add(showById.get(id)?.genres, SIGNAL_WEIGHTS.myList, null);
  }

  // 5. The legacy per-genre counter. Lowest weight: it counts titles, not time,
  //    and predates every correction made to how the others are recorded.
  const preferences = user.genrePreferences;
  const entries =
    preferences instanceof Map ? [...preferences.entries()] : Object.entries(preferences || {});
  for (const [genre, count] of entries) {
    add(genre, SIGNAL_WEIGHTS.genrePreference * Math.min(5, Number(count) || 0), null);
  }

  // Normalise so the strongest genre is 1: affinity compares ratios, and the
  // raw totals only say how much this person watches.
  let peak = 0;
  for (const weight of profile.taste.values()) if (weight > peak) peak = weight;
  if (peak > 0) {
    for (const [genre, weight] of profile.taste) profile.taste.set(genre, weight / peak);
  }

  profile.seeds.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  profile.signalCount = signals;
  profile.personalised = signals >= 2 && profile.taste.size > 0;

  return profile;
}

/**
 * Item-to-item collaborative filtering over playback sessions.
 *
 * "Viewers who watched what you just watched also watched X", scored by how
 * many of those viewers reached X and damped by X's own popularity — without
 * that damping this degenerates into a second trending row, because the most
 * watched title co-occurs with everything.
 *
 * Two bounded reads, both index-backed (contentId_1_startedAt_-1, then
 * userId_1_startedAt_-1). Returns a Map of uid -> 0..1.
 */
async function coWatchScores(userId, seeds) {
  const scores = new Map();
  if (!seeds?.length) return scores;

  const seedIds = seeds.map((seed) => toObjectId(seed.contentId)).filter(Boolean);
  if (!seedIds.length) return scores;

  const me = toObjectId(userId);

  const peerRows = await WatchSession.find({
    contentId: { $in: seedIds },
    ...(me ? { userId: { $ne: me } } : {}),
    secondsWatched: { $gte: MIN_MEANINGFUL_SEC },
  })
    .select("userId")
    .sort({ startedAt: -1 })
    .limit(LIMITS.peerRows)
    .lean();

  const peerIds = [];
  const seenPeers = new Set();
  for (const row of peerRows) {
    const key = String(row.userId);
    if (seenPeers.has(key)) continue;
    seenPeers.add(key);
    peerIds.push(row.userId);
    if (peerIds.length >= LIMITS.peers) break;
  }
  if (!peerIds.length) return scores;

  const coRows = await WatchSession.find({
    userId: { $in: peerIds },
    contentId: { $nin: seedIds },
    secondsWatched: { $gte: MIN_MEANINGFUL_SEC },
  })
    .select("userId contentType contentId showId")
    .sort({ startedAt: -1 })
    .limit(LIMITS.coWatchRows)
    .lean();

  // Distinct peers per title, not distinct sessions — one viewer bingeing a
  // show twenty times is one endorsement, not twenty.
  const byUid = new Map();
  for (const row of coRows) {
    const uid =
      row.contentType === "episode"
        ? row.showId
          ? `show:${row.showId}`
          : null
        : `movie:${row.contentId}`;
    if (!uid) continue;
    if (!byUid.has(uid)) byUid.set(uid, new Set());
    byUid.get(uid).add(String(row.userId));
  }
  if (!byUid.size) return scores;

  // Damped by sqrt of the peer count so a title watched by every peer does not
  // simply win; the shape of the lift is what carries the signal.
  let peak = 0;
  const raw = new Map();
  for (const [uid, users] of byUid) {
    const value = users.size / Math.sqrt(peerIds.length);
    raw.set(uid, value);
    if (value > peak) peak = value;
  }
  if (peak <= 0) return scores;

  for (const [uid, value] of raw) scores.set(uid, clamp01(value / peak));
  return scores;
}

/**
 * The same idea against `User.watchHistory`, for deployments whose session
 * tracking is younger than their user base. Bounded by the
 * `watchHistory.movie` index. Movies only — history has never held shows.
 */
async function historyCoWatch(userId, seeds) {
  const scores = new Map();
  const seedMovieIds = seeds
    .filter((seed) => seed.kind === "movie")
    .map((seed) => toObjectId(seed.id))
    .filter(Boolean);
  if (!seedMovieIds.length) return scores;

  const me = toObjectId(userId);
  const peers = await User.find({
    "watchHistory.movie": { $in: seedMovieIds },
    ...(me ? { _id: { $ne: me } } : {}),
  })
    .select("watchHistory.movie favorites")
    .limit(LIMITS.peerUsers)
    .lean();
  if (!peers.length) return scores;

  const seedKeys = new Set(seedMovieIds.map(String));
  const counts = new Map();
  for (const peer of peers) {
    const theirs = new Set();
    for (const entry of peer.watchHistory || []) {
      const id = entry?.movie ? String(entry.movie) : null;
      if (id && !seedKeys.has(id)) theirs.add(id);
    }
    for (const id of peer.favorites || []) {
      const key = String(id);
      if (!seedKeys.has(key)) theirs.add(key);
    }
    for (const id of theirs) counts.set(id, (counts.get(id) || 0) + 1);
  }
  if (!counts.size) return scores;

  let peak = 0;
  const raw = new Map();
  for (const [id, count] of counts) {
    const value = count / Math.sqrt(peers.length);
    raw.set(`movie:${id}`, value);
    if (value > peak) peak = value;
  }
  if (peak <= 0) return scores;

  for (const [uid, value] of raw) scores.set(uid, clamp01(value / peak));
  return scores;
}

/** Union of the two co-watch sources, keeping the stronger signal per title. */
function mergeCollab(...maps) {
  const out = new Map();
  for (const map of maps) {
    for (const [uid, value] of map) {
      if ((out.get(uid) || 0) < value) out.set(uid, value);
    }
  }
  return out;
}

/**
 * The candidate pool: every title a viewer could be shown, in one array.
 *
 * Capped rather than exhaustive. Ordering the fetch by views and recency means
 * the cap only ever drops titles that are both unpopular and old, which no row
 * on this page would have surfaced anyway.
 */
async function loadCandidates() {
  const [movies, shows] = await Promise.all([
    Movie.find({})
      .select(
        "title desc img imgSm imgTitle trailer video year limit genre isSeries duration views avgRating numRatings createdAt"
      )
      .sort({ views: -1, createdAt: -1 })
      .limit(LIMITS.candidateMovies)
      .lean(),
    TVShow.find({ published: true })
      .select(
        "title overview poster backdrop trailerUrl genres status rating releaseYear seasonsCount episodesCount lastAirDate views createdAt"
      )
      .sort({ views: -1, createdAt: -1 })
      .limit(LIMITS.candidateShows)
      .lean(),
  ]);

  return [...movies.map(movieItem), ...shows.map(showItem)];
}

/** Movies the viewer has an unfinished position in, newest activity first. */
async function movieContinueWatching(userId, limit) {
  if (!userId) return [];
  const oid = toObjectId(userId);
  if (!oid) return [];

  const user = await User.findById(oid)
    .select("currentlyWatching")
    .populate({
      path: "currentlyWatching.movie",
      select:
        "title desc img imgSm imgTitle trailer video year limit genre isSeries duration views avgRating numRatings createdAt",
    })
    .lean();

  const rows = (user?.currentlyWatching || [])
    .filter((entry) => entry?.movie?._id)
    .sort((a, b) => new Date(b.lastWatchedAt || 0) - new Date(a.lastWatchedAt || 0))
    .slice(0, limit);
  if (!rows.length) return [];

  // Sessions carry the real position; `progress` on the User document is only a
  // percentage, and a resume needs seconds.
  const sessions = await WatchSession.find({
    userId: oid,
    contentType: "movie",
    contentId: { $in: rows.map((row) => row.movie._id) },
  })
    .select("contentId positionSec maxPositionSec durationSec percent completed startedAt")
    .sort({ startedAt: -1 })
    .lean();

  const latestByMovie = new Map();
  for (const session of sessions) {
    const key = String(session.contentId);
    if (!latestByMovie.has(key)) latestByMovie.set(key, session);
  }

  return rows
    .map((row) => {
      const item = movieItem(row.movie);
      const session = latestByMovie.get(item.id);
      const percent = Math.round(session?.percent ?? row.progress ?? 0);
      if (percent >= 95 || session?.completed) return null; // finished, not resumable

      return {
        item,
        percent: Math.max(0, Math.min(100, percent)),
        resumeSec: Math.max(0, Math.round(session?.positionSec || 0)),
        durationSec: Math.round(session?.durationSec || 0),
        lastWatchedAt: row.lastWatchedAt || session?.startedAt || null,
        subtitle: item.runtime || "",
        still: item.backdrop,
        // The movie player resolves its own resume position from
        // /playback/resume, so the link needs no timestamp.
        watchHref: item.playHref || item.href,
        reason: percent > 0 ? "resume" : "start",
      };
    })
    .filter(Boolean);
}

/** TV shows in progress, reshaped into the same tile the movies produce. */
function tvContinueEntries(entries) {
  return entries.map((entry) => {
    const item = showItem(entry.show);
    const episode = entry.episode;
    const code = `S${episode.seasonNumber}:E${episode.episodeNumber}`;
    return {
      item,
      percent: Math.max(0, Math.min(100, Math.round(entry.percent || 0))),
      resumeSec: Math.max(0, Math.round(entry.resumeSec || 0)),
      durationSec: (Number(episode.duration) || 0) * 60,
      lastWatchedAt: entry.lastWatchedAt || null,
      subtitle: `${code} · ${episode.title}`,
      still: episode.stillPath || item.backdrop,
      watchHref:
        entry.reason === "resume" && entry.resumeSec > 0
          ? `/watch/episode/${episode._id}?t=${Math.floor(entry.resumeSec)}`
          : `/watch/episode/${episode._id}`,
      reason: entry.reason,
      episodeCode: code,
    };
  });
}

/**
 * Resolves the play button for a show: which episode, and from where.
 *
 * A hero whose Play button lands on the page it is already describing is the
 * one failure the billboard cannot have, so this is resolved against the
 * Episode collection rather than trusting `episodesCount` — that counter
 * includes drafts, so a show can claim five episodes and have none published.
 */
async function resolveShowPlayback(showIds, userId) {
  const out = new Map();
  const ids = showIds.filter(Boolean);
  if (!ids.length) return out;

  const [episodesByShow, progressRows] = await Promise.all([
    orderedEpisodes(ids),
    userId
      ? TVProgress.find({ userId: toObjectId(userId), showId: { $in: ids } })
          .lean()
          .then((rows) => rows)
      : Promise.resolve([]),
  ]);

  const progressByShow = new Map();
  for (const row of progressRows) {
    const key = String(row.showId);
    if (!progressByShow.has(key)) progressByShow.set(key, new Map());
    progressByShow.get(key).set(String(row.episodeId), row);
  }

  for (const id of ids) {
    const key = String(id);
    const episodes = episodesByShow.get(key) || [];
    if (!episodes.length) continue;
    const nextUp = computeNextUp(episodes, progressByShow.get(key) || new Map());
    if (!nextUp) continue;
    out.set(key, nextUp);
  }
  return out;
}

// --- feed assembly -----------------------------------------------------------

/**
 * Drops the fields that only exist so `scoreItem` can do its arithmetic.
 *
 * `ratingNormalised` and `ratingVotes` are inputs to the Bayesian shrink, on a
 * scale that means nothing outside it — shipping them invites a client to
 * render "0.8" next to a title, or worse, to re-derive a ranking from them.
 * `rating10` is the one the UI should show.
 */
function publicItem(item) {
  const { ratingNormalised, ratingVotes, ...rest } = item;
  return rest;
}

function titleCase(value) {
  return String(value)
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/**
 * Builds the whole home page in one payload.
 *
 * Every row is drawn from the same scored pool, so a title's position is
 * consistent across the page, and each row states which slice it took. Rows
 * that cannot be filled are dropped rather than rendered empty — on a small
 * catalogue that is most of them, and a page of three good rows beats a page of
 * twelve stubs.
 */
async function buildHomeFeed(userId, options = {}) {
  const requestedRowSize = Math.min(30, Math.max(6, Number(options.rowSize) || 20));
  const now = Date.now();

  // `options.profile` lets a caller supply a taste profile it already holds —
  // and lets the row assembly be exercised against a synthetic one, which is
  // otherwise only reachable by writing watch history to a real database.
  const [profile, candidates] = await Promise.all([
    options.profile || buildTasteProfile(userId),
    loadCandidates(),
  ]);

  if (!candidates.length) {
    return { hero: null, rows: [], profile: { personalised: false, topGenres: [] } };
  }

  // A row of twenty against a catalogue of twenty-one is one row and nothing
  // else: the first one takes everything, and every row below it comes out
  // empty. Rows shrink with the catalogue so the page keeps its shape.
  const rowSize = Math.min(requestedRowSize, Math.max(6, Math.ceil(candidates.length / 3)));

  const [sessionCollab, historyCollab, tvContinueRaw, movieContinue] = await Promise.all([
    coWatchScores(userId, profile.seeds),
    historyCoWatch(userId, profile.seeds),
    userId ? getContinueWatching(userId, rowSize) : Promise.resolve([]),
    movieContinueWatching(userId, rowSize),
  ]);
  const collab = mergeCollab(sessionCollab, historyCollab);

  // Context every candidate is scored against. Computed from the pool rather
  // than hard-coded so the same weights behave on a 20-title catalogue and a
  // 20,000-title one.
  let maxViews = 0;
  let ratingTotal = 0;
  let ratedCount = 0;
  for (const item of candidates) {
    if (item.views > maxViews) maxViews = item.views;
    if (item.ratingVotes > 0 && item.ratingNormalised > 0) {
      ratingTotal += item.ratingNormalised;
      ratedCount += 1;
    }
  }
  const context = {
    maxViews,
    meanRating: ratedCount ? ratingTotal / ratedCount : 0.55,
    collab,
    now,
  };

  // Fold per-viewer state onto each candidate before scoring: My List and
  // "already seen" both change the ranking, not just the badge.
  for (const item of candidates) {
    if (item.kind === "movie") {
      item.inMyList = profile.myListMovies.has(item.id);
      item.watched = profile.watchedMovies.has(item.id);
      item.started = profile.startedMovies.has(item.id);
    } else {
      item.inMyList = profile.myListShows.has(item.id);
      item.watched = profile.watchedShows.has(item.id);
      item.started = profile.startedShows.has(item.id);
    }
  }

  const scored = candidates
    .map((item) => {
      const { score, parts } = scoreItem(item, profile, context);
      return { item, score, parts };
    })
    .sort((a, b) => b.score - a.score);

  const byUid = new Map(scored.map((entry) => [entry.item.uid, entry]));

  // Shows need an episode resolved before they can carry a Play button. Doing
  // it for the whole pool would be an N+1 on Episode; the top slice plus
  // anything in progress covers every show the page can actually surface.
  const showsNeedingPlayback = new Set();
  for (const entry of scored.slice(0, rowSize * 4)) {
    if (entry.item.kind === "show") showsNeedingPlayback.add(entry.item.id);
  }
  const playbackByShow = await resolveShowPlayback([...showsNeedingPlayback], userId);
  for (const [showId, nextUp] of playbackByShow) {
    const entry = byUid.get(`show:${showId}`);
    if (!entry) continue;
    entry.item.playHref = `/watch/episode/${nextUp.episode._id}`;
    entry.item.nextUp = {
      episodeId: String(nextUp.episode._id),
      title: nextUp.episode.title,
      code: `S${nextUp.episode.seasonNumber}:E${nextUp.episode.episodeNumber}`,
      resumeSec: nextUp.resumeSec,
      reason: nextUp.reason,
    };
  }

  // --- rows -----------------------------------------------------------------

  const rows = [];
  // Titles already used by a *discovery* row. Trending and Top 10 deliberately
  // ignore this — they are statements about the catalogue, not suggestions —
  // but showing the same title in "Top Picks", "Because you watched" and a
  // genre row makes a small catalogue look like it holds four titles.
  const used = new Set();

  // A row of one is a layout accident, not a recommendation — but on a tiny
  // catalogue a floor of three would delete the page.
  const minItems = candidates.length >= 12 ? 3 : 2;

  const take = (entries, limit, { skipUsed = true, markUsed = true, min = 0 } = {}) => {
    const fresh = [];
    const repeats = [];

    for (const entry of entries) {
      if (skipUsed && used.has(entry.item.uid)) {
        if (repeats.length < limit) repeats.push(entry);
      } else if (fresh.length < limit) {
        fresh.push(entry);
      }
      if (fresh.length >= limit && repeats.length >= limit) break;
    }

    // A row with material of its own but not enough of it is padded up to the
    // floor with titles already shown above — on a small catalogue that overlap
    // is honest, and a two-tile row is not.
    //
    // A row with *no* material of its own is left empty for the caller to drop.
    // Re-taking it without the filter would render a strict duplicate of the
    // row above it, which is worse than the row being missing: "Hidden Gems"
    // listing the same titles as "Top Picks" says the ranking is not working.
    let out = fresh;
    if (fresh.length && fresh.length < min) {
      out = [...fresh, ...repeats].slice(0, Math.max(min, fresh.length));
    }

    if (markUsed) for (const entry of out) used.add(entry.item.uid);
    return out;
  };

  const present = (entries) =>
    entries.map((entry) => ({
      ...publicItem(entry.item),
      match: matchPercent(entry.parts, profile.personalised),
    }));

  const pushRow = (row) => {
    if (!row.items.length) return;
    if (row.kind !== "continue" && row.items.length < minItems && !row.keepShort) return;
    delete row.keepShort;
    rows.push(row);
  };

  // Continue Watching — movies and episodes in one row, ordered by when the
  // viewer last touched them, because that is the only ordering that matches
  // what they were doing.
  const continueItems = [...movieContinue, ...tvContinueEntries(tvContinueRaw)]
    .sort((a, b) => new Date(b.lastWatchedAt || 0) - new Date(a.lastWatchedAt || 0))
    .slice(0, rowSize)
    .map((entry) => ({
      ...entry,
      // These tiles build their own MediaItem rather than coming out of the
      // scored pool, so the per-viewer flags every card reads have to be folded
      // on here too — otherwise the My List toggle renders empty on the one row
      // where the viewer is most likely to use it.
      item: {
        ...publicItem(entry.item),
        inMyList:
          entry.item.kind === "movie"
            ? profile.myListMovies.has(entry.item.id)
            : profile.myListShows.has(entry.item.id),
        watched: false, // by definition: it is still in progress
        started: true,
        match: null,
      },
    }));

  if (continueItems.length) {
    pushRow({
      key: "continue",
      title: "Continue Watching",
      kind: "continue",
      items: continueItems,
    });
    for (const entry of continueItems) used.add(entry.item.uid);
  }

  // Top Picks — the whole point of the page. Unseen, diversified, and forced to
  // carry both kinds so the home page is never silently the movies page.
  const pickPool = scored.filter((entry) => !entry.item.watched && !used.has(entry.item.uid));
  const picks = mixKinds(diversify(pickPool, { limit: rowSize * 2, lambda: 0.72 }), {
    limit: rowSize,
    minRatio: 0.3,
  });
  if (picks.length) {
    pushRow({
      key: "picks",
      title: profile.personalised ? "Top Picks for You" : "Popular on Nextream",
      subtitle: profile.personalised
        ? "Ranked from what you watch, finish and save"
        : "Start watching and this becomes yours",
      kind: "media",
      items: present(take(picks, rowSize)),
    });
  }

  // My List — both collections, since they live in different fields.
  const listEntries = scored.filter((entry) => entry.item.inMyList);
  if (listEntries.length) {
    pushRow({
      key: "myList",
      title: "My List",
      kind: "media",
      keepShort: true,
      items: present(take(listEntries, rowSize, { skipUsed: false, markUsed: false })),
    });
  }

  // Because you watched X — item-to-item, seeded by the most recent title with
  // a name we can print. Content similarity backs up the co-watch signal, which
  // is empty on a young deployment.
  const seed = profile.seeds.find((entry) => entry.title);
  if (seed) {
    const seedUid = `${seed.kind}:${seed.id}`;
    const seedEntry = byUid.get(seedUid);
    const seedGenres = seedEntry?.item.genres || [];

    const neighbours = scored
      .filter((entry) => entry.item.uid !== seedUid && !entry.item.watched)
      .map((entry) => ({
        entry,
        affinity:
          0.6 * (collab.get(entry.item.uid) || 0) +
          0.4 * (seedEntry ? itemSimilarity(seedEntry.item, entry.item) : 0),
      }))
      .filter((row) => row.affinity > 0.08)
      .sort((a, b) => b.affinity - a.affinity || b.entry.score - a.entry.score)
      .map((row) => row.entry);

    const items = present(take(neighbours, rowSize, { min: minItems }));
    pushRow({
      key: "because",
      title: `Because you watched ${seed.title}`,
      subtitle: seedGenres.length ? seedGenres.slice(0, 3).map(titleCase).join(" · ") : undefined,
      kind: "media",
      items,
    });
  }

  // Trending — views, but weighted by recency so a title that was popular two
  // years ago cannot occupy the row forever.
  const trending = [...scored]
    .map((entry) => ({
      entry,
      heat:
        Math.log1p(entry.item.views || 0) *
        (0.45 + 0.55 * recencyDecay(entry.item.addedAt, 120, now)),
    }))
    .filter((row) => row.heat > 0)
    .sort((a, b) => b.heat - a.heat)
    .map((row) => row.entry);

  // A "Top 10" drawn from two titles that happen to have a view each is not a
  // ranking, it is noise wearing a numeral. Below the threshold the row is
  // dropped rather than padded out with titles nobody has watched.
  if (trending.length >= MIN_TRENDING_TITLES) {
    pushRow({
      key: "top10",
      title: "Top 10 Today",
      kind: "media",
      ranked: true,
      keepShort: true,
      items: present(take(trending, 10, { skipUsed: false, markUsed: false })),
    });
  }

  // New on Nextream — straight recency, no personalisation. Viewers use this
  // row to check whether anything arrived, and a ranked version answers a
  // different question. Titles older than the window are excluded rather than
  // padded in: a "new" row of two-year-old films is just Top Picks again.
  const freshCutoff = now - NEW_RELEASE_WINDOW_DAYS * DAY_MS;
  const fresh = scored
    .filter((entry) => {
      const added = entry.item.addedAt ? new Date(entry.item.addedAt).getTime() : NaN;
      return Number.isFinite(added) && added >= freshCutoff;
    })
    .sort((a, b) => new Date(b.item.addedAt) - new Date(a.item.addedAt));
  if (fresh.length) {
    pushRow({
      key: "new",
      title: "New on Nextream",
      kind: "media",
      items: present(take(fresh, rowSize, { skipUsed: false, markUsed: false })),
    });
  }

  // A row per top genre. Two, not five: past that they stop being distinct
  // from each other and the page turns into a genre directory.
  const topGenres = [...profile.taste.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre);

  for (const genre of topGenres.slice(0, 2)) {
    const inGenre = scored.filter(
      (entry) => entry.item.genres.includes(genre) && !entry.item.watched
    );
    const items = present(take(inGenre, rowSize, { min: minItems }));
    pushRow({
      key: `genre:${genre}`,
      title: `More ${titleCase(genre)}`,
      subtitle: "Because you keep coming back to it",
      kind: "media",
      genre,
      items,
    });
  }

  // Hidden gems — well rated, under-watched. The one row that exists to break
  // the popularity feedback loop every other row reinforces.
  const viewsMedian = median(candidates.map((item) => item.views || 0));
  const gems = scored.filter(
    (entry) =>
      !entry.item.watched &&
      entry.item.ratingVotes > 0 &&
      entry.parts.quality >= 0.62 &&
      (entry.item.views || 0) <= Math.max(2, viewsMedian)
  );
  if (gems.length) {
    pushRow({
      key: "gems",
      title: "Hidden Gems",
      subtitle: "Highly rated, rarely found",
      kind: "media",
      items: present(take(gems, rowSize, { min: minItems })),
    });
  }

  // Watch It Again — the only row that wants titles the viewer has finished,
  // so it reads the seen set instead of excluding it.
  const rewatch = scored
    .filter((entry) => entry.item.watched)
    .sort((a, b) => b.parts.affinity - a.parts.affinity || b.score - a.score);
  if (rewatch.length) {
    pushRow({
      key: "again",
      title: "Watch It Again",
      kind: "media",
      keepShort: true,
      items: present(take(rewatch, rowSize, { skipUsed: false, markUsed: false })),
    });
  }

  // --- hero -----------------------------------------------------------------

  // Prefer something already in flight — the strongest call to action on the
  // page is the thing the viewer stopped halfway through. Otherwise the best
  // unseen title that has both artwork and a working play target.
  const heroCandidates = [];
  const heroSeen = new Set();
  const pushHero = (entry) => {
    if (!entry || heroSeen.has(entry.item.uid)) return;
    heroSeen.add(entry.item.uid);
    heroCandidates.push(entry);
  };

  for (const entry of continueItems.slice(0, 3)) pushHero(byUid.get(entry.item.uid));
  for (const entry of picks.slice(0, 6)) pushHero(entry);
  for (const entry of trending.slice(0, 6)) pushHero(entry);

  const hasArt = (item) => Boolean(item.backdrop || item.poster);
  const isPlayable = (item) => Boolean(item.playHref);

  const heroEntry =
    heroCandidates.find((entry) => hasArt(entry.item) && isPlayable(entry.item)) ||
    heroCandidates.find((entry) => isPlayable(entry.item)) ||
    heroCandidates.find((entry) => hasArt(entry.item)) ||
    heroCandidates[0] ||
    scored[0];

  let hero = null;
  if (heroEntry) {
    const resume = continueItems.find((entry) => entry.item.uid === heroEntry.item.uid);
    hero = {
      ...publicItem(heroEntry.item),
      match: matchPercent(heroEntry.parts, profile.personalised),
      reason: heroReason(heroEntry, profile, resume),
      resume: resume
        ? { percent: resume.percent, resumeSec: resume.resumeSec, subtitle: resume.subtitle }
        : null,
      watchHref: resume?.watchHref || heroEntry.item.playHref,
    };
  }

  return {
    hero,
    rows,
    profile: {
      personalised: profile.personalised,
      topGenres: topGenres.map(titleCase),
      signalCount: profile.signalCount,
    },
  };
}

/** One line explaining why this title is on the billboard. */
function heroReason(entry, profile, resume) {
  if (resume) return resume.percent > 0 ? "Pick up where you left off" : "Next in your queue";
  if (entry.item.inMyList) return "From your list";
  if (profile.personalised && entry.parts.collab > 0.4) return "Viewers like you are watching this";
  if (profile.personalised && entry.parts.affinity > 0.45) {
    const genre = entry.item.genreLabels?.[0] || entry.item.genres?.[0];
    return genre ? `Because you watch ${titleCase(genre)}` : "Picked for you";
  }
  if (entry.parts.freshness > 0.6) return "New on Nextream";
  return "Trending now";
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

module.exports = {
  WEIGHTS,
  bayesianRating,
  buildHomeFeed,
  buildTasteProfile,
  coWatchScores,
  diversify,
  genreAffinity,
  itemSimilarity,
  matchPercent,
  mixKinds,
  movieItem,
  normaliseGenres,
  recencyDecay,
  scoreItem,
  showItem,
};
