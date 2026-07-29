const mongoose = require("mongoose");
const Movie = require("../models/Movie");
const TVShow = require("../models/TVShow");
const Episode = require("../models/Episode");
const { buildTasteProfile, matchPercent, movieItem, showItem } = require("./recommendations");
const {
  fold,
  matchField,
  suggestSpelling,
  tokenize,
} = require("./searchText");

/**
 * Catalogue search.
 *
 * What the old search was: a `$regex` over Movie.title, on the Movie collection
 * only. That meant one typo returned nothing, the TVShow catalogue the admin app
 * manages was unreachable from the search box entirely, episodes were invisible,
 * and results came back in whatever order Mongo produced them.
 *
 * This replaces the lot. Four ideas, in order of how much they matter:
 *
 *   1. Recall — two retrieval passes, unioned. A regex pass finds substring hits
 *      anywhere in the catalogue; a popularity pass loads a bounded pool that
 *      the *fuzzy* matcher can reach, because no regex will ever match "totro"
 *      against "Totoro".
 *   2. Relevance — searchText.matchField scores each field by the shape of the
 *      match (exact / prefix / word-prefix / substring / acronym / fuzzy), and
 *      fields are weighted: a title hit is worth far more than a synopsis hit.
 *   3. Intent — the query is parsed before it is matched, so "top rated horror
 *      series from 2019" narrows by genre, kind, year *and* sort instead of
 *      being matched literally against titles that contain none of those words.
 *   4. Ranking — relevance dominates, then quality, popularity and the viewer's
 *      own taste break ties, so two equally-relevant titles are ordered by which
 *      one this person is more likely to press play on.
 */

// --- tuning ------------------------------------------------------------------

/** Field weights. Relevance is `max` over fields, not a sum. */
const FIELDS = {
  title: 1,
  showTitle: 0.62, // an episode's parent show
  tags: 0.42,
  genres: 0.38,
  overview: 0.2,
};

/**
 * How much each signal can add on top of relevance.
 *
 * Deliberately small next to the relevance term (which is 0..1 and multiplied by
 * RELEVANCE_WEIGHT): these break ties between comparable matches, they do not
 * promote a weak match over a strong one. Search is not the home feed — someone
 * typing a title wants *that title*, however unpopular it is.
 */
const SIGNALS = {
  quality: 0.3,
  popularity: 0.26,
  affinity: 0.22,
  inMyList: 0.2,
  started: 0.12,
  freshness: 0.1,
  /**
   * Naming an episode address ("s2e5") is the most specific thing anyone types
   * into a search box. Large enough that a fully-addressed episode outranks its
   * own parent show — "the wire s2e5" wants the player, not the show page — but
   * still a bonus rather than a filter, so the show remains the result directly
   * below it when that episode is not published.
   */
  address: 1.6,
};

const RELEVANCE_WEIGHT = 4;

/** Below this a match is noise — a single fuzzy token against a long title. */
const MIN_RELEVANCE = 0.16;

/**
 * Relevance given to every candidate when the query left nothing to match on —
 * "horror series" is all filter and no text. Below MIN_RELEVANCE so a title that
 * *does* contain one of those words still sorts above the browse pool.
 */
const BROWSE_RELEVANCE = 0.12;

/** Under this, the top hit is weak enough that a spelling fix is worth offering. */
const DID_YOU_MEAN_CEILING = 0.62;

const LIMITS = {
  regexMovies: 220,
  regexShows: 220,
  regexEpisodes: 140,
  poolMovies: 320,
  poolShows: 320,
  results: 120,
};

/** Vocabulary and popularity pools change far slower than people type. */
const CACHE_TTL_MS = 60_000;

const MOVIE_FIELDS =
  "title desc img imgSm imgTitle trailer video year limit genre isSeries duration views avgRating numRatings createdAt";
const SHOW_FIELDS =
  "title overview poster backdrop trailerUrl genres tags status rating releaseYear seasonsCount episodesCount lastAirDate views createdAt";
const EPISODE_FIELDS =
  "showId seasonId seasonNumber episodeNumber title overview airDate duration stillPath published createdAt";

// --- query understanding -----------------------------------------------------

/** Words that name a collection rather than a title. */
const KIND_TERMS = new Map([
  ["movie", "movie"],
  ["movies", "movie"],
  ["film", "movie"],
  ["films", "movie"],
  ["series", "show"],
  ["serie", "show"],
  ["show", "show"],
  ["shows", "show"],
  ["tv", "show"],
  ["season", "show"],
  ["seasons", "show"],
  ["episode", "episode"],
  ["episodes", "episode"],
]);

