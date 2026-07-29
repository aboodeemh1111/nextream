const router = require("express").Router();
const mongoose = require("mongoose");
const verify = require("../verifyToken");
const { validateMediaFields } = require("../storage/mediaFields");
const {
  reapDocumentMedia,
  reapManyDocumentMedia,
} = require("../storage/cleanup");
const TVShow = require("../models/TVShow");
const Season = require("../models/Season");
const Episode = require("../models/Episode");
const TVProgress = require("../models/TVProgress");
const User = require("../models/User");
const notify = require("../services/notifications/events");

// Admin TV routes live in their own router, mounted at /api/tv/admin *before*
// the public router. The previous layout interleaved them with public routes in
// one file, where "/:showId" (registered first) swallowed "/admin", and
// "/:showId/seasons/:seasonNumber/episodes" swallowed
// "/admin/seasons/:seasonId/episodes" — both admin routes 500'd on every call
// and the UI silently fell back to published-only data. A separate mount makes
// that class of shadowing impossible.

// --- shared helpers ---------------------------------------------------------

// Every route here is admin-only; the public router carries no auth at all.
router.use(verify, (req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
  next();
});

function badRequest(res, message, extra) {
  return res.status(400).json(Object.assign({ error: "BAD_REQUEST", message }, extra));
}

function conflict(res, error, message, extra) {
  return res.status(409).json(Object.assign({ error, message }, extra));
}

function fail(res, code, err) {
  console.error(`${code}:`, err);
  return res.status(500).json({ error: code, message: err.message });
}

function objectId(res, value, label) {
  if (!mongoose.isValidObjectId(value)) {
    badRequest(res, `${label} is not a valid id`);
    return null;
  }
  return new mongoose.Types.ObjectId(value);
}

// Fields the client must never set directly. `auto` was a flag the old UI sent
// to opt into server-side numbering; numbering is now always deterministic.
const STRIP_FIELDS = [
  "_id",
  "__v",
  "createdAt",
  "updatedAt",
  "auto",
  "showId",
  "seasonId",
  "seasonsCount",
  "episodesCount",
];

function clean(body) {
  const out = Object.assign({}, body || {});
  for (const field of STRIP_FIELDS) delete out[field];
  return out;
}

function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * Recomputes seasonsCount / episodesCount from the collections themselves.
 *
 * These used to be maintained with $inc on every create and delete, so any
 * partial failure desynced them permanently — the list page showed
 * "0 seasons • 0 episodes" for shows that had both. Counting is cheap next to
 * the write that just happened, and it can never drift.
 */
async function syncShowCounts(showId) {
  const [seasonsCount, episodesCount] = await Promise.all([
    Season.countDocuments({ showId }),
    Episode.countDocuments({ showId }),
  ]);
  await TVShow.updateOne({ _id: showId }, { $set: { seasonsCount, episodesCount } });
  return { seasonsCount, episodesCount };
}

async function syncSeasonCount(seasonId) {
  const episodesCount = await Episode.countDocuments({ seasonId });
  await Season.updateOne({ _id: seasonId }, { $set: { episodesCount } });
  return episodesCount;
}

/** Lowest positive integer not already used by a sibling. */
function nextFreeNumber(used, from) {
  let candidate = Number.isFinite(from) ? from : 1;
  while (used.has(candidate)) candidate++;
  return candidate;
}

// --- shows ------------------------------------------------------------------

