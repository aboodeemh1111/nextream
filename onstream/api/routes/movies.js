const router = require("express").Router();
const Movie = require("../models/Movie");
const User = require("../models/User");
const verify = require("../verifyToken");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// CREATE MOVIE
router.post("/", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  const newMovie = new Movie(req.body);
  try {
    const savedMovie = await newMovie.save();
    res.status(201).json(savedMovie);
  } catch (err) {
    res.status(500).json({
      error: err.message,
      details: err.errors,
    });
  }
});

// UPDATE MOVIE
router.put("/:id", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  try {
    const updatedMovie = await Movie.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updatedMovie) {
      return res.status(404).json("Movie not found");
    }
    res.status(200).json(updatedMovie);
  } catch (err) {
    res.status(500).json({
      error: err.message,
      details: err.errors,
    });
  }
});

// DELETE MOVIE
router.delete("/:id", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  try {
    const movie = await Movie.findById(req.params.id).lean();
    if (!movie) {
      return res.status(404).json("Movie not found");
    }
    await Movie.findByIdAndDelete(req.params.id);
    res.status(200).json("Movie has been deleted");
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET MOVIE BY ID
router.get("/find/:id", verify, async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return res.status(404).json("Movie not found");
    }
    res.status(200).json(movie);
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET RANDOM MOVIE
router.get("/random", verify, async (req, res) => {
  const type = req.query.type;
  try {
    let movie;
    if (type === "series") {
      movie = await Movie.aggregate([
        { $match: { isSeries: true } },
        { $sample: { size: 1 } },
      ]);
    } else if (type === "movie") {
      movie = await Movie.aggregate([
        { $match: { isSeries: false } },
        { $sample: { size: 1 } },
      ]);
    } else {
      movie = await Movie.aggregate([{ $sample: { size: 1 } }]);
    }
    res.status(200).json(movie[0]);
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET PERSONALIZED FEATURED CONTENT
router.get("/featured", async (req, res) => {
  // Try to read userId from token if provided; otherwise treat as anonymous
  let userId = null;
  const authHeader = req.headers.token;
  if (authHeader) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      userId = decoded?.id || null;
    } catch (e) {
      // ignore invalid tokens; proceed as anonymous
    }
  }
  const type = req.query.type;

  try {
    // If database is not connected, return a deterministic demo payload to avoid 500s
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json([
        {
          _id: 'demo-featured',
          title: 'Nextream Showcase',
          desc: 'Database not connected yet. Showing a demo featured title. Configure MONGO_URL and seed data to enable recommendations.',
          img: 'https://images.unsplash.com/photo-1517602302552-471fe67acf66?q=80&w=1920&auto=format&fit=crop',
          imgTitle: undefined,
          trailer: undefined,
          year: '2024',
          limit: 12,
          genre: 'Demo',
          duration: '2h 00m',
          isSeries: false,
        },
      ]);
    }

    // Get user data for personalization
    let user = null;
    if (userId) {
      user = await User.findById(userId)
        .populate({ path: "watchHistory.movie", select: "genre _id" })
        .populate({ path: "currentlyWatching.movie", select: "genre _id" })
        .populate({ path: "favorites", select: "genre _id" })
        .populate({ path: "myList", select: "genre _id" })
        .select("watchHistory currentlyWatching favorites myList")
        .lean();
    }

    // If user not found or new user with no history - return trending content
    if (
      !user ||
      (!user.watchHistory?.length &&
        !user.currentlyWatching?.length &&
        !user.favorites?.length)
    ) {
      // For new users, get trending content (most recently added with good rating)
      const trendingContent = await Movie.aggregate([
        { $match: type ? { isSeries: type === "series" } : {} },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
      ]);

      if (trendingContent.length > 0) {
        // Randomly select one from trending
        const randomIndex = Math.floor(Math.random() * trendingContent.length);
        return res.status(200).json([trendingContent[randomIndex]]);
      }
      // Fallback to random if no trending
      const randomContent = await Movie.aggregate([
        { $match: type ? { isSeries: type === "series" } : {} },
        { $sample: { size: 1 } },
      ]);
      return res.status(200).json(randomContent);
    }

    // Extract user preferences
    const genrePreferences = {};
    const watchedMovieIds = new Set();

    // Process watch history
    (user.watchHistory || []).forEach((item) => {
      if (item.movie && item.movie.genre) {
        genrePreferences[item.movie.genre] =
          (genrePreferences[item.movie.genre] || 0) + 2;
        watchedMovieIds.add(item.movie._id.toString());
      }
    });

    // Process currently watching
    (user.currentlyWatching || []).forEach((item) => {
      if (item.movie && item.movie.genre) {
        genrePreferences[item.movie.genre] =
          (genrePreferences[item.movie.genre] || 0) + 3;
        watchedMovieIds.add(item.movie._id.toString());
      }
    });

    // Process favorites
    (user.favorites || []).forEach((movie) => {
      if (movie && movie.genre) {
        genrePreferences[movie.genre] =
          (genrePreferences[movie.genre] || 0) + 4;
        watchedMovieIds.add(movie._id.toString());
      }
    });

    // Process my list
    (user.myList || []).forEach((movie) => {
      if (movie && movie.genre) {
        genrePreferences[movie.genre] =
          (genrePreferences[movie.genre] || 0) + 1;
      }
    });

    // Find top genres
    const sortedGenres = Object.entries(genrePreferences)
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    // If we have genre preferences
    if (sortedGenres.length > 0) {
      // Get content from preferred genres that user hasn't watched yet
      const topGenres = sortedGenres.slice(0, 3); // Top 3 genres

      const recommendedContent = await Movie.find({
        genre: { $in: topGenres },
        _id: { $nin: Array.from(watchedMovieIds) },
        ...(type ? { isSeries: type === "series" } : {}),
      })
        .select("title img imgSm imgTitle trailer year limit genre duration")
        .limit(20)
        .lean();

      if (recommendedContent.length > 0) {
        // Randomly select one from recommendations
        const randomIndex = Math.floor(
          Math.random() * recommendedContent.length
        );
        return res.status(200).json([recommendedContent[randomIndex]]);
      }
    }

    // Fallback: Get content similar to what user has watched but not the same
    const fallbackQuery = {
      _id: { $nin: Array.from(watchedMovieIds) },
      ...(type ? { isSeries: type === "series" } : {}),
    };

    // Add genre preference if available
    if (sortedGenres.length > 0) {
      fallbackQuery.genre = sortedGenres[0];
    }

    const fallbackContent = await Movie.find(fallbackQuery)
      .select("title img imgSm imgTitle trailer year limit genre duration")
      .limit(10)
      .lean();

    if (fallbackContent.length > 0) {
      // Randomly select one from fallback
      const randomIndex = Math.floor(Math.random() * fallbackContent.length);
      return res.status(200).json([fallbackContent[randomIndex]]);
    }

    // Final fallback: Just get random content. If still empty, return deterministic 204 with message
    const randomContent = await Movie.aggregate([
      { $match: type ? { isSeries: type === "series" } : {} },
      { $sample: { size: 1 } },
    ]);

    if (!randomContent || randomContent.length === 0) {
      // Static demo fallback to avoid 500s/empty UI during local setup
      const demo = [{
        _id: 'demo-featured',
        title: 'Nextream Showcase',
        desc: 'A demo featured title appears while your database is empty. Seed your DB to see real content.',
        img: 'https://images.unsplash.com/photo-1517602302552-471fe67acf66?q=80&w=1920&auto=format&fit=crop',
        imgTitle: undefined,
        trailer: undefined,
        year: '2024',
        limit: 12,
        genre: 'Demo',
        duration: '2h 00m',
        isSeries: false
      }];
      return res.status(200).json(demo);
    }

    res.status(200).json(randomContent);
  } catch (err) {
    console.error("Featured content error:", err);
    res.status(500).json({
      error: 'FEATURED_CONTENT_ERROR',
      message: err?.message || 'Unknown error',
      stack: process.env.NODE_ENV !== 'production' ? err?.stack : undefined
    });
  }
});

// SEARCH SUGGESTIONS (FOR AUTOCOMPLETE)
router.get("/suggestions", verify, async (req, res) => {
  const query = req.query.q;

  if (!query || query.length < 2) {
    return res.status(200).json([]);
  }

  try {
    // Search in title with priority, limit to 8 results for quick suggestions
    const movies = await Movie.find({
      title: { $regex: query, $options: "i" },
    })
      .select("_id title img imgSm genre year isSeries")
      .limit(8)
      .sort({ year: -1 })
      .lean();

    res.status(200).json(movies);
  } catch (err) {
    res.status(500).json(err);
  }
});

// SEARCH MOVIES (FOR CLIENT)
router.get("/search", verify, async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json("Search query is required");
  }

  try {
    // Build search criteria
    const searchCriteria = {
      $or: [
        { title: { $regex: query, $options: "i" } },
        { desc: { $regex: query, $options: "i" } },
        { genre: { $regex: query, $options: "i" } },
      ],
    };

    // Add type filter if specified
    if (req.query.isSeries !== undefined) {
      searchCriteria.isSeries = req.query.isSeries === "true";
    }

    // Add genre filter if specified
    if (req.query.genre) {
      // Override the OR condition for genre with exact match
      searchCriteria.$and = [
        {
          $or: [
            { title: { $regex: query, $options: "i" } },
            { desc: { $regex: query, $options: "i" } },
          ],
        },
        { genre: { $regex: `^${req.query.genre}$`, $options: "i" } },
      ];
      // Remove the original $or that included genre
      delete searchCriteria.$or;
    }

    const movies = await Movie.find(searchCriteria)
      .select(
        "title img imgSm imgTitle trailer year limit genre duration isSeries"
      )
      .limit(50)
      .sort({ year: -1, title: 1 })
      .lean();

    res.status(200).json(movies);
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET ALL MOVIES (WITH FILTERS)
router.get("/", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  try {
    const query = {};

    // Filter by type (series/movie)
    if (req.query.type === "series") {
      query.isSeries = true;
    } else if (req.query.type === "movie") {
      query.isSeries = false;
    }

    // Filter by genre
    if (req.query.genre) {
      query.genre = req.query.genre;
    }

    // Search by title
    if (req.query.search) {
      query.title = { $regex: req.query.search, $options: "i" };
    }

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(req.query.pageSize || "50", 10), 1),
      200
    );
    const movies = await Movie.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();
    const total = await Movie.countDocuments(query);
    res.status(200).json({ data: movies, page, pageSize, total });
  } catch (err) {
    res.status(500).json(err);
  }
});

// INCREMENT MOVIE VIEWS
router.put("/views/:id", verify, async (req, res) => {
  try {
    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!movie) {
      return res.status(404).json("Movie not found");
    }

    res.status(200).json({ views: movie.views });
  } catch (err) {
    console.error("Error incrementing movie views:", err);
    res.status(500).json({
      error: "Failed to increment movie views",
      details: err.message,
    });
  }
});

module.exports = router;