const KIND_LABELS = { movie: "Movies", show: "Series", episode: "Episodes" };

/** Longest first, so "top rated" is consumed before "top". */
const SORT_PHRASES = [
  { phrase: "most watched", sort: "popular" },
  { phrase: "highest rated", sort: "rating" },
  { phrase: "recently added", sort: "newest" },
  { phrase: "best rated", sort: "rating" },
  { phrase: "top rated", sort: "rating" },
  { phrase: "trending", sort: "popular" },
  { phrase: "popular", sort: "popular" },
  { phrase: "newest", sort: "newest" },
  { phrase: "latest", sort: "newest" },
  { phrase: "recent", sort: "newest" },
  { phrase: "new", sort: "newest" },
];

const SORT_LABELS = {
  relevance: "Best match",
  rating: "Top rated",
  popular: "Most watched",
  newest: "Recently added",
  year: "Newest releases",
  az: "A–Z",
};

const STATUS_TERMS = new Map([
  ["ongoing", "ongoing"],
  ["airing", "ongoing"],
  ["running", "ongoing"],
  ["ended", "ended"],
  ["complete", "ended"],
  ["completed", "ended"],
  ["finished", "ended"],
]);

/** Prepositions that only ever glue a filter to the query. */
const CONNECTORS = new Set(["from", "in", "of", "the", "on", "with", "by", "for"]);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleCase(value) {
  return String(value)
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/**
 * Pulls structure out of a free-text query.
 *
 * Returns the residual `text` (what is left to match against titles) alongside
 * the filters it recognised and a human-readable account of each one, which the
 * UI renders as removable chips — a filter the viewer cannot see applied is a
 * filter they cannot argue with.
 *
 * Extraction is never destructive: callers score candidates against *both* the
 * residual and the raw query and keep the better of the two, so a title that
 * genuinely contains the word "Movies" is not lost to the parser.
 */
function parseQuery(raw, { genres = [] } = {}) {
  const folded = fold(raw);
  const filters = {
    kind: null,
    genres: [],
    year: null,
    yearFrom: null,
    yearTo: null,
    status: null,
    sort: null,
    seasonNumber: null,
    episodeNumber: null,
    sortExplicit: false,
  };
  const understood = [];

  if (!folded) {
    return { raw: String(raw ?? "").trim(), text: "", tokens: [], filters, understood };
  }

  let working = ` ${folded} `;
  const consume = (phrase) => {
    const needle = ` ${phrase} `;
    if (!working.includes(needle)) return false;
    working = working.replace(needle, " ");
    return true;
  };

  // Genres first, and longest first, so "science fiction" is taken whole rather
  // than leaving "fiction" behind as a stray title token.
  const genreVocab = [...genres].sort((a, b) => b.value.length - a.value.length);
  for (const genre of genreVocab) {
    if (filters.genres.includes(genre.value)) continue;
    if (consume(genre.value)) {
      filters.genres.push(genre.value);
      understood.push({ type: "genre", value: genre.value, label: genre.label });
    }
  }

  for (const entry of SORT_PHRASES) {
    if (filters.sort) break;
    if (consume(entry.phrase)) {
      filters.sort = entry.sort;
      understood.push({ type: "sort", value: entry.sort, label: SORT_LABELS[entry.sort] });
    }
  }

  const rest = working.trim().split(/\s+/).filter(Boolean);
  const kept = [];

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    const next = rest[index + 1];

    // "s02e05", "s2e5", "2x05" — one token that addresses an episode outright.
    const address = /^s(\d{1,2})e(\d{1,3})$/.exec(token) || /^(\d{1,2})x(\d{1,3})$/.exec(token);
    if (address) {
      filters.seasonNumber = Number(address[1]);
      filters.episodeNumber = Number(address[2]);
      understood.push({
        type: "episode",
        value: `${filters.seasonNumber}:${filters.episodeNumber}`,
        label: `S${filters.seasonNumber}:E${filters.episodeNumber}`,
      });
      continue;
    }

    // "season 2" / "episode 5" — the number belongs to the word before it, so
    // both are taken together and neither is left behind as a title token.
    if (/^(season|seasons)$/.test(token) && /^\d{1,2}$/.test(next || "")) {
      filters.seasonNumber = Number(next);
      filters.kind = filters.kind || "show";
      understood.push({ type: "season", value: filters.seasonNumber, label: `Season ${next}` });
      index += 1;
      continue;
    }

    if (/^(episode|episodes|ep)$/.test(token) && /^\d{1,3}$/.test(next || "")) {
      filters.episodeNumber = Number(next);
      understood.push({ type: "episode", value: filters.episodeNumber, label: `Episode ${next}` });
      index += 1;
      continue;
    }

    if (/^s(\d{1,2})$/.test(token) && rest.length > 1 && !filters.seasonNumber) {
      filters.seasonNumber = Number(token.slice(1));
      understood.push({ type: "season", value: filters.seasonNumber, label: `Season ${filters.seasonNumber}` });
      continue;
    }

    if (!filters.kind && KIND_TERMS.has(token)) {
      filters.kind = KIND_TERMS.get(token);
      understood.push({ type: "kind", value: filters.kind, label: KIND_LABELS[filters.kind] });
      continue;
    }

    if (!filters.status && STATUS_TERMS.has(token)) {
      filters.status = STATUS_TERMS.get(token);
      understood.push({
        type: "status",
        value: filters.status,
        label: filters.status === "ended" ? "Complete" : "Ongoing",
      });
      continue;
    }

    // "2010s", "90s" — a decade, not a title.
    const decade = /^(\d{2}|\d{4})s$/.exec(token);
    if (decade && !filters.yearFrom) {
      const digits = Number(decade[1]);
      const start = digits < 100 ? (digits >= 30 ? 1900 + digits : 2000 + digits) : digits;
      filters.yearFrom = start;
      filters.yearTo = start + 9;
      understood.push({ type: "decade", value: start, label: `${start}s` });
      continue;
    }

    const year = /^(19|20)\d{2}$/.test(token) ? Number(token) : null;
    if (year && !filters.year) {
      filters.year = year;
      understood.push({ type: "year", value: year, label: String(year) });
      continue;
    }

    kept.push(token);
  }

  // A connector only ever glued a filter to the query; on its own it is not a
  // title. Kept when it is *all* that is left and nothing else was recognised,
  // so searching for "The" still searches for "The".
  const meaningful = kept.filter((token) => !CONNECTORS.has(token));
  const text = (meaningful.length || understood.length ? meaningful : kept).join(" ");

  return {
    raw: String(raw ?? "").trim(),
    text,
    tokens: text ? text.split(" ") : [],
    filters,
    understood,
  };
}