router.get("/shows", async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 24,
      q,
      genre,
      status,
      published,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (q) filter.title = { $regex: String(q).trim(), $options: "i" };
    if (genre) filter.genres = genre;
    if (status) filter.status = status;
    if (published === "true") filter.published = true;
    if (published === "false") filter.published = { $ne: true };

    const size = Math.min(100, Math.max(1, Number(pageSize) || 24));
    const current = Math.max(1, Number(page) || 1);
    const skip = (current - 1) * size;

    const [data, total] = await Promise.all([
      TVShow.find(filter).sort(sort).skip(skip).limit(size).lean(),
      TVShow.countDocuments(filter),
    ]);

    // Counts come from the collections rather than the stored counters, so a
    // list that has drifted still renders the truth while syncShowCounts
    // catches up on the next write.
    const ids = data.map((s) => s._id);
    const [seasonGroups, episodeGroups] = await Promise.all([
      Season.aggregate([
        { $match: { showId: { $in: ids } } },
        { $group: { _id: "$showId", count: { $sum: 1 } } },
      ]),
      Episode.aggregate([
        { $match: { showId: { $in: ids } } },
        { $group: { _id: "$showId", count: { $sum: 1 } } },
      ]),
    ]);
    const seasonBy = new Map(seasonGroups.map((g) => [String(g._id), g.count]));
    const episodeBy = new Map(episodeGroups.map((g) => [String(g._id), g.count]));

    res.json({
      data: data.map((show) => ({
        ...show,
        seasonsCount: seasonBy.get(String(show._id)) || 0,
        episodesCount: episodeBy.get(String(show._id)) || 0,
      })),
      page: current,
      pageSize: size,
      total,
    });
  } catch (err) {
    return fail(res, "TV_ADMIN_LIST_FAILED", err);
  }
});

router.post("/shows", async (req, res) => {
  try {
    const payload = clean(req.body);
    const mediaError = validateMediaFields(payload, "TVShow");
    if (mediaError) return badRequest(res, mediaError, { error: "INVALID_MEDIA_FIELD" });

    if (!payload.title || !String(payload.title).trim()) {
      return badRequest(res, "Title is required");
    }
    payload.title = String(payload.title).trim();
    payload.isSeries = true;
    if (!payload.slug) payload.slug = slugify(payload.title);

    const created = await TVShow.create(payload);
    // A show created already published is visible from this moment, so the
    // transition happened here rather than in a later patch.
    if (created.published) notify.showPublished(created._id);
    res.status(201).json(created);
  } catch (err) {
    if (err?.code === 11000) {
      return conflict(res, "DUPLICATE_SLUG", "A show with this slug already exists");
    }
    return fail(res, "TV_CREATE_FAILED", err);
  }
});

/** Show plus its seasons and per-season episode counts — one round trip. */
router.get("/shows/:showId", async (req, res) => {
  try {
    const showId = objectId(res, req.params.showId, "showId");
    if (!showId) return;

    const show = await TVShow.findById(showId).lean();
    if (!show) return res.status(404).json({ message: "Show not found" });

    const seasons = await Season.find({ showId }).sort({ seasonNumber: 1 }).lean();
    const counts = await Episode.aggregate([
      { $match: { showId } },
      {
        $group: {
          _id: "$seasonId",
          count: { $sum: 1 },
          published: { $sum: { $cond: ["$published", 1, 0] } },
        },
      },
    ]);
    const by = new Map(counts.map((c) => [String(c._id), c]));

    res.json({
      show: {
        ...show,
        seasonsCount: seasons.length,
        episodesCount: counts.reduce((sum, c) => sum + c.count, 0),
      },
      seasons: seasons.map((season) => ({
        ...season,
        episodesCount: by.get(String(season._id))?.count || 0,
        publishedEpisodesCount: by.get(String(season._id))?.published || 0,
      })),
    });
  } catch (err) {
    return fail(res, "TV_ADMIN_GET_FAILED", err);
  }
});

router.patch("/shows/:showId", async (req, res) => {
  try {
    const showId = objectId(res, req.params.showId, "showId");
    if (!showId) return;

    const payload = clean(req.body);
    const mediaError = validateMediaFields(payload, "TVShow");
    if (mediaError) return badRequest(res, mediaError, { error: "INVALID_MEDIA_FIELD" });
    if (payload.title !== undefined && !String(payload.title).trim()) {
      return badRequest(res, "Title cannot be empty");
    }

    // The *transition* is the event, not the final state: re-saving an already
    // published show must not announce it again, and only the previous value can
    // tell the two apart.
    const wasPublished =
      payload.published === undefined
        ? null
        : (await TVShow.findById(showId).select("published").lean())?.published;

    const updated = await TVShow.findByIdAndUpdate(
      showId,
      { $set: payload },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Show not found" });

    if (wasPublished === false && updated.published === true) {
      notify.showPublished(updated._id);
    }

    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return conflict(res, "DUPLICATE_SLUG", "A show with this slug already exists");
    }
    return fail(res, "TV_UPDATE_FAILED", err);
  }
});

