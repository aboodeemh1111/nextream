const router = require("express").Router();
const Movie = require("../models/Movie");
const User = require("../models/User");
const verify = require("../verifyToken");

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
      details: err.errors
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
      details: err.errors
    });
  }
});

// DELETE MOVIE
router.delete("/:id", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  try {
    const movie = await Movie.findById(req.params.id);
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
        { $sample: { size: 1 } }
      ]);
    } else if (type === "movie") {
      movie = await Movie.aggregate([
        { $match: { isSeries: false } },
        { $sample: { size: 1 } }
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
router.get("/featured", verify, async (req, res) => {
  const userId = req.user.id;
  const type = req.query.type;
  
  try {
    // Get user data for personalization
    const user = await User.findById(userId)
      .populate("watchHistory.movie")
      .populate("currentlyWatching.movie")
      .populate("favorites")
      .populate("myList");
    
    // New user with no history - return trending content
    if (!user.watchHistory.length && !user.currentlyWatching.length && !user.favorites.length) {
      // For new users, get trending content (most recently added with good rating)
      const trendingContent = await Movie.aggregate([
        { $match: type ? { isSeries: type === "series" } : {} },
        { $sort: { createdAt: -1 } },
        { $limit: 10 }
      ]);
      
      // Randomly select one from trending
      const randomIndex = Math.floor(Math.random() * trendingContent.length);
      return res.status(200).json([trendingContent[randomIndex]]);
    }
    
    // Extract user preferences
    const genrePreferences = {};
    const watchedMovieIds = new Set();
    
    // Process watch history
    user.watchHistory.forEach(item => {
      if (item.movie && item.movie.genre) {
        genrePreferences[item.movie.genre] = (genrePreferences[item.movie.genre] || 0) + 2;
        watchedMovieIds.add(item.movie._id.toString());
      }
    });
    
    // Process currently watching
    user.currentlyWatching.forEach(item => {
      if (item.movie && item.movie.genre) {
        genrePreferences[item.movie.genre] = (genrePreferences[item.movie.genre] || 0) + 3;
        watchedMovieIds.add(item.movie._id.toString());
      }
    });
    
    // Process favorites
    user.favorites.forEach(movie => {
      if (movie && movie.genre) {
        genrePreferences[movie.genre] = (genrePreferences[movie.genre] || 0) + 4;
        watchedMovieIds.add(movie._id.toString());
      }
    });
    
    // Process my list
    user.myList.forEach(movie => {
      if (movie && movie.genre) {
        genrePreferences[movie.genre] = (genrePreferences[movie.genre] || 0) + 1;
      }
    });
    
    // Find top genres
    const sortedGenres = Object.entries(genrePreferences)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
    
    // If we have genre preferences
    if (sortedGenres.length > 0) {
      // Get content from preferred genres that user hasn't watched yet
      const topGenres = sortedGenres.slice(0, 3); // Top 3 genres
      
      const recommendedContent = await Movie.find({
        genre: { $in: topGenres },
        _id: { $nin: Array.from(watchedMovieIds) },
        ...(type ? { isSeries: type === "series" } : {})
      }).limit(20);
      
      if (recommendedContent.length > 0) {
        // Randomly select one from recommendations
        const randomIndex = Math.floor(Math.random() * recommendedContent.length);
        return res.status(200).json([recommendedContent[randomIndex]]);
      }
    }
    
    // Fallback: Get content similar to what user has watched but not the same
    const fallbackQuery = {
      _id: { $nin: Array.from(watchedMovieIds) },
      ...(type ? { isSeries: type === "series" } : {})
    };
    
    // Add genre preference if available
    if (sortedGenres.length > 0) {
      fallbackQuery.genre = sortedGenres[0];
    }
    
    const fallbackContent = await Movie.find(fallbackQuery).limit(10);
    
    if (fallbackContent.length > 0) {
      // Randomly select one from fallback
      const randomIndex = Math.floor(Math.random() * fallbackContent.length);
      return res.status(200).json([fallbackContent[randomIndex]]);
    }
    
    // Final fallback: Just get random content
    const randomContent = await Movie.aggregate([
      { $match: type ? { isSeries: type === "series" } : {} },
      { $sample: { size: 1 } }
    ]);
    
    res.status(200).json(randomContent);
    
  } catch (err) {
    console.error("Featured content error:", err);
    res.status(500).json(err);
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
      title: { $regex: query, $options: 'i' }
    })
    .select('_id title img imgSm genre year isSeries') // Only select fields we need
    .limit(8)
    .sort({ year: -1 }); // Sort by newest first
    
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
        { title: { $regex: query, $options: 'i' } },
        { desc: { $regex: query, $options: 'i' } },
        { genre: { $regex: query, $options: 'i' } }
      ]
    };
    
    // Add type filter if specified
    if (req.query.isSeries !== undefined) {
      searchCriteria.isSeries = req.query.isSeries === 'true';
    }
    
    // Add genre filter if specified
    if (req.query.genre) {
      // Override the OR condition for genre with exact match
      searchCriteria.$and = [
        { $or: [
            { title: { $regex: query, $options: 'i' } },
            { desc: { $regex: query, $options: 'i' } }
          ]
        },
        { genre: { $regex: `^${req.query.genre}$`, $options: 'i' } }
      ];
      // Remove the original $or that included genre
      delete searchCriteria.$or;
    }
    
    const movies = await Movie.find(searchCriteria)
      .limit(50) // Limit results to 50 for performance
      .sort({ year: -1, title: 1 }); // Sort by newest first, then alphabetically
    
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
    if (req.query.type === 'series') {
      query.isSeries = true;
    } else if (req.query.type === 'movie') {
      query.isSeries = false;
    }
    
    // Filter by genre
    if (req.query.genre) {
      query.genre = req.query.genre;
    }
    
    // Search by title
    if (req.query.search) {
      query.title = { $regex: req.query.search, $options: 'i' };
    }

    const movies = await Movie.find(query).sort({ createdAt: -1 });
    res.status(200).json(movies);
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
      details: err.message
    });
  }
});

module.exports = router;