/** Explicit query-string filters win over anything inferred from the text. */
function applyOverrides(parsed, overrides = {}) {
  const filters = { ...parsed.filters, genres: [...parsed.filters.genres] };
  const understood = parsed.understood.filter((entry) => !(entry.type in overrides));

  if (overrides.kind) {
    filters.kind = overrides.kind;
    understood.push({ type: "kind", value: overrides.kind, label: KIND_LABELS[overrides.kind] });
  }
  if (overrides.genre) {
    filters.genres = [overrides.genre];
    understood.push({ type: "genre", value: overrides.genre, label: titleCase(overrides.genre) });
  }
  if (overrides.year) {
    filters.year = overrides.year;
    filters.yearFrom = null;
    filters.yearTo = null;
    understood.push({ type: "year", value: overrides.year, label: String(overrides.year) });
  }
  if (overrides.decade) {
    filters.yearFrom = overrides.decade;
    filters.yearTo = overrides.decade + 9;
    filters.year = null;
    understood.push({ type: "decade", value: overrides.decade, label: `${overrides.decade}s` });
  }
  if (overrides.sort) {
    filters.sort = overrides.sort;
    filters.sortExplicit = true;
  }

  return { ...parsed, filters, understood };
}

// --- retrieval ---------------------------------------------------------------

const cache = { at: 0, genres: null, vocabulary: null, pool: null };
const profileCache = new Map();

function cacheable(key, value) {
  const now = Date.now();
  if (now - cache.at > CACHE_TTL_MS) {
    cache.at = now;
    cache.genres = null;
    cache.vocabulary = null;
    cache.pool = null;
  }
  if (value !== undefined) cache[key] = value;
  return cache[key];
}

/** Every genre the catalogue actually publishes, from both collections. */
async function genreVocabulary() {
  const cached = cacheable("genres");
  if (cached) return cached;

  const [movieGenres, showGenres] = await Promise.all([
    Movie.distinct("genre"),
    TVShow.distinct("genres", { published: true }),
  ]);

  const counts = new Map();
  for (const value of [...movieGenres, ...showGenres]) {
    if (!value) continue;
    const key = fold(value);
    if (!key) continue;
    if (!counts.has(key)) counts.set(key, { value: key, label: titleCase(String(value).trim()) });
  }

  const list = [...counts.values()].sort((a, b) => a.value.localeCompare(b.value));
  return cacheable("genres", list);
}

/**
 * Every word that appears in a title, with how many titles use it.
 *
 * The corpus "did you mean" corrects against. Frequency breaks ties so a typo
 * equidistant from two catalogue words resolves to the one people are more
 * likely to have been aiming at.
 */