/**
 * Deletes a show with its whole tree. There was no route for this at all, so
 * shows could not be removed and their posters/backdrops leaked into the bucket
 * with nothing left pointing at them.
 */
router.delete("/shows/:showId", async (req, res) => {
  try {
    const showId = objectId(res, req.params.showId, "showId");
    if (!showId) return;

    const show = await TVShow.findById(showId);
    if (!show) return res.status(404).json({ message: "Show not found" });

    // Read before deleting: once the documents are gone their media keys are
    // unreachable and the blobs are orphaned forever.
    const [seasonDocs, episodeDocs] = await Promise.all([
      Season.find({ showId }).lean(),
      Episode.find({ showId }).lean(),
    ]);

    await Episode.deleteMany({ showId });
    await Season.deleteMany({ showId });
    // Viewer state that would otherwise orphan against a missing show.
    const [progressResult] = await Promise.all([
      TVProgress.deleteMany({ showId }),
      User.updateMany({}, { $pull: { myShows: showId } }),
    ]);
    await TVShow.deleteOne({ _id: showId });

    // Only after the Mongo deletes have succeeded.
    await reapDocumentMedia(show.toObject(), "TVShow");
    await reapManyDocumentMedia(seasonDocs, "Season");
    await reapManyDocumentMedia(episodeDocs, "Episode");

    res.json({
      ok: true,
      deleted: {
        seasons: seasonDocs.length,
        episodes: episodeDocs.length,
        progress: progressResult.deletedCount ?? 0,
      },
    });
  } catch (err) {
    return fail(res, "TV_DELETE_FAILED", err);
  }
});

/** Repairs drifted counters for one show. */
router.post("/shows/:showId/recount", async (req, res) => {
  try {
    const showId = objectId(res, req.params.showId, "showId");
    if (!showId) return;

    const seasons = await Season.find({ showId }).select("_id").lean();
    await Promise.all(seasons.map((s) => syncSeasonCount(s._id)));
    const counts = await syncShowCounts(showId);
    res.json({ ok: true, ...counts });
  } catch (err) {
    return fail(res, "TV_RECOUNT_FAILED", err);
  }
});

// --- seasons ----------------------------------------------------------------

router.get("/shows/:showId/seasons", async (req, res) => {
  try {
    const showId = objectId(res, req.params.showId, "showId");
    if (!showId) return;

    const seasons = await Season.find({ showId }).sort({ seasonNumber: 1 }).lean();
    const counts = await Episode.aggregate([
      { $match: { showId } },
      { $group: { _id: "$seasonId", count: { $sum: 1 } } },
    ]);
    const by = new Map(counts.map((c) => [String(c._id), c.count]));

    res.json(
      seasons.map((season) => ({
        ...season,
        episodesCount: by.get(String(season._id)) || 0,
      }))
    );
  } catch (err) {
    return fail(res, "SEASONS_LIST_FAILED", err);
  }
});

/**
 * Season numbering is deterministic: an explicit number is honoured or rejected
 * with the next free one attached, and an omitted number means "append". The
 * old route had three overlapping auto-assign paths plus a client that retried
 * 409s with a magic flag, so the number an admin typed was silently discarded.
 */
router.post("/shows/:showId/seasons", async (req, res) => {
  try {
    const showId = objectId(res, req.params.showId, "showId");
    if (!showId) return;

    const show = await TVShow.findById(showId).lean();
    if (!show) return res.status(404).json({ message: "Show not found" });

    const payload = clean(req.body);
    const mediaError = validateMediaFields(payload, "Season");
    if (mediaError) return badRequest(res, mediaError, { error: "INVALID_MEDIA_FIELD" });

    const siblings = await Season.find({ showId }).select("seasonNumber").lean();
    const used = new Set(siblings.map((s) => Number(s.seasonNumber)));

    let seasonNumber;
    if (payload.seasonNumber === undefined || payload.seasonNumber === null || payload.seasonNumber === "") {
      // Append after the highest, so a show numbered 0,1,2 gets 3 rather than
      // filling the gap left by a deliberately absent number.
      const highest = siblings.reduce((max, s) => Math.max(max, Number(s.seasonNumber)), 0);
      seasonNumber = nextFreeNumber(used, highest + 1);
    } else {
      seasonNumber = Number(payload.seasonNumber);
      if (!Number.isInteger(seasonNumber) || seasonNumber < 0) {
        return badRequest(res, "seasonNumber must be a non-negative integer");
      }
      if (used.has(seasonNumber)) {
        return conflict(
          res,
          "DUPLICATE_SEASON",
          `Season ${seasonNumber} already exists for this show`,
          { seasonNumber, suggestion: nextFreeNumber(used, seasonNumber) }
        );
      }
    }

    const season = await Season.create({ ...payload, showId, seasonNumber });
    await syncShowCounts(showId);
    res.status(201).json({ ...season.toObject(), episodesCount: 0 });
  } catch (err) {
    if (err?.code === 11000) {
      return conflict(res, "DUPLICATE_SEASON", "That season number is already taken");
    }
    return fail(res, "SEASON_CREATE_FAILED", err);
  }
});

