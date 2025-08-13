const router = require("express").Router();
const User = require("../models/User");
const Movie = require("../models/Movie");
const CryptoJS = require("crypto-js");
const verify = require("../verifyToken");
const mongoose = require("mongoose");
//UPDATE

router.put("/:id", verify, async (req, res) => {
  if (req.user.id === req.params.id || req.user.isAdmin) {
    if (req.body.password) {
      req.body.password = CryptoJS.AES.encrypt(
        req.body.password,
        process.env.SECRET_KEY
      ).toString();
    }

    try {
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        {
          $set: req.body,
        },
        { new: true }
      );
      res.status(200).json(updatedUser);
    } catch (err) {
      res.status(500).json(err);
    }
  } else {
    res.status(403).json("You can update only your account!");
  }
});

//DELETE
router.delete("/:id", verify, async (req, res) => {
  if (req.user.id === req.params.id || req.user.isAdmin) {
    try {
      await User.findByIdAndDelete(req.params.id);
      res.status(200).json("User has been deleted...");
    } catch (err) {
      res.status(500).json(err);
    }
  } else {
    res.status(403).json("You can delete only your account!");
  }
});

//GET

router.get("/find/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const { password, ...info } = user._doc;
    res.status(200).json(info);
  } catch (err) {
    res.status(500).json(err);
  }
});

//GET ALL
router.get("/", verify, async (req, res) => {
  const query = req.query.new;
  if (req.user.isAdmin) {
    try {
      const users = query
        ? await User.find().sort({ _id: -1 }).limit(5)
        : await User.find();
      res.status(200).json(users);
    } catch (err) {
      res.status(500).json(err);
    }
  } else {
    res.status(403).json("You are not allowed to see all users!");
  }
});

//GET USER STATS
router.get("/stats", async (req, res) => {
  const today = new Date();
  const latYear = today.setFullYear(today.setFullYear() - 1);

  try {
    const data = await User.aggregate([
      {
        $project: {
          month: { $month: "$createdAt" },
        },
      },
      {
        $group: {
          _id: "$month",
          total: { $sum: 1 },
        },
      },
    ]);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET USER PROFILE
router.get("/profile", verify, async (req, res) => {
  try {
    // If DB not connected, return a minimal stub to avoid 500s in dev
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json({
        _id: req.user.id,
        username: "Guest",
        email: "",
        profilePic: "",
        myList: [],
        favorites: [],
        watchHistory: [],
        currentlyWatching: [],
        watchlist: [],
        preferences: {},
      });
    }

    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("myList", "title img imgSm year")
      .populate("favorites", "title img imgSm year")
      .populate({
        path: "watchHistory.movie",
        select: "title img imgSm year",
      })
      .populate({
        path: "currentlyWatching.movie",
        select: "title img imgSm year",
      })
      .populate("watchlist", "title img imgSm year");

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: "PROFILE_ERROR", message: err.message });
  }
});

// GET USER PROFILE SUMMARY (stats/top genres/devices)
router.get("/profile/summary", verify, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select(
        "username email profilePic totalWatchTime loginHistory genrePreferences subscriptionStatus preferences watchHistory currentlyWatching favorites myList"
      )
      .lean();

    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    // Compute top genres
    const preferencesMap = user.genrePreferences || new Map();
    const entries = Array.from(
      preferencesMap instanceof Map
        ? preferencesMap.entries()
        : Object.entries(preferencesMap)
    );
    const topGenres = entries
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));

    const totalTitlesWatched = user.watchHistory?.length || 0;
    const inProgress = user.currentlyWatching?.length || 0;
    const favoritesCount = user.favorites?.length || 0;
    const myListCount = user.myList?.length || 0;

    const lastLogins = (user.loginHistory || []).slice(-5).reverse();

    const summary = {
      username: user.username,
      profilePic: user.profilePic,
      subscriptionStatus: user.subscriptionStatus,
      preferences: user.preferences || {},
      metrics: {
        totalWatchTime: user.totalWatchTime || 0,
        totalTitlesWatched,
        inProgress,
        favoritesCount,
        myListCount,
      },
      topGenres,
      recentLogins: lastLogins,
    };

    res.status(200).json(summary);
  } catch (err) {
    res
      .status(500)
      .json({ error: "PROFILE_SUMMARY_ERROR", message: err.message });
  }
});

