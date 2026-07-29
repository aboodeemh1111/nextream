const router = require("express").Router();
const mongoose = require("mongoose");
const optionalAuth = require("../optionalAuth");
const { catalogueSnapshot } = require("../services/corpus");
const { browseSuggestions, search } = require("../services/search");

/**
 * Catalogue search.
 *
 * Two endpoints for two very different callers:
 *
 *   GET /search/suggest  the box itself — grouped, capped, and shaped for a
 *                        panel that repaints on every keystroke.
 *   GET /search          the results page — paginated, with the facets it needs
 *                        to offer a refinement.
 *
 * Both run the same engine over the same pool, so the panel and the page can
 * never disagree about what the top result is.
 *
 * optionalAuth rather than verify. The old /movies/search was behind a token,
 * which meant a signed-out visitor searching the catalogue got a 401 — and the
 * ranking is *better* with a viewer, not dependent on one.
 */

router.use(optionalAuth);

/** How many of each kind the instant panel will show. */
const PANEL = { total: 14, movie: 6, show: 6, episode: 4 };

const GROUPS = [
  { key: "movie", title: "Movies" },
  { key: "show", title: "Series" },
  { key: "episode", title: "Episodes" },
];

const SORTS = new Set(["relevance", "rating", "popular", "newest", "year", "az"]);
const KINDS = new Set(["movie", "show", "episode"]);

function fail(res, code, err) {
  console.error(`${code}:`, err);
  return res.status(500).json({ error: code, message: err.message });
}

/**
 * An empty feed beats a 500 when there is no database.
 *
 * Local dev regularly runs the client without Mongo, and a search box that
 * throws a red overlay on every keystroke is far worse than one that finds
 * nothing.
 */
function offline(res, extra = {}) {
  return res.status(200).json({
    query: "",
    understood: [],
    didYouMean: null,
    total: 0,
    results: [],
    degraded: "DB_UNAVAILABLE",
    ...extra,
  });
}

/** Explicit refinements from the results page's facet rail. */
function overridesFrom(query) {
  const overrides = {};

  if (query.kind && KINDS.has(String(query.kind))) overrides.kind = String(query.kind);
  if (query.genre) overrides.genre = String(query.genre).trim().toLowerCase();

  const year = Number(query.year);
  if (Number.isInteger(year) && year >= 1870 && year <= 2100) overrides.year = year;

  const decade = Number(query.decade);
  if (Number.isInteger(decade) && decade >= 1870 && decade <= 2100) {
    overrides.decade = Math.floor(decade / 10) * 10;
  }

  if (query.sort && SORTS.has(String(query.sort)) && query.sort !== "relevance") {
    overrides.sort = String(query.sort);
  }

  return overrides;
}

/**
 * The instant panel.
 *
 * Results are grouped *after* ranking, not fetched per group: taking the best
 * fourteen overall and then bucketing them means a query that is unambiguously
 * about one collection fills the panel with that collection, instead of every
 * search reserving five rows for series that do not match.
 */
router.get("/suggest", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return offline(res, { top: null, groups: [], genres: [], trending: [] });
    }

    const raw = String(req.query.q ?? "").trim();
    const userId = req.user?.id || null;

    if (!raw) {
      const suggestions = await browseSuggestions({ userId, limit: 12 });
      return res.json({
        query: "",
        text: "",
        understood: [],
        didYouMean: null,
        relaxed: false,
        top: null,
        groups: [],
        total: 0,
        ...suggestions,
      });
    }

    const found = await search(raw, {
      userId,
      overrides: overridesFrom(req.query),
      limit: PANEL.total + 1,
    });

    const [top, ...rest] = found.results;
    const taken = { movie: 0, show: 0, episode: 0 };
    const buckets = { movie: [], show: [], episode: [] };

    for (const result of rest) {
      const key = result.filterKind;
      if (!buckets[key] || taken[key] >= PANEL[key]) continue;
      taken[key] += 1;
      buckets[key].push(result);
    }

    res.json({
      query: found.query,
      text: found.text,
      understood: found.understood,
      didYouMean: found.didYouMean,
      relaxed: found.relaxed,
      sort: found.sort,
      top: top || null,
      groups: GROUPS.filter((group) => buckets[group.key].length).map((group) => ({
        ...group,
        items: buckets[group.key],
      })),
      // The genres that actually appear in *these* results, so the panel can
      // offer a refinement that is guaranteed to return something.
      genres: found.facets.genres.slice(0, 6),
      total: found.total,
      trending: [],
    });
  } catch (err) {
    return fail(res, "SEARCH_SUGGEST_FAILED", err);
  }
});

/**
 * The catalogue as data, for a client that ranks it itself.
 *
 * The browser recommender needs the whole pool to build embeddings over — it
 * cannot learn that two titles are alike from a page of results that already
 * decided they were. Served with a strong ETag because the body is identical
 * for every caller: after the first visit this is a 304 and no bytes at all.
 */
router.get("/corpus", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res
        .status(200)
        .json({ schema: 1, count: 0, items: [], degraded: "DB_UNAVAILABLE" });
    }

    const { payload, etag } = await catalogueSnapshot();

    res.set("ETag", etag);
    // `public`: no viewer state is in here, so a shared cache holding it is
    // exactly what we want. `must-revalidate` keeps the ETag in play rather
    // than letting a stale copy serve silently past the window.
    res.set("Cache-Control", "public, max-age=300, must-revalidate");

    if (req.headers["if-none-match"] === etag) return res.status(304).end();

    res.json(payload);
  } catch (err) {
    return fail(res, "SEARCH_CORPUS_FAILED", err);
  }
});

/** The results page. Same ranking, paginated, with facets. */
router.get("/", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return offline(res, {
        facets: { kinds: [], genres: [], decades: [] },
        page: 1,
        pageSize: 24,
        hasMore: false,
      });
    }

    const raw = String(req.query.q ?? "").trim();
    const pageSize = Math.min(60, Math.max(1, Number(req.query.pageSize) || 24));
    const page = Math.max(1, Number(req.query.page) || 1);

    const found = await search(raw, {
      userId: req.user?.id || null,
      overrides: overridesFrom(req.query),
      // Only fetch as deep as the requested page: paging past the first is rare
      // enough that trimming every response to the deepest possible page would
      // be a cost paid on every search to serve almost none of them.
      limit: page * pageSize,
    });

    const start = (page - 1) * pageSize;

    res.json({
      query: found.query,
      text: found.text,
      understood: found.understood,
      filters: found.filters,
      sort: found.sort,
      didYouMean: found.didYouMean,
      relaxed: found.relaxed,
      facets: found.facets,
      total: found.total,
      page,
      pageSize,
      hasMore: start + pageSize < found.total,
      results: found.results.slice(start, start + pageSize),
      profile: found.profile,
    });
  } catch (err) {
    return fail(res, "SEARCH_FAILED", err);
  }
});

module.exports = router;