/**
 * Reorders seasons, reassigning the numbers this show already uses.
 *
 * Three things the previous implementation got wrong:
 *
 * 1. It always renumbered to 1..N, so a show numbered 0, 1, 2 (season 0 being
 *    specials) or 1, 2, 5 was silently rewritten just by opening the page and
 *    pressing Save. Taking the existing numbers, sorted, and dealing them out
 *    in the new order preserves whatever scheme the show already had.
 * 2. It parked seasons at 1000+i, which collides with a real season numbered
 *    1001 and strands the show there if the process dies mid-run. Negative
 *    placeholders can never collide, because seasonNumber is non-negative.
 * 3. It renumbered Season documents only, while Episode carries its own
 *    denormalised seasonNumber under a unique
 *    {showId, seasonNumber, episodeNumber} index — so after a reorder the
 *    episodes described the wrong season and could collide with a sibling's.
 */
router.post("/shows/:showId/seasons/reorder", async (req, res) => {
  try {
    const showId = objectId(res, req.params.showId, "showId");
    if (!showId) return;

    const order = req.body && req.body.seasons;
    if (!Array.isArray(order) || order.length === 0) {
      return badRequest(res, "seasons must be a non-empty array of season ids");
    }
    if (order.some((id) => !mongoose.isValidObjectId(id))) {
      return badRequest(res, "seasons must contain only valid season ids");
    }
    if (new Set(order.map(String)).size !== order.length) {
      return badRequest(res, "seasons contains duplicate ids");
    }

    const existing = await Season.find({ showId }).select("_id seasonNumber").lean();
    if (existing.length !== order.length) {
      return badRequest(
        res,
        "seasons must list every season of this show exactly once",
        { expected: existing.length, received: order.length }
      );
    }
    const known = new Set(existing.map((s) => String(s._id)));
    if (order.some((id) => !known.has(String(id)))) {
      return badRequest(res, "seasons contains an id that does not belong to this show");
    }

    // The slots to deal out, lowest first: whatever this show already uses.
    const slots = existing
      .map((s) => Number(s.seasonNumber))
      .sort((a, b) => a - b);

    // Phase 1: park everything out of the way of the unique indexes.
    for (let i = 0; i < order.length; i++) {
      const placeholder = -(i + 1);
      await Season.updateOne({ _id: order[i], showId }, { $set: { seasonNumber: placeholder } });
      await Episode.updateMany({ seasonId: order[i], showId }, { $set: { seasonNumber: placeholder } });
    }

    // Phase 2: settle on the final numbers.
    for (let i = 0; i < order.length; i++) {
      const seasonNumber = slots[i];
      await Season.updateOne({ _id: order[i], showId }, { $set: { seasonNumber } });
      await Episode.updateMany({ seasonId: order[i], showId }, { $set: { seasonNumber } });
    }

    const seasons = await Season.find({ showId }).sort({ seasonNumber: 1 }).lean();
    res.json({ ok: true, seasons });
  } catch (err) {
    return fail(res, "SEASONS_REORDER_FAILED", err);
  }
});