// UPDATE USER PREFERENCES
router.post("/preferences", verify, async (req, res) => {
  try {
    const allowed = [
      "autoplayPreviews",
      "reduceMotion",
      "theme",
      "textSize",
      "captionsStyle",
      "maturityRating",
      "language",
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[`preferences.${key}`] = req.body[key];
      }
    }

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, select: "preferences" }
    );
    res.status(200).json(updated.preferences);
  } catch (err) {
    res
      .status(500)
      .json({ error: "PREFERENCES_UPDATE_ERROR", message: err.message });
  }
});

// ADD TO MY LIST
router.post("/mylist", verify, async (req, res) => {
  try {
    const { movieId } = req.body;
    if (!movieId) return res.status(400).json("Movie ID is required");

    // Check if movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) return res.status(404).json("Movie not found");

    // Add to myList if not already there
    const user = await User.findById(req.user.id);
    if (user.myList.includes(movieId)) {
      return res.status(400).json("Movie already in My List");
    }

    await User.findByIdAndUpdate(req.user.id, {
      $push: { myList: movieId },
    });

    res.status(200).json("Movie added to My List");
  } catch (err) {
    res.status(500).json(err);
  }
});

// REMOVE FROM MY LIST
router.delete("/mylist/:movieId", verify, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { myList: req.params.movieId },
    });

    res.status(200).json("Movie removed from My List");
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET MY LIST
router.get("/mylist", verify, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("myList");
    res.status(200).json(user.myList);
  } catch (err) {
    res.status(500).json(err);
  }
});

// ADD TO FAVORITES
router.post("/favorites", verify, async (req, res) => {
  try {
    const { movieId } = req.body;
    if (!movieId) return res.status(400).json("Movie ID is required");

    // Check if movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) return res.status(404).json("Movie not found");

    // Add to favorites if not already there
    const user = await User.findById(req.user.id);
    if (user.favorites.includes(movieId)) {
      return res.status(400).json("Movie already in Favorites");
    }

    await User.findByIdAndUpdate(req.user.id, {
      $push: { favorites: movieId },
    });

    res.status(200).json("Movie added to Favorites");
  } catch (err) {
    res.status(500).json(err);
  }
});

// REMOVE FROM FAVORITES
router.delete("/favorites/:movieId", verify, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { favorites: req.params.movieId },
    });

    res.status(200).json("Movie removed from Favorites");
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET FAVORITES
router.get("/favorites", verify, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("favorites");
    res.status(200).json(user.favorites);
  } catch (err) {
    res.status(500).json(err);
  }
});

// UPDATE WATCH PROGRESS
router.post("/watching", verify, async (req, res) => {
  try {
    const { movieId, progress } = req.body;
    if (!movieId) return res.status(400).json("Movie ID is required");
    if (progress === undefined)
      return res.status(400).json("Progress is required");

    // Check if movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) return res.status(404).json("Movie not found");

    const user = await User.findById(req.user.id);

    // Check if movie is in currentlyWatching
    const watchingIndex = user.currentlyWatching.findIndex(
      (item) => item.movie.toString() === movieId
    );

    if (watchingIndex > -1) {
      // Update existing entry
      user.currentlyWatching[watchingIndex].progress = progress;
      user.currentlyWatching[watchingIndex].lastWatchedAt = new Date();
    } else {
      // Add new entry
      user.currentlyWatching.push({
        movie: movieId,
        progress,
        lastWatchedAt: new Date(),
      });
    }

    // If progress is 100%, move to watch history
    if (progress >= 95) {
      // Add to watch history if not already there
      const historyIndex = user.watchHistory.findIndex(
        (item) => item.movie.toString() === movieId
      );

      if (historyIndex === -1) {
        user.watchHistory.push({
          movie: movieId,
          watchedAt: new Date(),
          progress: 100,
          completed: true,
        });
      }

      // Remove from currently watching if progress is 100%
      if (progress === 100) {
        user.currentlyWatching = user.currentlyWatching.filter(
          (item) => item.movie.toString() !== movieId
        );
      }
    }

    await user.save();
    res.status(200).json("Watch progress updated");
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET CURRENTLY WATCHING
router.get("/watching", verify, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: "currentlyWatching.movie",
      select: "title img imgSm year duration",
    });

    // Sort by last watched (most recent first)
    const sortedWatching = user.currentlyWatching.sort(
      (a, b) => new Date(b.lastWatchedAt) - new Date(a.lastWatchedAt)
    );

    res.status(200).json(sortedWatching);
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET WATCH HISTORY
router.get("/history", verify, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: "watchHistory.movie",
      select: "title img imgSm year",
    });

    // Sort by watched date (most recent first)
    const sortedHistory = user.watchHistory.sort(
      (a, b) => new Date(b.watchedAt) - new Date(a.watchedAt)
    );

    res.status(200).json(sortedHistory);
  } catch (err) {
    res.status(500).json(err);
  }
});