async function titleVocabulary() {
  const cached = cacheable("vocabulary");
  if (cached) return cached;

  const [movies, shows] = await Promise.all([
    Movie.find({}).select("title").limit(2000).lean(),
    TVShow.find({ published: true }).select("title").limit(2000).lean(),
  ]);

  const vocabulary = new Map();
  for (const doc of [...movies, ...shows]) {
    for (const token of tokenize(doc.title)) {
      if (token.length < 3) continue;
      vocabulary.set(token, (vocabulary.get(token) || 0) + 1);
    }
  }

  return cacheable("vocabulary", vocabulary);
}

/**
 * The pool the fuzzy matcher can reach.
 *
 * Regex recall cannot find a misspelling, so a bounded slice of the catalogue is
 * always loaded alongside it and compared by edit distance. Ordered by views so
 * the cap only ever drops titles that are both unwatched and old.
 */
async function popularityPool() {
  const cached = cacheable("pool");
  if (cached) return cached;

  const [movies, shows] = await Promise.all([
    Movie.find({}).select(MOVIE_FIELDS).sort({ views: -1, createdAt: -1 }).limit(LIMITS.poolMovies).lean(),
    TVShow.find({ published: true })
      .select(SHOW_FIELDS)
      .sort({ views: -1, createdAt: -1 })
      .limit(LIMITS.poolShows)
      .lean(),
  ]);

  return cacheable("pool", { movies, shows });
}

/**
 * Word-prefix regexes, one per token.
 *
 * `(^|[^a-z0-9])` rather than `\b` so "del" recalls "Kiki's Delivery Service"
 * but "elivery" does not — a mid-word substring is almost always a coincidence
 * at recall width, and the ranker can still reach real ones through the pool.
 */
function recallPatterns(tokens) {
  return tokens
    .filter((token) => token.length >= 2)
    .slice(0, 6)
    .map((token) => new RegExp(`(^|[^a-zA-Z0-9])${escapeRegex(token)}`, "i"));
}

async function recall(parsed) {
  const tokens = parsed.tokens.length ? parsed.tokens : tokenize(parsed.raw);
  const patterns = recallPatterns(tokens);
  const wantsEpisodes = parsed.filters.kind !== "movie";
  const wantsMovies = parsed.filters.kind !== "show" && parsed.filters.kind !== "episode";
  const wantsShows = parsed.filters.kind !== "movie" && parsed.filters.kind !== "episode";

  const pool = await popularityPool();

  if (!patterns.length) {
    return {
      movies: wantsMovies ? pool.movies : [],
      shows: wantsShows ? pool.shows : [],
      episodes: [],
    };
  }

  const [movies, shows, episodes] = await Promise.all([
    wantsMovies
      ? Movie.find({
          $or: [
            { title: { $in: patterns } },
            { genre: { $in: patterns } },
            { desc: { $in: patterns } },
          ],
        })
          .select(MOVIE_FIELDS)
          .limit(LIMITS.regexMovies)
          .lean()
      : [],
    wantsShows
      ? TVShow.find({
          published: true,
          $or: [
            { title: { $in: patterns } },
            { genres: { $in: patterns } },
            { tags: { $in: patterns } },
            { overview: { $in: patterns } },
          ],
        })
          .select(SHOW_FIELDS)
          .limit(LIMITS.regexShows)
          .lean()
      : [],
    wantsEpisodes
      ? Episode.find({
          published: true,
          $or: [{ title: { $in: patterns } }, { overview: { $in: patterns } }],
        })
          .select(EPISODE_FIELDS)
          .limit(LIMITS.regexEpisodes)
          .lean()
      : [],
  ]);

  return {
    movies: wantsMovies ? dedupe([...movies, ...pool.movies]) : [],
    shows: wantsShows ? dedupe([...shows, ...pool.shows]) : [],
    episodes,
  };
}