router.patch("/seasons/:seasonId", async (req, res) => {
  try {
    const seasonId = objectId(res, req.params.seasonId, "seasonId");
    if (!seasonId) return;

    const payload = clean(req.body);
    const mediaError = validateMediaFields(payload, "Season");
    if (mediaError) return badRequest(res, mediaError, { error: "INVALID_MEDIA_FIELD" });

    // Changing the number by hand still has to respect the unique index.
    if (payload.seasonNumber !== undefined) {
      const season = await Season.findById(seasonId).lean();
      if (!season) return res.status(404).json({ message: "Season not found" });
      const seasonNumber = Number(payload.seasonNumber);
      if (!Number.isInteger(seasonNumber) || seasonNumber < 0) {
        return badRequest(res, "seasonNumber must be a non-negative integer");
      }
      if (seasonNumber !== season.seasonNumber) {
        const taken = await Season.findOne({
          showId: season.showId,
          seasonNumber,
          _id: { $ne: seasonId },
        }).lean();
        if (taken) {
          return conflict(res, "DUPLICATE_SEASON", `Season ${seasonNumber} already exists`, {
            seasonNumber,
          });
        }
        // Episodes carry the number too.
        await Episode.updateMany({ seasonId }, { $set: { seasonNumber } });
      }
    }

    const updated = await Season.findByIdAndUpdate(seasonId, { $set: payload }, { new: true });
    if (!updated) return res.status(404).json({ message: "Season not found" });
    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return conflict(res, "DUPLICATE_SEASON", "That season number is already taken");
    }
    return fail(res, "SEASON_UPDATE_FAILED", err);
  }
});

router.delete("/seasons/:seasonId", async (req, res) => {
  try {
    const seasonId = objectId(res, req.params.seasonId, "seasonId");
    if (!seasonId) return;

    const season = await Season.findById(seasonId);
    if (!season) return res.status(404).json({ message: "Season not found" });

    const episodeDocs = await Episode.find({ seasonId }).lean();
    await Episode.deleteMany({ seasonId });
    await Season.deleteOne({ _id: seasonId });
    await syncShowCounts(season.showId);

    await reapDocumentMedia(season.toObject(), "Season");
    await reapManyDocumentMedia(episodeDocs, "Episode");

    res.json({ ok: true, deleted: { episodes: episodeDocs.length } });
  } catch (err) {
    return fail(res, "SEASON_DELETE_FAILED", err);
  }
});

// --- episodes ---------------------------------------------------------------

router.get("/seasons/:seasonId/episodes", async (req, res) => {
  try {
    const seasonId = objectId(res, req.params.seasonId, "seasonId");
    if (!seasonId) return;

    const episodes = await Episode.find({ seasonId }).sort({ episodeNumber: 1 }).lean();
    res.json(episodes);
  } catch (err) {
    return fail(res, "EPISODES_LIST_FAILED", err);
  }
});

/**
 * The admin read for a single episode. The editor used to load episodes through
 * the public route, which 404s on anything unpublished — so a draft episode
 * could be created but never opened again.
 */
router.get("/episodes/:episodeId", async (req, res) => {
  try {
    const episodeId = objectId(res, req.params.episodeId, "episodeId");
    if (!episodeId) return;

    const episode = await Episode.findById(episodeId).lean();
    if (!episode) return res.status(404).json({ message: "Episode not found" });
    res.json(episode);
  } catch (err) {
    return fail(res, "EPISODE_GET_FAILED", err);
  }
});

async function buildEpisode(season, body, used) {
  const payload = clean(body);
  const mediaError = validateMediaFields(payload, "Episode");
  if (mediaError) throw Object.assign(new Error(mediaError), { status: 400, code: "INVALID_MEDIA_FIELD" });

  if (!payload.title || !String(payload.title).trim()) {
    throw Object.assign(new Error("Episode title is required"), { status: 400 });
  }
  payload.title = String(payload.title).trim();

  let episodeNumber;
  if (payload.episodeNumber === undefined || payload.episodeNumber === null || payload.episodeNumber === "") {
    const highest = [...used].reduce((max, n) => Math.max(max, n), 0);
    episodeNumber = nextFreeNumber(used, highest + 1);
  } else {
    episodeNumber = Number(payload.episodeNumber);
    if (!Number.isInteger(episodeNumber) || episodeNumber < 0) {
      throw Object.assign(new Error("episodeNumber must be a non-negative integer"), { status: 400 });
    }
    if (used.has(episodeNumber)) {
      throw Object.assign(
        new Error(`Episode ${episodeNumber} already exists in this season`),
        { status: 409, code: "DUPLICATE_EPISODE", extra: { episodeNumber, suggestion: nextFreeNumber(used, episodeNumber) } }
      );
    }
  }
  used.add(episodeNumber);

  return {
    ...payload,
    episodeNumber,
    showId: season.showId,
    seasonId: season._id,
    seasonNumber: season.seasonNumber,
  };
}

