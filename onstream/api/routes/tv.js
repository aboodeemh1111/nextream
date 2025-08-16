const router = require("express").Router();
const verify = require("../verifyToken");
const TVShow = require("../models/TVShow");
const Season = require("../models/Season");
const Episode = require("../models/Episode");
const mongoose = require("mongoose");

// Public: list shows
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      q,
      genre,
      status,
      sort = "-createdAt",
    } = req.query;
    const filter = { published: true };
    if (q) filter.title = { $regex: q, $options: "i" };
    if (genre) filter.genres = genre;
    if (status) filter.status = status;
    const skip = (Number(page) - 1) * Number(pageSize);
    const [data, total] = await Promise.all([
      TVShow.find(filter).sort(sort).skip(skip).limit(Number(pageSize)).lean(),
      TVShow.countDocuments(filter),
    ]);
    res.json({ data, page: Number(page), pageSize: Number(pageSize), total });
  } catch (err) {
    res.status(500).json({ error: "TV_LIST_FAILED", message: err.message });
  }
});

// Public: show details
router.get("/:showId", async (req, res) => {
  try {
    const show = await TVShow.findById(req.params.showId).lean();
    if (!show || !show.published)
      return res.status(404).json({ message: "Not found" });
    const seasons = await Season.find({ showId: show._id, published: true })
      .sort({ seasonNumber: 1 })
      .lean();
    res.json({ show, seasons });
  } catch (err) {
    res.status(500).json({ error: "TV_GET_FAILED", message: err.message });
  }
});

// Public: episodes by season
router.get("/:showId/seasons/:seasonNumber/episodes", async (req, res) => {
  try {
    const season = await Season.findOne({
      showId: req.params.showId,
      seasonNumber: Number(req.params.seasonNumber),
      published: true,
    }).lean();
    if (!season) return res.status(404).json({ message: "Season not found" });
    const eps = await Episode.find({ seasonId: season._id, published: true })
      .sort({ episodeNumber: 1 })
      .lean();
    res.json(eps);
  } catch (err) {
    res
      .status(500)
      .json({ error: "EPISODE_LIST_FAILED", message: err.message });
  }
});

// Public: episode details
router.get("/episodes/:episodeId", async (req, res) => {
  try {
    const ep = await Episode.findById(req.params.episodeId).lean();
    if (!ep || !ep.published)
      return res.status(404).json({ message: "Not found" });
    res.json(ep);
  } catch (err) {
    res.status(500).json({ error: "EPISODE_GET_FAILED", message: err.message });
  }
});

// Admin: create/update show
router.post("/", verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
    const payload = { ...req.body };
    if (!payload.slug && payload.title) {
      payload.slug = String(payload.title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
    }
    const created = await TVShow.create(payload);
    res.json(created);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        error: "DUPLICATE",
        message: "A show with this slug already exists",
      });
    }
    res.status(500).json({ error: "TV_CREATE_FAILED", message: err.message });
  }
});

// Admin: get single show (unrestricted by published)
router.get("/admin/show/:showId", verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
    const show = await TVShow.findById(req.params.showId).lean();
    if (!show) return res.status(404).json({ message: "Show not found" });
    res.json(show);
  } catch (err) {
    res
      .status(500)
      .json({ error: "TV_ADMIN_GET_FAILED", message: err.message });
  }
});

router.patch("/:showId", verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
    const updated = await TVShow.findByIdAndUpdate(
      req.params.showId,
      { $set: req.body },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "TV_UPDATE_FAILED", message: err.message });
  }
});

// Admin: seasons
router.post("/:showId/seasons", verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
    // Ensure show exists
    const showId = req.params.showId;
    const show = await TVShow.findById(showId).lean();
    if (!show) return res.status(404).json({ message: "Show not found" });

    // Determine / validate season number
    let seasonNumber = Number(req.body.seasonNumber);
    if (!seasonNumber) {
      const last = await Season.find({ showId })
        .sort({ seasonNumber: -1 })
        .limit(1)
        .lean();
      seasonNumber = last.length ? Number(last[0].seasonNumber || 0) + 1 : 1;
    } else {
      const exists = await Season.findOne({ showId, seasonNumber }).lean();
      if (exists) {
        return res.status(409).json({
          error: "DUPLICATE_SEASON",
          message: "Season number already exists for this show",
          seasonNumber,
        });
      }
    }

    const payload = { ...req.body, showId, seasonNumber };
    const s = await Season.create(payload);
    await TVShow.updateOne({ _id: showId }, { $inc: { seasonsCount: 1 } });
    res.json(s);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        error: "DUPLICATE_SEASON",
        message: "Season number already exists for this show",
      });
    }
    res
      .status(500)
      .json({ error: "SEASON_CREATE_FAILED", message: err.message });
  }
});

