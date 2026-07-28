const router = require("express").Router();
const mongoose = require("mongoose");
const TVShow = require("../models/TVShow");
const Season = require("../models/Season");
const Episode = require("../models/Episode");

// Public TV routes only. Everything admin-facing lives in routes/tvAdmin.js and
// is mounted at /api/tv/admin ahead of this router — the two used to share one
// file, where the "/:showId" wildcard below shadowed several admin paths.
//
// Route order still matters here: the literal "/episodes/..." prefix is
// registered before the "/:showId" wildcard.

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

// List published shows.
router.get("/", async (req, res) => {
  try {
    const { page = 1, pageSize = 20, q, genre, status, sort = "-createdAt" } = req.query;

    const filter = { published: true };
    if (q) filter.title = { $regex: String(q).trim(), $options: "i" };
    if (genre) filter.genres = genre;
    if (status) filter.status = status;

    const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const current = Math.max(1, Number(page) || 1);

    const [data, total] = await Promise.all([
      TVShow.find(filter)
        .sort(sort)
        .skip((current - 1) * size)
        .limit(size)
        .lean(),
      TVShow.countDocuments(filter),
    ]);

    res.json({ data, page: current, pageSize: size, total });
  } catch (err) {
    return fail(res, "TV_LIST_FAILED", err);
  }
});

// Episode details.
router.get("/episodes/:episodeId", async (req, res) => {
  try {
    if (!validId(res, req.params.episodeId, "episodeId")) return;

    const episode = await Episode.findById(req.params.episodeId).lean();
    if (!episode || !episode.published) {
      return res.status(404).json({ message: "Not found" });
    }
    res.json(episode);
  } catch (err) {
    return fail(res, "EPISODE_GET_FAILED", err);
  }
});

// Show details with its published seasons.
router.get("/:showId", async (req, res) => {
  try {
    if (!validId(res, req.params.showId, "showId")) return;

    const show = await TVShow.findById(req.params.showId).lean();
    if (!show || !show.published) {
      return res.status(404).json({ message: "Not found" });
    }
    const seasons = await Season.find({ showId: show._id, published: true })
      .sort({ seasonNumber: 1 })
      .lean();
    res.json({ show, seasons });
  } catch (err) {
    return fail(res, "TV_GET_FAILED", err);
  }
});

// Published episodes of a published season, addressed by season number.
router.get("/:showId/seasons/:seasonNumber/episodes", async (req, res) => {
  try {
    if (!validId(res, req.params.showId, "showId")) return;

    const season = await Season.findOne({
      showId: req.params.showId,
      seasonNumber: Number(req.params.seasonNumber),
      published: true,
    }).lean();
    if (!season) return res.status(404).json({ message: "Season not found" });

    const episodes = await Episode.find({ seasonId: season._id, published: true })
      .sort({ episodeNumber: 1 })
      .lean();
    res.json(episodes);
  } catch (err) {
    return fail(res, "EPISODE_LIST_FAILED", err);
  }
});

module.exports = router;