router.post("/seasons/:seasonId/episodes", async (req, res) => {
  try {
    const seasonId = objectId(res, req.params.seasonId, "seasonId");
    if (!seasonId) return;

    const season = await Season.findById(seasonId).lean();
    if (!season) return res.status(404).json({ message: "Season not found" });

    const siblings = await Episode.find({ seasonId }).select("episodeNumber").lean();
    const used = new Set(siblings.map((e) => Number(e.episodeNumber)));

    let doc;
    try {
      doc = await buildEpisode(season, req.body, used);
    } catch (err) {
      if (err.status === 409) return conflict(res, err.code, err.message, err.extra);
      if (err.status === 400) return badRequest(res, err.message, err.code ? { error: err.code } : undefined);
      throw err;
    }

    const episode = await Episode.create(doc);
    await Promise.all([syncSeasonCount(seasonId), syncShowCounts(season.showId)]);
    // Buffered on the way out: an admin adding episodes one at a time down a
    // list would otherwise produce one push per click. See events.js.
    if (episode.published) notify.episodePublished(episode._id);
    res.status(201).json(episode);
  } catch (err) {
    if (err?.code === 11000) {
      return conflict(res, "DUPLICATE_EPISODE", "That episode number is already taken");
    }
    return fail(res, "EPISODE_CREATE_FAILED", err);
  }
});

/**
 * Creates many episodes in one call, reporting per-item outcomes.
 *
 * The create wizard used to loop one HTTP request per episode from the browser
 * and `continue` past every 409, so an admin could finish the flow believing
 * ten episodes existed when seven did. Here nothing is skipped silently: the
 * response says exactly which rows landed and which did not.
 */
router.post("/seasons/:seasonId/episodes/bulk", async (req, res) => {
  try {
    const seasonId = objectId(res, req.params.seasonId, "seasonId");
    if (!seasonId) return;

    const items = req.body && req.body.episodes;
    if (!Array.isArray(items) || items.length === 0) {
      return badRequest(res, "episodes must be a non-empty array");
    }
    if (items.length > 200) {
      return badRequest(res, "No more than 200 episodes can be created at once");
    }

    const season = await Season.findById(seasonId).lean();
    if (!season) return res.status(404).json({ message: "Season not found" });

    const siblings = await Episode.find({ seasonId }).select("episodeNumber").lean();
    const used = new Set(siblings.map((e) => Number(e.episodeNumber)));

    const created = [];
    const failed = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const doc = await buildEpisode(season, items[i], used);
        created.push(await Episode.create(doc));
      } catch (err) {
        failed.push({
          index: i,
          title: items[i] && items[i].title,
          error: err.code || (err.code === undefined && err.status === 409 ? "DUPLICATE_EPISODE" : "INVALID_EPISODE"),
          message: err.message,
        });
      }
    }

    await Promise.all([syncSeasonCount(seasonId), syncShowCounts(season.showId)]);
    // The case the coalescing window exists for: a whole season arriving at once
    // becomes one "Season N is here" rather than ten new-episode alerts.
    for (const episode of created) {
      if (episode.published) notify.episodePublished(episode._id);
    }
    res.status(created.length ? 201 : 400).json({ created, failed });
  } catch (err) {
    return fail(res, "EPISODE_BULK_CREATE_FAILED", err);
  }
});

/**
 * Same two-phase placeholder trick as seasons, against the episode index, and
 * likewise reusing the numbers the season already has rather than flattening
 * them to 1..N.
 */