// Admin: episodes (single create)
router.post("/:showId/seasons/:seasonId/episodes", verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
    const season = await Season.findOne({
      _id: req.params.seasonId,
      showId: req.params.showId,
    });
    if (!season) return res.status(404).json({ message: "Season not found" });
    // Determine/validate episode number
    let episodeNumber = Number(req.body.episodeNumber);
    if (!episodeNumber) {
      const last = await Episode.find({ seasonId: season._id })
        .sort({ episodeNumber: -1 })
        .limit(1)
        .lean();
      episodeNumber = last.length ? Number(last[0].episodeNumber || 0) + 1 : 1;
    } else {
      const exists = await Episode.findOne({
        seasonId: season._id,
        episodeNumber,
      }).lean();
      if (exists) {
        return res.status(409).json({
          error: "DUPLICATE_EPISODE",
          message: "Episode number already exists in this season",
          episodeNumber,
        });
      }
    }

    const payload = {
      ...req.body,
      episodeNumber,
      showId: season.showId,
      seasonId: season._id,
      seasonNumber: season.seasonNumber,
    };
    const ep = await Episode.create(payload);
    await Season.updateOne({ _id: season._id }, { $inc: { episodesCount: 1 } });
    await TVShow.updateOne(
      { _id: season.showId },
      { $inc: { episodesCount: 1 } }
    );
    res.json(ep);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        error: "DUPLICATE_EPISODE",
        message: "Episode number already exists in this season",
      });
    }
    res
      .status(500)
      .json({ error: "EPISODE_CREATE_FAILED", message: err.message });
  }
});

module.exports = router;

// Admin endpoints under /api/tv/admin...
router.get("/admin", verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
    const {
      page = 1,
      pageSize = 20,
      q,
      genre,
      status,
      sort = "-createdAt",
    } = req.query;
    const filter = {};
    if (q) filter.title = { $regex: q, $options: "i" };
    if (genre) filter.genres = genre;
    if (status) filter.status = status;
    const skip = (Number(page) - 1) * Number(pageSize);
    const [data, total] = await Promise.all([
      TVShow.find(filter).sort(sort).skip(skip).limit(Number(pageSize)).lean(),
      TVShow.countDocuments(filter),
    ]);
    res.json({ data, page: Number(page), pageSize: Number(pageSize), total });
  } catch (err) {
    res
      .status(500)
      .json({ error: "TV_ADMIN_LIST_FAILED", message: err.message });
  }
});

router.get("/admin/:showId/seasons", verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
    const seasons = await Season.find({ showId: req.params.showId })
      .sort({ seasonNumber: 1 })
      .lean();
    res.json(seasons);
  } catch (err) {
    res
      .status(500)
      .json({ error: "SEASONS_ADMIN_LIST_FAILED", message: err.message });
  }
});

// Admin: reorder seasons by provided order
router.post("/admin/:showId/seasons/reorder", verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
    const seasons = req.body && req.body.seasons;
    if (!Array.isArray(seasons) || seasons.length === 0) {
      return res.status(400).json({ message: "seasons array required" });
    }
    // temporary bump to avoid unique conflicts if any
    for (let i = 0; i < seasons.length; i++) {
      await Season.updateOne(
        { _id: seasons[i], showId: req.params.showId },
        { $set: { seasonNumber: 1000 + i + 1 } }
      );
    }
    for (let i = 0; i < seasons.length; i++) {
      await Season.updateOne(
        { _id: seasons[i], showId: req.params.showId },
        { $set: { seasonNumber: i + 1 } }
      );
    }
    const updated = await Season.find({ showId: req.params.showId })
      .sort({ seasonNumber: 1 })
      .lean();
    res.json({ ok: true, seasons: updated });
  } catch (err) {
    res
      .status(500)
      .json({ error: "SEASONS_REORDER_FAILED", message: err.message });
  }
});

router.get("/admin/seasons/:seasonId/episodes", verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
    const { seasonId } = req.params;
    if (!mongoose.isValidObjectId(seasonId)) {
      return res.status(400).json({ error: "INVALID_SEASON_ID" });
    }
    const sid = new mongoose.Types.ObjectId(seasonId);
    const eps = await Episode.find({ seasonId: sid })
      .sort({ episodeNumber: 1 })
      .lean();
    res.json(eps);
  } catch (err) {
    res
      .status(500)
      .json({ error: "EPISODES_ADMIN_LIST_FAILED", message: err.message });
  }
});

router.patch("/admin/seasons/:seasonId", verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
    const updated = await Season.findByIdAndUpdate(
      req.params.seasonId,
      { $set: req.body },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res
      .status(500)
      .json({ error: "SEASON_UPDATE_FAILED", message: err.message });
  }
});

router.patch("/admin/episodes/:episodeId", verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
    const updated = await Episode.findByIdAndUpdate(
      req.params.episodeId,
      { $set: req.body },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res
      .status(500)
      .json({ error: "EPISODE_UPDATE_FAILED", message: err.message });
  }
});

// Admin: delete episode
router.delete("/admin/episodes/:episodeId", verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
    const ep = await Episode.findByIdAndDelete(req.params.episodeId);
    if (ep) {
      await Season.updateOne(
        { _id: ep.seasonId },
        { $inc: { episodesCount: -1 } }
      );
      await TVShow.updateOne(
        { _id: ep.showId },
        { $inc: { episodesCount: -1 } }
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res
      .status(500)
      .json({ error: "EPISODE_DELETE_FAILED", message: err.message });
  }
});

// Admin: delete season (and its episodes)
router.delete("/admin/seasons/:seasonId", verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
    const season = await Season.findById(req.params.seasonId);
    if (!season) return res.status(404).json({ message: "Season not found" });
    const eps = await Episode.deleteMany({ seasonId: season._id });
    await TVShow.updateOne(
      { _id: season.showId },
      { $inc: { episodesCount: -(eps.deletedCount || 0), seasonsCount: -1 } }
    );
    await Season.deleteOne({ _id: season._id });
    res.json({ ok: true });
  } catch (err) {
    res
      .status(500)
      .json({ error: "SEASON_DELETE_FAILED", message: err.message });
  }
});
