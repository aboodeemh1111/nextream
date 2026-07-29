const crypto = require("crypto");
const Movie = require("../models/Movie");
const TVShow = require("../models/TVShow");

/**
 * The catalogue, flattened for a client that wants to index it itself.
 *
 * Every other search surface here answers a *question* — "what matches this
 * query", "what should this viewer see next" — and does the ranking on the
 * server. This one answers "what is in the catalogue", and hands the ranking
 * over.
 *
 * That exists for the browser recommender in nextream-client, which trains on
 * signals the server never sees: which cards were shown and ignored, how long a
 * pointer rested on one, which of five results a search click landed on. Those
 * are worth a lot to a ranker and worth nothing in a database — they are high
 * volume, per-device, and mostly noise until they are aggregated against the
 * item they were about. Shipping the catalogue once and ranking locally keeps
 * them where they are generated.
 *
 * The payload is deliberately text-and-numbers only. No per-viewer state, no
 * playback URLs, nothing that would make it unsafe to cache — which is what
 * lets it carry a strong ETag and cost a 304 on every visit after the first.
 */

/** Rebuilt at most this often; a publish shows up within the window. */
const TTL_MS = 5 * 60 * 1000;

/**
 * Enough to hold any catalogue this app realistically serves, and a ceiling so
 * a runaway import cannot hand a phone a 40MB download.
 */
const MAX_ITEMS = 12_000;

let cached = { at: 0, payload: null, etag: null };

function text(value) {
  return String(value ?? "").trim();
}

function year(value) {
  const parsed = Number.parseInt(String(value ?? "").slice(0, 4), 10);
  return Number.isInteger(parsed) && parsed >= 1870 && parsed <= 2100 ? parsed : null;
}

/**
 * "2h 14m", "142 min", "1:52" — the admin form takes free text, so runtime is
 * whatever was typed. Anything unparseable becomes null rather than a wrong
 * number the client would then feature-scale.
 */
function minutes(value) {
  const raw = text(value).toLowerCase();
  if (!raw) return null;

  const hoursAndMinutes = raw.match(/(\d+)\s*h(?:ours?)?\s*(\d+)?/);
  if (hoursAndMinutes) {
    return Number(hoursAndMinutes[1]) * 60 + Number(hoursAndMinutes[2] || 0);
  }

  const clock = raw.match(/^(\d+):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const plain = raw.match(/(\d+)\s*m/);
  if (plain) return Number(plain[1]);

  const bare = Number.parseInt(raw, 10);
  return Number.isInteger(bare) && bare > 0 && bare < 1200 ? bare : null;
}

/** Both collections rate on their own scale; the client only wants one. */
function toTen(value, scale) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.max(0, Math.min(10, (number / scale) * 10));
}

function movieRow(doc) {
  return {
    uid: `movie:${doc._id}`,
    id: String(doc._id),
    // Legacy Movie documents can be flagged isSeries; they still live in the
    // Movie collection and link like a movie, so kind stays "movie" and only
    // the badge changes. The client uses kind for routing and badge for copy.
    kind: "movie",
    badge: doc.isSeries ? "Series" : "Film",
    title: text(doc.title),
    overview: text(doc.desc),
    genres: [text(doc.genre).toLowerCase()].filter(Boolean),
    tags: [],
    year: year(doc.year),
    runtimeMin: minutes(doc.duration),
    maturity: Number.isFinite(doc.limit) ? doc.limit : null,
    rating10: toTen(doc.avgRating, 5),
    votes: Number(doc.numRatings) || 0,
    views: Number(doc.views) || 0,
    seasons: null,
    episodes: null,
    status: null,
    poster: text(doc.imgSm) || text(doc.img),
    backdrop: text(doc.img),
    addedAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  };
}

function showRow(doc) {
  return {
    uid: `show:${doc._id}`,
    id: String(doc._id),
    kind: "show",
    badge: "Series",
    title: text(doc.title),
    overview: text(doc.overview),
    genres: (doc.genres || []).map((genre) => text(genre).toLowerCase()).filter(Boolean),
    tags: (doc.tags || []).map(text).filter(Boolean),
    year: year(doc.releaseYear),
    runtimeMin: null,
    maturity: null,
    rating10: toTen(doc.rating, 10),
    votes: 0,
    views: Number(doc.views) || 0,
    seasons: Number(doc.seasonsCount) || 0,
    episodes: Number(doc.episodesCount) || 0,
    status: doc.status || null,
    poster: text(doc.poster),
    backdrop: text(doc.backdrop) || text(doc.poster),
    addedAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  };
}

/**
 * Builds the snapshot, or returns the one from the last few minutes.
 *
 * The ETag is a hash of the body rather than a timestamp, so a rebuild that
 * produced identical bytes — the common case, since the catalogue changes far
 * less often than the TTL expires — still lets every client revalidate to a 304
 * instead of re-downloading what it already has.
 */
async function catalogueSnapshot() {
  if (cached.payload && Date.now() - cached.at < TTL_MS) return cached;

  const [movies, shows] = await Promise.all([
    Movie.find({})
      .select("title desc img imgSm year limit genre isSeries duration views avgRating numRatings createdAt")
      .limit(MAX_ITEMS)
      .lean(),
    TVShow.find({ published: true })
      .select("title overview genres tags status poster backdrop rating releaseYear seasonsCount episodesCount views createdAt")
      .limit(MAX_ITEMS)
      .lean(),
  ]);

  const items = [
    ...movies.map(movieRow),
    ...shows.map(showRow),
  ].filter((item) => item.title);

  const payload = {
    // Bumped when the shape below changes. The client stores the snapshot in
    // IndexedDB and rebuilds its index when this moves, which is cheaper than
    // teaching every past version to read every future field.
    schema: 1,
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  };

  const etag = `W/"${crypto
    .createHash("sha1")
    .update(JSON.stringify(items))
    .digest("base64url")}"`;

  cached = { at: Date.now(), payload, etag };
  return cached;
}

module.exports = { catalogueSnapshot };
