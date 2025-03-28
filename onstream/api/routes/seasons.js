const router = require("express").Router();
const Season = require("../models/Season");
const Episode = require("../models/Episode");
const Movie = require("../models/Movie");
const verify = require("../verifyToken");
const mongoose = require("mongoose");

// Create a new season for a series
router.post("/:seriesId", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res
      .status(403)
      .json({ message: "You are not allowed to add seasons" });
  }

  try {
    // Check if series exists and is a series
    const series = await Movie.findById(req.params.seriesId);
    if (!series) {
      return res.status(404).json({ message: "Series not found" });
    }

    if (!series.isSeries) {
      return res.status(400).json({ message: "This movie is not a series" });
    }

    // Create the new season
    const newSeason = new Season({
      ...req.body,
      seriesId: req.params.seriesId,
    });

    const savedSeason = await newSeason.save();

    // Update series totalSeasons count if needed
    const seasonCount = await Season.countDocuments({
      seriesId: req.params.seriesId,
    });
    if (series.totalSeasons < seasonCount) {
      await Movie.findByIdAndUpdate(req.params.seriesId, {
        totalSeasons: seasonCount,
      });
    }

    res.status(201).json(savedSeason);
  } catch (err) {
    console.error("Error creating season:", err);
    if (err.code === 11000) {
      return res
        .status(400)
        .json({
          message: "A season with this number already exists for this series",
        });
    }
    res.status(500).json({ message: err.message });
  }
});

// Update season
router.put("/:id", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res
      .status(403)
      .json({ message: "You are not allowed to update seasons" });
  }

  try {
    const updatedSeason = await Season.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    if (!updatedSeason) {
      return res.status(404).json({ message: "Season not found" });
    }

    res.status(200).json(updatedSeason);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete season
router.delete("/:id", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res
      .status(403)
      .json({ message: "You are not allowed to delete seasons" });
  }

  try {
    const season = await Season.findById(req.params.id);
    if (!season) {
      return res.status(404).json({ message: "Season not found" });
    }

    // Delete all episodes of this season first
    await Episode.deleteMany({ seasonId: req.params.id });

    // Delete the season
    await Season.findByIdAndDelete(req.params.id);

    // Update series totalSeasons count
    const seriesId = season.seriesId;
    const seasonCount = await Season.countDocuments({ seriesId });
    await Movie.findByIdAndUpdate(seriesId, {
      totalSeasons: seasonCount,
    });

    res.status(200).json({ message: "Season has been deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a specific season
router.get("/:id", verify, async (req, res) => {
  try {
    const season = await Season.findById(req.params.id);
    if (!season) {
      return res.status(404).json({ message: "Season not found" });
    }

    res.status(200).json(season);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all seasons for a series
router.get("/series/:seriesId", verify, async (req, res) => {
  try {
    // Check if series exists
    const series = await Movie.findById(req.params.seriesId);
    if (!series) {
      return res.status(404).json({ message: "Series not found" });
    }

    const seasons = await Season.find({ seriesId: req.params.seriesId }).sort({
      seasonNumber: 1,
    });

    res.status(200).json(seasons);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