// ADD TO WATCHLIST
router.post("/watchlist", verify, async (req, res) => {
  try {
    const { movieId } = req.body;
    if (!movieId) return res.status(400).json("Movie ID is required");

    // Check if movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) return res.status(404).json("Movie not found");

    // Add to watchlist if not already there
    const user = await User.findById(req.user.id);
    if (user.watchlist.includes(movieId)) {
      return res.status(400).json("Movie already in Watchlist");
    }

    await User.findByIdAndUpdate(req.user.id, {
      $push: { watchlist: movieId },
    });

    res.status(200).json("Movie added to Watchlist");
  } catch (err) {
    res.status(500).json(err);
  }
});

// REMOVE FROM WATCHLIST
router.delete("/watchlist/:movieId", verify, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { watchlist: req.params.movieId },
    });

    res.status(200).json("Movie removed from Watchlist");
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET WATCHLIST
router.get("/watchlist", verify, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("watchlist");
    res.status(200).json(user.watchlist);
  } catch (err) {
    res.status(500).json(err);
  }
});

// UPDATE CURRENTLY WATCHING
router.put("/currently-watching/update/:id", verify, async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return res.status(404).json("Movie not found");
    }

    const user = await User.findById(req.user.id);

    // Find the movie in currently watching
    const movieIndex = user.currentlyWatching.findIndex(
      (item) => item.movie.toString() === req.params.id
    );

    if (movieIndex === -1) {
      // Movie not in currently watching, add it
      user.currentlyWatching.push({
        movie: req.params.id,
        lastWatchedAt: new Date(),
        progress: req.body.progress || 0,
        watchTime: req.body.watchTime || 0,
        pausePoints: req.body.pausePoints || [],
      });
    } else {
      // Update existing entry
      user.currentlyWatching[movieIndex].lastWatchedAt = new Date();
      user.currentlyWatching[movieIndex].progress =
        req.body.progress || user.currentlyWatching[movieIndex].progress;
      user.currentlyWatching[movieIndex].watchTime =
        req.body.watchTime || user.currentlyWatching[movieIndex].watchTime;

      // Update pause points if provided
      if (req.body.pausePoints) {
        user.currentlyWatching[movieIndex].pausePoints = req.body.pausePoints;
      }
    }

    // Update genre preferences
    if (movie.genre) {
      if (!user.genrePreferences) {
        user.genrePreferences = new Map();
      }

      const currentCount = user.genrePreferences.get(movie.genre) || 0;
      user.genrePreferences.set(movie.genre, currentCount + 1);
    }

    await user.save();
    res.status(200).json("Watch progress updated");
  } catch (err) {
    console.error("Error updating currently watching:", err);
    res.status(500).json(err);
  }
});

// ADD TO CURRENTLY WATCHING
router.put("/currently-watching/add/:id", verify, async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return res.status(404).json("Movie not found");
    }

    const user = await User.findById(req.user.id);

    // Check if movie is already in currently watching
    const movieIndex = user.currentlyWatching.findIndex(
      (item) => item.movie.toString() === req.params.id
    );

    if (movieIndex === -1) {
      // Add to currently watching
      user.currentlyWatching.push({
        movie: req.params.id,
        lastWatchedAt: new Date(),
        progress: req.body.progress || 0,
        watchTime: req.body.watchTime || 0,
      });

      // Update last login date for analytics
      user.lastLoginDate = new Date();

      // Update total watch time
      if (req.body.watchTime) {
        user.totalWatchTime = (user.totalWatchTime || 0) + req.body.watchTime;
      }

      // Update genre preferences
      if (movie.genre) {
        if (!user.genrePreferences) {
          user.genrePreferences = new Map();
        }

        const currentCount = user.genrePreferences.get(movie.genre) || 0;
        user.genrePreferences.set(movie.genre, currentCount + 1);
      }

      await user.save();
      res.status(200).json("Added to currently watching");
    } else {
      // Update existing entry
      user.currentlyWatching[movieIndex].lastWatchedAt = new Date();
      user.currentlyWatching[movieIndex].progress =
        req.body.progress || user.currentlyWatching[movieIndex].progress;
      user.currentlyWatching[movieIndex].watchTime =
        req.body.watchTime || user.currentlyWatching[movieIndex].watchTime;

      await user.save();
      res.status(200).json("Updated currently watching");
    }
  } catch (err) {
    console.error("Error adding to currently watching:", err);
    res.status(500).json(err);
  }
});

