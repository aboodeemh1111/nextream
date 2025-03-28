const router = require("express").Router();
const Episode = require("../models/Episode");
const Season = require("../models/Season");
const Movie = require("../models/Movie");
const verify = require("../verifyToken");
const mongoose = require("mongoose");

// Create a new episode
router.post("/:seasonId", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res
      .status(403)
      .json({ message: "You are not allowed to add episodes" });
  }

  try {
    // Check if season exists
    const season = await Season.findById(req.params.seasonId);
    if (!season) {
      return res.status(404).json({ message: "Season not found" });
    }

    // Create the new episode
    const newEpisode = new Episode({
      ...req.body,
      seasonId: req.params.seasonId,
      seriesId: season.seriesId,
    });

    const savedEpisode = await newEpisode.save();

    // Update season's episode count
    const episodeCount = await Episode.countDocuments({
      seasonId: req.params.seasonId,
    });
    await Season.findByIdAndUpdate(req.params.seasonId, {
      episodes: episodeCount,
    });

    res.status(201).json(savedEpisode);
  } catch (err) {
    console.error("Error creating episode:", err);
    if (err.code === 11000) {
      return res
        .status(400)
        .json({
          message: "An episode with this number already exists for this season",
        });
    }
    res.status(500).json({ message: err.message });
  }
});

// Update episode
router.put("/:id", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res
      .status(403)
      .json({ message: "You are not allowed to update episodes" });
  }

  try {
    const updatedEpisode = await Episode.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    if (!updatedEpisode) {
      return res.status(404).json({ message: "Episode not found" });
    }

    res.status(200).json(updatedEpisode);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete episode
router.delete("/:id", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res
      .status(403)
      .json({ message: "You are not allowed to delete episodes" });
  }

  try {
    const episode = await Episode.findById(req.params.id);
    if (!episode) {
      return res.status(404).json({ message: "Episode not found" });
    }

    // Delete the episode
    await Episode.findByIdAndDelete(req.params.id);

    // Update season's episode count
    const seasonId = episode.seasonId;
    const episodeCount = await Episode.countDocuments({ seasonId });
    await Season.findByIdAndUpdate(seasonId, {
      episodes: episodeCount,
    });

    res.status(200).json({ message: "Episode has been deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a specific episode
router.get("/:id", verify, async (req, res) => {
  try {
    const episode = await Episode.findById(req.params.id);
    if (!episode) {
      return res.status(404).json({ message: "Episode not found" });
    }

    res.status(200).json(episode);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all episodes for a season
router.get("/season/:seasonId", verify, async (req, res) => {
  try {
    // Check if season exists
    const season = await Season.findById(req.params.seasonId);
    if (!season) {
      return res.status(404).json({ message: "Season not found" });
    }

    const episodes = await Episode.find({ seasonId: req.params.seasonId }).sort(
      { episodeNumber: 1 }
    );

    res.status(200).json(episodes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all episodes for a series
router.get("/series/:seriesId", verify, async (req, res) => {
  try {
    // Check if series exists
    const series = await Movie.findById(req.params.seriesId);
    if (!series) {
      return res.status(404).json({ message: "Series not found" });
    }

    const episodes = await Episode.find({ seriesId: req.params.seriesId }).sort(
      { seasonId: 1, episodeNumber: 1 }
    );

    res.status(200).json(episodes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get featured episodes for a series
router.get("/featured/:seriesId", verify, async (req, res) => {
  try {
    const featuredEpisodes = await Episode.find({
      seriesId: req.params.seriesId,
      featured: true,
    })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json(featuredEpisodes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