router.post("/seasons/:seasonId/episodes/reorder", async (req, res) => {
  try {
    const seasonId = objectId(res, req.params.seasonId, "seasonId");
    if (!seasonId) return;

    const order = req.body && req.body.episodes;
    if (!Array.isArray(order) || order.length === 0) {
      return badRequest(res, "episodes must be a non-empty array of episode ids");
    }
    if (order.some((id) => !mongoose.isValidObjectId(id))) {
      return badRequest(res, "episodes must contain only valid episode ids");
    }
    if (new Set(order.map(String)).size !== order.length) {
      return badRequest(res, "episodes contains duplicate ids");
    }

    const existing = await Episode.find({ seasonId }).select("_id episodeNumber").lean();
    if (existing.length !== order.length) {
      return badRequest(res, "episodes must list every episode of this season exactly once", {
        expected: existing.length,
        received: order.length,
      });
    }
    const known = new Set(existing.map((e) => String(e._id)));
    if (order.some((id) => !known.has(String(id)))) {
      return badRequest(res, "episodes contains an id that does not belong to this season");
    }

    const slots = existing
      .map((e) => Number(e.episodeNumber))
      .sort((a, b) => a - b);

    for (let i = 0; i < order.length; i++) {
      await Episode.updateOne({ _id: order[i], seasonId }, { $set: { episodeNumber: -(i + 1) } });
    }
    for (let i = 0; i < order.length; i++) {
      await Episode.updateOne({ _id: order[i], seasonId }, { $set: { episodeNumber: slots[i] } });
    }

    const episodes = await Episode.find({ seasonId }).sort({ episodeNumber: 1 }).lean();
    res.json({ ok: true, episodes });
  } catch (err) {
    return fail(res, "EPISODES_REORDER_FAILED", err);
  }
});

router.patch("/episodes/:episodeId", async (req, res) => {
  try {
    const episodeId = objectId(res, req.params.episodeId, "episodeId");
    if (!episodeId) return;

    const payload = clean(req.body);
    const mediaError = validateMediaFields(payload, "Episode");
    if (mediaError) return badRequest(res, mediaError, { error: "INVALID_MEDIA_FIELD" });

    if (payload.episodeNumber !== undefined) {
      const episode = await Episode.findById(episodeId).lean();
      if (!episode) return res.status(404).json({ message: "Episode not found" });
      const episodeNumber = Number(payload.episodeNumber);
      if (!Number.isInteger(episodeNumber) || episodeNumber < 0) {
        return badRequest(res, "episodeNumber must be a non-negative integer");
      }
      if (episodeNumber !== episode.episodeNumber) {
        const taken = await Episode.findOne({
          seasonId: episode.seasonId,
          episodeNumber,
          _id: { $ne: episodeId },
        }).lean();
        if (taken) {
          return conflict(res, "DUPLICATE_EPISODE", `Episode ${episodeNumber} already exists`, {
            episodeNumber,
          });
        }
      }
    }

    // As with shows: the transition is the event. The publish toggle is the most
    // common way an episode goes live, since the create wizard leaves drafts.
    const wasPublished =
      payload.published === undefined
        ? null
        : (await Episode.findById(episodeId).select("published").lean())?.published;

    const updated = await Episode.findByIdAndUpdate(episodeId, { $set: payload }, { new: true });
    if (!updated) return res.status(404).json({ message: "Episode not found" });

    if (wasPublished === false && updated.published === true) {
      notify.episodePublished(updated._id);
    }

    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return conflict(res, "DUPLICATE_EPISODE", "That episode number is already taken");
    }
    return fail(res, "EPISODE_UPDATE_FAILED", err);
  }
});

router.delete("/episodes/:episodeId", async (req, res) => {
  try {
    const episodeId = objectId(res, req.params.episodeId, "episodeId");
    if (!episodeId) return;

    const episode = await Episode.findByIdAndDelete(episodeId);
    if (!episode) return res.status(404).json({ message: "Episode not found" });

    await Promise.all([
      syncSeasonCount(episode.seasonId),
      syncShowCounts(episode.showId),
    ]);
    // Only after the Mongo delete has succeeded.
    await reapDocumentMedia(episode.toObject(), "Episode");

    res.json({ ok: true });
  } catch (err) {
    return fail(res, "EPISODE_DELETE_FAILED", err);
  }
});

module.exports = router;
module.exports.syncShowCounts = syncShowCounts;
module.exports.syncSeasonCount = syncSeasonCount;