// ADD TO WATCH HISTORY
router.put("/watch-history/add/:id", verify, async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return res.status(404).json("Movie not found");
    }

    const user = await User.findById(req.user.id);

    // Check if movie is already in watch history
    const existingEntry = user.watchHistory.find(
      (item) => item.movie.toString() === req.params.id
    );

    if (existingEntry) {
      // Increment rewatch count
      existingEntry.rewatchCount = (existingEntry.rewatchCount || 0) + 1;
      existingEntry.watchedAt = new Date();
      existingEntry.progress = req.body.progress || 100;
      existingEntry.completed = req.body.completed || true;
      existingEntry.watchTime = req.body.watchTime || existingEntry.watchTime;

      if (req.body.dropOffPoint) {
        existingEntry.dropOffPoint = req.body.dropOffPoint;
      }
    } else {
      // Add to watch history
      user.watchHistory.push({
        movie: req.params.id,
        watchedAt: new Date(),
        progress: req.body.progress || 100,
        completed: req.body.completed || true,
        watchTime: req.body.watchTime || 0,
        dropOffPoint: req.body.dropOffPoint,
        rewatchCount: 0,
      });
    }

    // Update total watch time
    if (req.body.watchTime) {
      user.totalWatchTime = (user.totalWatchTime || 0) + req.body.watchTime;
    }

    // Update genre preferences
    if (movie.genre) {
      if (!user.genrePreferences) {
        user.genrePreferences = new Map();
      }

      const currentCount = user.genrePreferences.get(movie.genre) || 0;
      user.genrePreferences.set(movie.genre, currentCount + 1);
    }

    await user.save();
    res.status(200).json("Added to watch history");
  } catch (err) {
    console.error("Error adding to watch history:", err);
    res.status(500).json(err);
  }
});

// GET WATCH HISTORY
router.get("/watch-history", verify, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "watchHistory.movie"
    );

    // Format the response
    const watchHistory = user.watchHistory.map((item) => {
      const movie = item.movie;
      return {
        _id: movie._id,
        title: movie.title,
        desc: movie.desc,
        img: movie.img,
        imgTitle: movie.imgTitle,
        imgSm: movie.imgSm,
        trailer: movie.trailer,
        year: movie.year,
        limit: movie.limit,
        genre: movie.genre,
        duration: movie.duration,
        watchedAt: item.watchedAt,
        progress: item.progress,
        completed: item.completed,
        watchTime: item.watchTime,
        rewatchCount: item.rewatchCount,
      };
    });

    res.status(200).json(watchHistory);
  } catch (err) {
    console.error("Error getting watch history:", err);
    res.status(500).json(err);
  }
});

// GET CURRENTLY WATCHING
router.get("/currently-watching", verify, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "currentlyWatching.movie"
    );

    // Format the response
    const currentlyWatching = user.currentlyWatching.map((item) => {
      const movie = item.movie;
      return {
        _id: movie._id,
        title: movie.title,
        desc: movie.desc,
        img: movie.img,
        imgTitle: movie.imgTitle,
        imgSm: movie.imgSm,
        trailer: movie.trailer,
        year: movie.year,
        limit: movie.limit,
        genre: movie.genre,
        duration: movie.duration,
        progress: item.progress,
        lastWatchedAt: item.lastWatchedAt,
        watchTime: item.watchTime,
      };
    });

    res.status(200).json(currentlyWatching);
  } catch (err) {
    console.error("Error getting currently watching:", err);
    res.status(500).json(err);
  }
});

module.exports = router;
