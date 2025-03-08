const router = require("express").Router();
const User = require("../models/User");
const Movie = require("../models/Movie");
const CryptoJS = require("crypto-js");
const verify = require("../verifyToken");
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
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET USER PROFILE
router.get("/profile", verify, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("myList", "title img imgSm year")
      .populate("favorites", "title img imgSm year")
      .populate({
        path: "watchHistory.movie",
        select: "title img imgSm year"
      })
      .populate({
        path: "currentlyWatching.movie",
        select: "title img imgSm year"
      })
      .populate("watchlist", "title img imgSm year");
    
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json(err);
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
      $push: { myList: movieId }
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
      $pull: { myList: req.params.movieId }
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
      $push: { favorites: movieId }
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
      $pull: { favorites: req.params.movieId }
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
    if (progress === undefined) return res.status(400).json("Progress is required");

    // Check if movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) return res.status(404).json("Movie not found");

    const user = await User.findById(req.user.id);
    
    // Check if movie is in currentlyWatching
    const watchingIndex = user.currentlyWatching.findIndex(
      item => item.movie.toString() === movieId
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
        lastWatchedAt: new Date()
      });
    }

    // If progress is 100%, move to watch history
    if (progress >= 95) {
      // Add to watch history if not already there
      const historyIndex = user.watchHistory.findIndex(
        item => item.movie.toString() === movieId
      );

      if (historyIndex === -1) {
        user.watchHistory.push({
          movie: movieId,
          watchedAt: new Date(),
          progress: 100,
          completed: true
        });
      }

      // Remove from currently watching if progress is 100%
      if (progress === 100) {
        user.currentlyWatching = user.currentlyWatching.filter(
          item => item.movie.toString() !== movieId
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
      select: "title img imgSm year duration"
    });
    
    // Sort by last watched (most recent first)
    const sortedWatching = user.currentlyWatching.sort((a, b) => 
      new Date(b.lastWatchedAt) - new Date(a.lastWatchedAt)
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
      select: "title img imgSm year"
    });
    
    // Sort by watched date (most recent first)
    const sortedHistory = user.watchHistory.sort((a, b) => 
      new Date(b.watchedAt) - new Date(a.watchedAt)
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
      $push: { watchlist: movieId }
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
      $pull: { watchlist: req.params.movieId }
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

module.exports = router;