function dedupe(docs) {
  const seen = new Set();
  const out = [];
  for (const doc of docs) {
    const key = String(doc._id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(doc);
  }
  return out;
}

/** Taste is the same for a whole burst of keystrokes; rebuilding it per key is not. */
async function cachedProfile(userId) {
  if (!userId) return buildTasteProfile(null);

  const key = String(userId);
  const hit = profileCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.profile;

  const profile = await buildTasteProfile(userId);
  profileCache.set(key, { at: Date.now(), profile });

  // Bounded: this is a per-process cache, not a store.
  if (profileCache.size > 200) {
    for (const [candidate, entry] of profileCache) {
      if (Date.now() - entry.at > CACHE_TTL_MS) profileCache.delete(candidate);
    }
  }

  return profile;
}

// --- normalisation -----------------------------------------------------------

/**
 * An episode, in the same envelope as a title.
 *
 * Episodes are the one result kind that is not a catalogue entry: the thing
 * being named is "S2:E7 of a show", so it carries its parent's artwork and links
 * straight into the player rather than to a details page.
 */
function episodeItem(doc, show) {
  const code = `S${doc.seasonNumber}:E${doc.episodeNumber}`;
  return {
    uid: `episode:${doc._id}`,
    id: String(doc._id),
    kind: "episode",
    filterKind: "episode",
    badge: "Episode",
    title: doc.title,
    subtitle: show ? `${show.title} · ${code}` : code,
    overview: doc.overview || "",
    poster: doc.stillPath || show?.backdrop || show?.poster || "",
    backdrop: doc.stillPath || show?.backdrop || show?.poster || "",
    genres: (show?.genres || []).map((genre) => fold(genre)).filter(Boolean),
    genreLabels: show?.genres?.filter(Boolean) || [],
    year: doc.airDate ? new Date(doc.airDate).getFullYear() || null : show?.releaseYear || null,
    runtime: doc.duration ? `${doc.duration}m` : "",
    rating10: null,
    ratingNormalised: 0,
    ratingVotes: 0,
    views: show?.views || 0,
    addedAt: doc.createdAt || null,
    href: `/watch/episode/${doc._id}`,
    playHref: `/watch/episode/${doc._id}`,
    showId: show ? String(show._id) : null,
    showTitle: show?.title || "",
    episodeCode: code,
    seasonNumber: doc.seasonNumber,
    episodeNumber: doc.episodeNumber,
  };
}

/**
 * Which collection a viewer would say a title belongs to.
 *
 * Not the same as `kind`: legacy Movie rows carry an `isSeries` flag and are
 * labelled "Series" in every card, so a "series" filter that ignored them would
 * hide titles the UI has already called series.
 */
function filterKindOf(item, doc) {
  if (item.kind === "show") return "show";
  return doc?.isSeries ? "show" : "movie";
}

// --- ranking -----------------------------------------------------------------

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function bayesian(rating, votes, mean = 0.55, prior = 6) {
  const r = Number(rating);
  const v = Math.max(0, Number(votes) || 0);
  if (!Number.isFinite(r) || r <= 0 || v <= 0) return mean;
  return (v * clamp01(r) + prior * mean) / (v + prior);
}

function genreAffinity(genres, taste) {
  if (!genres?.length || !taste?.size) return 0;
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
 * Relevance of one candidate to one query.
 *
 * Scored against the residual text *and* the raw query, keeping whichever is
 * stronger. That is what makes the parser safe to be aggressive: if it stripped
 * "Movies" out of a search for a title actually called "Movies", the raw pass
 * still finds it, and the only cost is a hair of score.
 */
function relevanceOf(item, parsed) {
  const queries = [];
  if (parsed.text) queries.push({ query: parsed.text, weight: 1 });
  if (parsed.raw && fold(parsed.raw) !== fold(parsed.text || "")) {
    queries.push({ query: parsed.raw, weight: 0.98 });
  }
  if (!queries.length) return null;

  let best = null;

  for (const { query, weight } of queries) {
    const fields = [
      { name: "title", value: item.title, weight: FIELDS.title },
      { name: "showTitle", value: item.showTitle, weight: FIELDS.showTitle },
      { name: "genres", value: item.genreLabels?.join(" "), weight: FIELDS.genres },
      { name: "tags", value: item.tagLabels?.join(" "), weight: FIELDS.tags },
      { name: "overview", value: item.overview, weight: FIELDS.overview },
    ];

    for (const field of fields) {
      if (!field.value) continue;
      const hit = matchField(query, field.value, { fuzzy: field.name === "title" });
      if (!hit) continue;

      const score = hit.score * field.weight * weight;
      if (!best || score > best.score) {
        best = {
          score,
          field: field.name,
          tier: hit.tier,
          ranges: field.name === "title" ? hit.ranges : [],
        };
      }
    }
  }

  return best;
}

/**
 * How well an episode answers a "s2e5"-shaped query.
 *
 * Only episodes can score here — a show is neither promoted nor punished by an
 * address, since it is where the viewer goes if the exact episode is not
 * published. An episode that contradicts the address is pushed below one that
 * has no opinion, which is what keeps S1:E1 off the top of an "s2e5" search.
 */
function addressBonus(item, filters) {
  if (item.kind !== "episode") return 0;
  if (!filters.seasonNumber && !filters.episodeNumber) return 0;

  let score = 0;
  if (filters.seasonNumber) {
    score += item.seasonNumber === filters.seasonNumber ? 0.5 : -0.5;
  }
  if (filters.episodeNumber) {
    score += item.episodeNumber === filters.episodeNumber ? 0.5 : -0.5;
  }
  return score;
}

/** Does this candidate satisfy every filter the query asked for? */
function passesFilters(item, filters) {
  if (filters.kind && item.filterKind !== filters.kind) return false;

  if (filters.genres.length) {
    const owned = new Set(item.genres || []);
    if (!filters.genres.every((genre) => owned.has(genre))) return false;
  }

  if (filters.status && item.status && item.status !== filters.status) return false;
  if (filters.status && !item.status) return false;

  if (filters.year && item.year !== filters.year) return false;
  if (filters.yearFrom && (!item.year || item.year < filters.yearFrom)) return false;
  if (filters.yearTo && (!item.year || item.year > filters.yearTo)) return false;

  return true;
}

const SORTERS = {
  rating: (a, b) => (b.item.rating10 || 0) - (a.item.rating10 || 0) || b.score - a.score,
  popular: (a, b) => (b.item.views || 0) - (a.item.views || 0) || b.score - a.score,
  newest: (a, b) => stamp(b.item.addedAt) - stamp(a.item.addedAt) || b.score - a.score,
  year: (a, b) => (b.item.year || 0) - (a.item.year || 0) || b.score - a.score,
  az: (a, b) => String(a.item.title).localeCompare(String(b.item.title)),
};

function stamp(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

/**
 * Ranks a candidate pool against a parsed query.
 *
 * Filters are applied as a *partition*, not a cut: candidates that satisfy every
 * filter sort above those that do not, and the rest are kept behind them. A
 * search for "horror 2019" that matches nothing in 2019 shows the horror titles
 * rather than an empty page, and the UI can say which filter it had to relax.
 */
function rank(items, parsed, context) {
  const { profile, maxViews, meanRating, sort } = context;
  const taste = profile?.taste || new Map();
  const now = Date.now();
  /** Nothing left to match on: the query was empty, or it was all filters. */
  const browsing = !parsed.text;

  const scored = [];
  let filtered = 0;

  for (const item of items) {
    const hit = relevanceOf(item, parsed);
    let relevance = hit;

    if (!relevance || relevance.score < MIN_RELEVANCE) {
      // A query that was entirely filters ("horror series") leaves nothing to
      // match against, so every candidate is admitted at a flat relevance and
      // the ordering falls to the filters and the signals. A query that *did*
      // carry text and still failed to match is simply not a result.
      if (!browsing) continue;
      relevance = { score: BROWSE_RELEVANCE, field: "browse", tier: "browse", ranges: [] };
    }

    const quality = bayesian(item.ratingNormalised, item.ratingVotes, meanRating);
    const popularity =
      maxViews > 0 ? clamp01(Math.log1p(item.views || 0) / Math.log1p(maxViews)) : 0;
    const affinity = genreAffinity(item.genres, taste);
    const freshness = item.addedAt
      ? clamp01(1 - (now - stamp(item.addedAt)) / (180 * 24 * 60 * 60 * 1000))
      : 0;

    const passes = passesFilters(item, parsed.filters);
    if (passes) filtered += 1;

    const score =
      RELEVANCE_WEIGHT * relevance.score +
      SIGNALS.quality * quality +
      SIGNALS.popularity * popularity +
      SIGNALS.affinity * affinity +
      SIGNALS.freshness * freshness +
      SIGNALS.address * addressBonus(item, parsed.filters) +
      (item.inMyList ? SIGNALS.inMyList : 0) +
      (item.started && !item.watched ? SIGNALS.started : 0);

    scored.push({
      item,
      score,
      passes,
      relevance,
      parts: { affinity, quality, popularity, collab: 0 },
    });
  }

  const comparator = SORTERS[sort];
  const order = comparator || ((a, b) => b.score - a.score);

  scored.sort((a, b) => {
    // Only partition when the filters actually selected something; otherwise the
    // partition is a no-op that costs a comparison.
    if (filtered > 0 && a.passes !== b.passes) return a.passes ? -1 : 1;
    return order(a, b);
  });

  return { scored, filtered };
}

// --- facets ------------------------------------------------------------------

function buildFacets(scored) {
  const kinds = new Map();
  const genres = new Map();
  const decades = new Map();

  for (const { item } of scored) {
    kinds.set(item.filterKind, (kinds.get(item.filterKind) || 0) + 1);

    for (const [index, genre] of (item.genres || []).entries()) {
      if (!genre) continue;
      // Title-cased even when the source has a label: genres are authored by
      // hand in two collections, so the same facet arrives as "Animation" from
      // one and "action" from the other, and a filter list in mixed case reads
      // as two different kinds of thing.
      const label = titleCase(item.genreLabels?.[index] || genre);
      const entry = genres.get(genre) || { value: genre, label, count: 0 };
      entry.count += 1;
      genres.set(genre, entry);
    }

    if (item.year) {
      const decade = Math.floor(item.year / 10) * 10;
      decades.set(decade, (decades.get(decade) || 0) + 1);
    }
  }

  return {
    kinds: [...kinds.entries()]
      .map(([value, count]) => ({ value, label: KIND_LABELS[value] || titleCase(value), count }))
      .sort((a, b) => b.count - a.count),
    genres: [...genres.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    decades: [...decades.entries()]
      .map(([value, count]) => ({ value, label: `${value}s`, count }))
      .sort((a, b) => b.value - a.value),
  };
}

// --- presentation ------------------------------------------------------------

/** One line on why this result is in front of this viewer. */
function reasonFor(entry, profile) {
  const { item, parts, relevance } = entry;
  if (item.inMyList) return "In your list";
  if (item.started && !item.watched) return "Continue watching";
  if (item.watched) return "You've watched this";
  if (relevance.field === "genres" || relevance.field === "tags") return "Matches the genre";
  if (relevance.field === "overview") return "Mentioned in the synopsis";
  if (relevance.field === "showTitle") return `From ${item.showTitle}`;
  if (profile?.personalised && parts.affinity > 0.5) {
    const genre = item.genreLabels?.[0];
    return genre ? `Because you watch ${titleCase(genre)}` : null;
  }
  return null;
}

function metaOf(item) {
  const parts = [];
  if (item.year) parts.push(String(item.year));
  if (item.kind === "show") {
    if (item.seasonsCount) {
      parts.push(`${item.seasonsCount} Season${item.seasonsCount === 1 ? "" : "s"}`);
    } else if (item.episodesCount) {
      parts.push(`${item.episodesCount} Episode${item.episodesCount === 1 ? "" : "s"}`);
    }
    if (item.status === "ended") parts.push("Complete");
  } else if (item.runtime) {
    parts.push(item.runtime);
  }
  return parts;
}

/**
 * The wire shape. Deliberately not the internal item: `ratingNormalised` and
 * `ratingVotes` are inputs to the Bayesian shrink on a scale that means nothing
 * outside it, and `score` is only comparable within one response.
 */
function present(entry, profile) {
  const { item, relevance } = entry;
  return {
    uid: item.uid,
    id: item.id,
    kind: item.kind,
    filterKind: item.filterKind,
    badge: item.badge,
    title: item.title,
    subtitle: item.subtitle || "",
    overview: item.overview || "",
    poster: item.poster || "",
    backdrop: item.backdrop || "",
    year: item.year ?? null,
    genreLabels: item.genreLabels || [],
    meta: metaOf(item),
    runtime: item.runtime || "",
    seasonsCount: item.seasonsCount ?? null,
    episodesCount: item.episodesCount ?? null,
    status: item.status || null,
    rating10: item.rating10 ?? null,
    maturity: item.maturity ?? null,
    views: item.views || 0,
    href: item.href,
    playHref: item.playHref || null,
    inMyList: Boolean(item.inMyList),
    watched: Boolean(item.watched),
    started: Boolean(item.started),
    episodeCode: item.episodeCode || null,
    showTitle: item.showTitle || null,
    match: matchPercent(entry.parts, profile?.personalised),
    /** Character ranges in `title` the query matched, for highlighting. */
    highlight: relevance.ranges || [],
    matchedOn: relevance.field,
    reason: reasonFor(entry, profile),
  };
}

// --- entry point -------------------------------------------------------------

/**
 * Runs one search end to end.
 *
 * `overrides` are the explicit filters the results page sets from its facet
 * rail; they win over anything the parser inferred from the text, because a
 * viewer who clicked "Movies" means it more than a viewer who typed it.
 */
async function search(rawQuery, { userId = null, overrides = {}, limit = LIMITS.results } = {}) {
  const genres = await genreVocabulary();
  const parsed = applyOverrides(parseQuery(rawQuery, { genres }), overrides);
  const hasQuery = Boolean(parsed.raw);

  const [pool, profile] = await Promise.all([recall(parsed), cachedProfile(userId)]);

  // Episodes borrow their parent's artwork, genres and year, so the shows behind
  // any matched episode are resolved in one query rather than per row.
  const showIds = [...new Set(pool.episodes.map((doc) => String(doc.showId)).filter(Boolean))];
  const parents = showIds.length
    ? await TVShow.find({ _id: { $in: showIds }, published: true }).select(SHOW_FIELDS).lean()
    : [];
  const parentById = new Map(parents.map((doc) => [String(doc._id), doc]));

  const items = [];

  for (const doc of pool.movies) {
    const item = movieItem(doc);
    item.filterKind = filterKindOf(item, doc);
    item.tagLabels = [];
    item.inMyList = profile.myListMovies.has(item.id);
    item.watched = profile.watchedMovies.has(item.id);
    item.started = profile.startedMovies.has(item.id);
    items.push(item);
  }

  for (const doc of pool.shows) {
    const item = showItem(doc);
    item.filterKind = "show";
    item.tagLabels = Array.isArray(doc.tags) ? doc.tags.filter(Boolean) : [];
    item.inMyList = profile.myListShows.has(item.id);
    item.watched = profile.watchedShows.has(item.id);
    item.started = profile.startedShows.has(item.id);
    items.push(item);
  }

  for (const doc of pool.episodes) {
    const show = parentById.get(String(doc.showId));
    if (!show) continue; // parent unpublished: the episode is not reachable either
    const item = episodeItem(doc, show);
    item.tagLabels = [];
    item.inMyList = false;
    item.watched = profile.watchedShows.has(item.showId);
    item.started = profile.startedShows.has(item.showId);
    items.push(item);
  }

  let maxViews = 0;
  let ratingTotal = 0;
  let ratedCount = 0;
  for (const item of items) {
    if (item.views > maxViews) maxViews = item.views;
    if (item.ratingVotes > 0 && item.ratingNormalised > 0) {
      ratingTotal += item.ratingNormalised;
      ratedCount += 1;
    }
  }

  // A sort inferred from the words only takes effect when the query was *only*
  // filters. "New Girl" reads as sort=newest plus the text "girl", and
  // re-ordering by date there would bury the show the viewer plainly named —
  // whereas "newest series" has nothing to be relevant to and every reason to
  // be ordered by date.
  const inferredUsable = !parsed.text || parsed.filters.sortExplicit;
  const sort =
    (inferredUsable && parsed.filters.sort) || (hasQuery ? "relevance" : "popular");
  const { scored, filtered } = rank(items, parsed, {
    profile,
    maxViews,
    meanRating: ratedCount ? ratingTotal / ratedCount : 0.55,
    sort: sort === "relevance" ? null : sort,
  });

  // Filters partition rather than cut, so the tail below the partition is only
  // useful as a fallback — once anything passed, showing the rest would read as
  // the filter having been ignored.
  const kept = filtered > 0 ? scored.filter((entry) => entry.passes) : scored;

  let didYouMean = null;
  const best = kept[0];
  if (hasQuery && parsed.text && (!best || best.relevance.score < DID_YOU_MEAN_CEILING)) {
    const vocabulary = await titleVocabulary();
    const suggestion = suggestSpelling(parsed.text, vocabulary);
    if (suggestion && fold(suggestion) !== fold(parsed.text)) didYouMean = suggestion;
  }

  return {
    query: parsed.raw,
    text: parsed.text,
    understood: parsed.understood,
    filters: parsed.filters,
    sort,
    didYouMean,
    /** True when no candidate satisfied every filter and they had to be relaxed. */
    relaxed: filtered === 0 && parsed.understood.length > 0 && scored.length > 0,
    facets: buildFacets(kept),
    total: kept.length,
    results: kept.slice(0, limit).map((entry) => present(entry, profile)),
    profile: { personalised: profile.personalised },
  };
}

/** Zero state: what to offer someone who has opened the box but not typed. */
async function browseSuggestions({ userId = null, limit = 12 } = {}) {
  const [genres, result] = await Promise.all([
    genreVocabulary(),
    search("", { userId, limit }),
  ]);

  const counted = new Map(result.facets.genres.map((facet) => [facet.value, facet.count]));

  return {
    trending: result.results,
    genres: genres
      .map((genre) => ({ ...genre, count: counted.get(genre.value) || 0 }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 14),
  };
}

module.exports = {
  DID_YOU_MEAN_CEILING,
  FIELDS,
  KIND_LABELS,
  MIN_RELEVANCE,
  SIGNALS,
  SORT_LABELS,
  applyOverrides,
  browseSuggestions,
  buildFacets,
  episodeItem,
  filterKindOf,
  parseQuery,
  passesFilters,
  rank,
  relevanceOf,
  search,
};
