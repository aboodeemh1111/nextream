const router = require("express").Router();
const mongoose = require("mongoose");
const optionalAuth = require("../optionalAuth");
const TVShow = require("../models/TVShow");
const Season = require("../models/Season");
const Episode = require("../models/Episode");
const User = require("../models/User");
const {
  EPISODE_CARD_FIELDS,
  computeNextUp,
  genreFilter,
  getContinueWatching,
  orderedEpisodes,
  progressByEpisode,
  similarShows,
  withProgress,
} = require("../services/tvCatalog");

// Public TV catalogue. Read-only by contract — routes/tvRouting.test.js asserts
// this router registers nothing but GET, so anything that writes belongs in
// routes/tvMe.js (viewer state) or routes/tvAdmin.js (editorial).
//
// Every handler takes optionalAuth: signed-out visitors get the plain
// catalogue, signed-in ones get the same shapes with progress and My List
// folded in, so the client needs one code path instead of two.
//
// Route order still matters: literal prefixes ("/genres", "/hub", "/episodes")
// are registered before the "/:showId" wildcard that would otherwise match them.

router.use(optionalAuth);

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

/** Named sorts the UI offers. Anything else falls through to mongoose verbatim,
 *  so existing callers passing "-createdAt" keep working. */
const SORTS = {
  trending: { views: -1, rating: -1, createdAt: -1 },
  popular: { views: -1, rating: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  recent: { lastAirDate: -1, updatedAt: -1 },
  rating: { rating: -1, views: -1 },
  year: { releaseYear: -1, title: 1 },
  az: { title: 1 },
  za: { title: -1 },
};

function resolveSort(sort) {
  if (!sort) return SORTS.trending;
  return SORTS[String(sort)] || String(sort);
}

function buildFilter(query) {
  const filter = { published: true };
  const { q, genre, status, year } = query;

  if (q) {
    const escaped = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = { $regex: escaped, $options: "i" };
    filter.$or = [{ title: rx }, { overview: rx }, { tags: rx }];
  }
  if (genre) filter.genres = genreFilter(genre);
  if (status) filter.status = String(status);
  if (year) filter.releaseYear = Number(year);

  return filter;
}

/** My List membership, resolved once per request rather than per card. */
async function myShowIds(req) {
  if (!req.user) return new Set();
  const user = await User.findById(req.user.id).select("myShows").lean();
  return new Set((user?.myShows || []).map(String));
}

function decorate(shows, inList) {
  return shows.map((show) => ({ ...show, inMyList: inList.has(String(show._id)) }));
}

// --- catalogue --------------------------------------------------------------

// Browse / grid. Paginated, filterable, and the source for infinite scroll.
router.get("/", async (req, res) => {
  try {
    const { page = 1, pageSize = 24, sort } = req.query;
    const size = Math.min(100, Math.max(1, Number(pageSize) || 24));
    const current = Math.max(1, Number(page) || 1);
    const filter = buildFilter(req.query);

    const [data, total, inList] = await Promise.all([
      TVShow.find(filter)
        .sort(resolveSort(sort))
        .skip((current - 1) * size)
        .limit(size)
        .lean(),
      TVShow.countDocuments(filter),
      myShowIds(req),
    ]);

    res.json({
      data: decorate(data, inList),
      page: current,
      pageSize: size,
      total,
      hasMore: current * size < total,
    });
  } catch (err) {
    return fail(res, "TV_LIST_FAILED", err);
  }
});

// Genre chips, with counts, derived from what is actually published.
router.get("/genres", async (req, res) => {
  try {
    const rows = await TVShow.aggregate([
      { $match: { published: true } },
      { $unwind: "$genres" },
      { $group: { _id: { $toLower: "$genres" }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);

    res.json(
      rows
        .filter((row) => row._id)
        .map((row) => ({
          value: row._id,
          label: row._id.charAt(0).toUpperCase() + row._id.slice(1),
          count: row.count,
        }))
    );
  } catch (err) {
    return fail(res, "TV_GENRES_FAILED", err);
  }
});

/** Shows whose newest published episode landed most recently. */
async function newEpisodeShows(limit) {
  const episodes = await Episode.find({ published: true })
    .select("showId title seasonNumber episodeNumber airDate createdAt")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const latestByShow = new Map();
  for (const episode of episodes) {
    const key = String(episode.showId);
    if (!latestByShow.has(key)) latestByShow.set(key, episode);
  }

  const showIds = [...latestByShow.keys()];
  if (!showIds.length) return [];

  const shows = await TVShow.find({ _id: { $in: showIds }, published: true }).lean();
  const showById = new Map(shows.map((s) => [String(s._id), s]));

  // showIds is already in newest-episode-first order.
  return showIds
    .map((id) =>
      showById.has(id) ? { ...showById.get(id), latestEpisode: latestByShow.get(id) } : null
    )
    .filter(Boolean)
    .slice(0, limit);
}

// One call for the whole landing view: hero plus every row, so the page paints
// in a single round trip instead of a waterfall of six.
router.get("/hub", async (req, res) => {
  try {
    const rowSize = Math.min(30, Math.max(6, Number(req.query.rowSize) || 20));
    const userId = req.user?.id;

    const [trending, topRated, newest, fresh, genreFacets, inList, continueWatching] =
      await Promise.all([
        TVShow.find({ published: true }).sort(SORTS.trending).limit(10).lean(),
        TVShow.find({ published: true, rating: { $gt: 0 } })
          .sort(SORTS.rating)
          .limit(rowSize)
          .lean(),
        TVShow.find({ published: true }).sort(SORTS.newest).limit(rowSize).lean(),
        newEpisodeShows(rowSize),
        TVShow.aggregate([
          { $match: { published: true } },
          { $unwind: "$genres" },
          { $group: { _id: { $toLower: "$genres" }, count: { $sum: 1 } } },
          { $match: { count: { $gte: 2 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 4 },
        ]),
        myShowIds(req),
        getContinueWatching(userId, rowSize),
      ]);

    const rows = [];

    if (continueWatching.length) {
      rows.push({
        key: "continue",
        title: "Continue Watching",
        kind: "continue",
        items: continueWatching.map((entry) => ({
          ...entry,
          show: { ...entry.show, inMyList: inList.has(String(entry.show._id)) },
        })),
      });
    }

    if (inList.size) {
      const mine = await TVShow.find({
        _id: { $in: [...inList] },
        published: true,
      })
        .sort(SORTS.newest)
        .limit(rowSize)
        .lean();
      if (mine.length) {
        rows.push({ key: "myList", title: "My List", kind: "show", items: decorate(mine, inList) });
      }
    }

    if (fresh.length) {
      rows.push({
        key: "newEpisodes",
        title: "New Episodes",
        kind: "show",
        items: decorate(fresh, inList),
      });
    }

    if (trending.length) {
      rows.push({
        key: "trending",
        title: "Top 10 Series Today",
        kind: "show",
        ranked: true,
        items: decorate(trending, inList),
      });
    }

    // "Because you watched" needs a show the viewer actually started.
    if (continueWatching.length) {
      const seed = continueWatching[0].show;
      const like = await similarShows(seed, rowSize);
      if (like.length) {
        rows.push({
          key: "because",
          title: `Because you watched ${seed.title}`,
          kind: "show",
          items: decorate(like, inList),
        });
      }
    }

    if (topRated.length) {
      rows.push({
        key: "topRated",
        title: "Critically Acclaimed",
        kind: "show",
        items: decorate(topRated, inList),
      });
    }

    if (newest.length) {
      rows.push({
        key: "newest",
        title: "Recently Added",
        kind: "show",
        items: decorate(newest, inList),
      });
    }

    const genreRows = await Promise.all(
      genreFacets.map(async (facet) => {
        const items = await TVShow.find({ published: true, genres: genreFilter(facet._id) })
          .sort(SORTS.trending)
          .limit(rowSize)
          .lean();
        return {
          key: `genre:${facet._id}`,
          title: `${facet._id.charAt(0).toUpperCase() + facet._id.slice(1)} Series`,
          kind: "show",
          genre: facet._id,
          items: decorate(items, inList),
        };
      })
    );
    rows.push(...genreRows.filter((row) => row.items.length));

    // Hero: the most popular show that can actually fill the billboard — art
    // for the frame, and a *published* episode behind the play button.
    //
    // show.episodesCount is no help for the second half: syncShowCounts counts
    // every episode including drafts, so a show can report 5 and have none a
    // viewer may watch. The candidates are resolved against the episode
    // collection instead — one batched query for all of them, not one each.
    const heroPool = [...continueWatching.map((entry) => entry.show), ...trending, ...newest];
    const hasArt = (show) => show && (show.backdrop || show.poster);

    const candidates = [];
    const candidateIds = new Set();
    for (const show of heroPool) {
      if (!show) continue;
      const key = String(show._id);
      if (candidateIds.has(key)) continue;
      candidateIds.add(key);
      candidates.push(show);
      if (candidates.length >= 8) break;
    }

    let hero = null;
    if (candidates.length) {
      const episodesByShow = await orderedEpisodes(candidates.map((show) => show._id));
      const isPlayable = (show) =>
        (episodesByShow.get(String(show._id)) || []).length > 0;

      // Each fallback drops one requirement rather than leaving the slot empty.
      // Playable outranks pretty: a Play button that cannot play is a worse
      // billboard than one whose artwork falls back to a title card.
      const heroShow =
        candidates.find((show) => hasArt(show) && isPlayable(show)) ||
        candidates.find(isPlayable) ||
        candidates.find(hasArt) ||
        candidates[0];

      const started = continueWatching.find(
        (entry) => String(entry.show._id) === String(heroShow._id)
      );

      // The play button must resolve to a real episode even for a signed-out
      // visitor — otherwise the page's primary action can only link back to the
      // show it is already describing.
      const nextUp = started
        ? {
            episode: started.episode,
            resumeSec: started.resumeSec,
            percent: started.percent,
            reason: started.reason,
          }
        : computeNextUp(episodesByShow.get(String(heroShow._id)) || [], new Map());

      hero = {
        show: { ...heroShow, inMyList: inList.has(String(heroShow._id)) },
        nextUp,
      };
    }

    res.json({ hero, rows });
  } catch (err) {
    return fail(res, "TV_HUB_FAILED", err);
  }
});

// --- episode ----------------------------------------------------------------

// Everything the player needs in one payload: the episode, where it sits in the
// show, the neighbours for prev/next and autoplay, and the viewer's position.
router.get("/episodes/:episodeId", async (req, res) => {
  try {
    if (!validId(res, req.params.episodeId, "episodeId")) return;

    const episode = await Episode.findById(req.params.episodeId).lean();
    if (!episode || !episode.published) {
      return res.status(404).json({ message: "Not found" });
    }

    const [show, season] = await Promise.all([
      TVShow.findById(episode.showId).lean(),
      Season.findById(episode.seasonId).lean(),
    ]);
    if (!show || !show.published || !season || !season.published) {
      return res.status(404).json({ message: "Not found" });
    }

    const [episodesByShow, progressMap] = await Promise.all([
      orderedEpisodes(episode.showId),
      progressByEpisode(req.user?.id, episode.showId),
    ]);

    const siblings = episodesByShow.get(String(episode.showId)) || [];
    const index = siblings.findIndex((e) => String(e._id) === String(episode._id));
    const progress = progressMap.get(String(episode._id));

    res.json({
      episode,
      show,
      season,
      prev: index > 0 ? siblings[index - 1] : null,
      next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
      resumeSec: progress?.positionSec || 0,
      // The in-player episode picker renders the whole season without a second call.
      seasonEpisodes: withProgress(
        siblings.filter((e) => e.seasonNumber === episode.seasonNumber),
        progressMap
      ),
    });
  } catch (err) {
    return fail(res, "EPISODE_GET_FAILED", err);
  }
});

// --- show -------------------------------------------------------------------

// Show page payload. Seasons for the picker, the episodes of whichever season
// the viewer is actually up to, plus next-up, similar titles and list state.
router.get("/:showId", async (req, res) => {
  try {
    if (!validId(res, req.params.showId, "showId")) return;

    const show = await TVShow.findById(req.params.showId).lean();
    if (!show || !show.published) {
      return res.status(404).json({ message: "Not found" });
    }

    const [seasons, episodesByShow, progressMap, inList, similar] = await Promise.all([
      Season.find({ showId: show._id, published: true }).sort({ seasonNumber: 1 }).lean(),
      orderedEpisodes(show._id),
      progressByEpisode(req.user?.id, show._id),
      myShowIds(req),
      similarShows(show, 12),
    ]);

    const allEpisodes = episodesByShow.get(String(show._id)) || [];
    const nextUp = computeNextUp(allEpisodes, progressMap);

    // Open on the season the viewer is up to, not always season 1.
    const activeSeasonNumber =
      nextUp?.episode?.seasonNumber ?? seasons[0]?.seasonNumber ?? 1;

    const episodes = withProgress(
      allEpisodes.filter((e) => e.seasonNumber === activeSeasonNumber),
      progressMap
    );

    res.json({
      // Overwrite denormalized counts: syncShowCounts includes drafts, but the
      // client billboard reads show.episodesCount / seasonsCount. Public payloads
      // must match what orderedEpisodes actually returns.
      show: {
        ...show,
        inMyList: inList.has(String(show._id)),
        seasonsCount: seasons.length,
        episodesCount: allEpisodes.length,
      },
      seasons,
      activeSeasonNumber,
      episodes,
      nextUp,
      similar,
      // Lets the header show "3 of 24 episodes watched" without another request.
      watchedCount: allEpisodes.filter((e) => {
        const p = progressMap.get(String(e._id));
        return p && (p.completed || (p.percent || 0) >= 95);
      }).length,
      totalEpisodes: allEpisodes.length,
    });
  } catch (err) {
    return fail(res, "TV_GET_FAILED", err);
  }
});

router.get("/:showId/similar", async (req, res) => {
  try {
    if (!validId(res, req.params.showId, "showId")) return;

    const show = await TVShow.findById(req.params.showId).lean();
    if (!show || !show.published) return res.status(404).json({ message: "Not found" });

    const [similar, inList] = await Promise.all([
      similarShows(show, Math.min(24, Number(req.query.limit) || 12)),
      myShowIds(req),
    ]);
    res.json(decorate(similar, inList));
  } catch (err) {
    return fail(res, "TV_SIMILAR_FAILED", err);
  }
});

// Season switching on the show page.
router.get("/:showId/seasons/:seasonNumber/episodes", async (req, res) => {
  try {
    if (!validId(res, req.params.showId, "showId")) return;

    const season = await Season.findOne({
      showId: req.params.showId,
      seasonNumber: Number(req.params.seasonNumber),
      published: true,
    }).lean();
    if (!season) return res.status(404).json({ message: "Season not found" });

    const [episodes, progressMap] = await Promise.all([
      Episode.find({ seasonId: season._id, published: true })
        .select(EPISODE_CARD_FIELDS)
        .sort({ episodeNumber: 1 })
        .lean(),
      progressByEpisode(req.user?.id, req.params.showId),
    ]);

    res.json(withProgress(episodes, progressMap));
  } catch (err) {
    return fail(res, "EPISODE_LIST_FAILED", err);
  }
});

module.exports = router;
