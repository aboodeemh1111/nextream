const router = require("express").Router();
const Review = require("../models/Review");
const Movie = require("../models/Movie");
const User = require("../models/User");
const verify = require("../verifyToken");

// Helper function to update movie ratings
async function updateMovieRatings(movieId) {
  try {
    // Get all approved reviews for the movie
    const reviews = await Review.find({ movieId, approved: true });
    
    // Calculate new rating values
    const numRatings = reviews.length;
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = numRatings > 0 ? (totalRating / numRatings) : 0;
    
    // Update the movie
    await Movie.findByIdAndUpdate(movieId, {
      numRatings,
      totalRating,
      avgRating: parseFloat(avgRating.toFixed(2)), // Round to 2 decimal places
    });
    
    // Return the updated rating info
    return { 
      numRatings, 
      totalRating, 
      avgRating: parseFloat(avgRating.toFixed(2))
    };
  } catch (err) {
    console.error("Error updating movie ratings:", err);
    throw err;
  }
}

// Create a review
router.post("/", verify, async (req, res) => {

  try {
    // Check if movie exists
    const movie = await Movie.findById(req.body.movieId);
    if (!movie) {
      return res.status(404).json("Movie not found");
    }

    // Check if user has already reviewed this movie
    const existingReview = await Review.findOne({
      userId: req.user.id,
      movieId: req.body.movieId,
    });

    if (existingReview) {
      // Convert duplicate into update to be idempotent for client UX
      existingReview.rating = req.body.rating;
      existingReview.review = req.body.review || existingReview.review || "";
      await existingReview.save();
      const updatedRatings = await updateMovieRatings(req.body.movieId);
      return res.status(200).json({ review: existingReview, movieRatings: updatedRatings });
    }

    // Get user info for storing username
    const user = await User.findById(req.user.id);
    
    // Create new review
    const newReview = new Review({
      userId: req.user.id,
      movieId: req.body.movieId,
      rating: req.body.rating,
      review: req.body.review || "",
      username: user.username,
      title: movie.title,
    });

    const savedReview = await newReview.save();
    
    // Update movie ratings
    const updatedRatings = await updateMovieRatings(req.body.movieId);
    
    res.status(201).json({
      review: savedReview,
      movieRatings: updatedRatings
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

// Update a review
router.put("/:id", verify, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json("Review not found");

    // Only the review owner or an admin can update the review
    if (review.userId === req.user.id || req.user.isAdmin) {
      const updatedReview = await Review.findByIdAndUpdate(
        req.params.id,
        {
          $set: req.body,
        },
        { new: true }
      );
      
      // Update movie ratings if the rating changed
      if (req.body.rating && req.body.rating !== review.rating) {
        const updatedRatings = await updateMovieRatings(review.movieId);
        res.status(200).json({
          review: updatedReview,
          movieRatings: updatedRatings
        });
      } else {
        res.status(200).json({
          review: updatedReview
        });
      }
    } else {
      res.status(403).json("You can update only your review");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// Delete a review
router.delete("/:id", verify, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json("Review not found");

    // Only the review owner or an admin can delete the review
    if (review.userId === req.user.id || req.user.isAdmin) {
      const movieId = review.movieId;
      await Review.findByIdAndDelete(req.params.id);
      
      // Update movie ratings
      const updatedRatings = await updateMovieRatings(movieId);
      
      res.status(200).json({
        message: "The review has been deleted",
        movieRatings: updatedRatings
      });
    } else {
      res.status(403).json("You can delete only your review");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// Like a review
router.put("/:id/like", verify, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json("Review not found");

    // Check if user has already liked this review
    if (review.likedBy.includes(req.user.id)) {
      // Unlike the review
      await Review.findByIdAndUpdate(req.params.id, {
        $pull: { likedBy: req.user.id },
        $inc: { likes: -1 },
      });
      res.status(200).json("The review has been unliked");
    } else {
      // Like the review
      await Review.findByIdAndUpdate(req.params.id, {
        $push: { likedBy: req.user.id },
        $inc: { likes: 1 },
      });
      res.status(200).json("The review has been liked");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// Get all reviews for a movie
router.get("/movie/:movieId", async (req, res) => {
  try {
    const reviews = await Review.find({ 
      movieId: req.params.movieId,
      approved: true 
    }).sort({ createdAt: -1 });
    res.status(200).json(reviews);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Get a user's review for a specific movie
router.get("/user/:userId/movie/:movieId", verify, async (req, res) => {
  try {
    // Only the user or an admin can see the user's review
    if (req.params.userId === req.user.id || req.user.isAdmin) {
      const review = await Review.findOne({
        userId: req.params.userId,
        movieId: req.params.movieId,
      });
      
      if (!review) {
        return res.status(404).json("Review not found");
      }
      
      res.status(200).json(review);
    } else {
      res.status(403).json("You can only access your own reviews");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// Get all reviews by a user
router.get("/user/:userId", verify, async (req, res) => {
  try {
    // Only the user or an admin can see all the user's reviews
    if (req.params.userId === req.user.id || req.user.isAdmin) {
      const reviews = await Review.find({ userId: req.params.userId }).sort({
        createdAt: -1,
      });
      res.status(200).json(reviews);
    } else {
      res.status(403).json("You can only access your own reviews");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// Admin routes

// Get all reviews (admin only)
router.get("/", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed to see all reviews");
  }

  const query = req.query.new;
  const movieId = req.query.movieId;
  const approved = req.query.approved;

  try {
    let reviews;

    if (query) {
      // Get latest reviews
      reviews = await Review.find().sort({ createdAt: -1 }).limit(10);
    } else if (movieId) {
      // Get reviews for a specific movie
      reviews = await Review.find({ movieId });
    } else if (approved !== undefined) {
      // Get approved or unapproved reviews
      reviews = await Review.find({ approved: approved === "true" });
    } else {
      // Get all reviews
      reviews = await Review.find();
    }

    res.status(200).json(reviews);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Approve or disapprove a review (admin only)
router.put("/:id/approve", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed to approve reviews");
  }

  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json("Review not found");
    }
    
    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      {
        $set: { approved: req.body.approved },
      },
      { new: true }
    );

    // Update movie ratings since approval status changed
    const updatedRatings = await updateMovieRatings(review.movieId);
    
    res.status(200).json({
      review: updatedReview,
      movieRatings: updatedRatings
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

// Get review stats for admin dashboard
router.get("/stats", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed to see review stats");
  }

  try {
    // Get total number of reviews
    const totalReviews = await Review.countDocuments();

    // Get average rating across all movies
    const ratingStats = await Review.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get distribution of ratings
    const ratingDistribution = await Review.aggregate([
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get top rated movies
    const topRatedMovies = await Review.aggregate([
      {
        $group: {
          _id: "$movieId",
          title: { $first: "$title" },
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
      { $sort: { averageRating: -1, reviewCount: -1 } },
      { $limit: 10 },
    ]);

    // Get most reviewed movies
    const mostReviewedMovies = await Review.aggregate([
      {
        $group: {
          _id: "$movieId",
          title: { $first: "$title" },
          reviewCount: { $sum: 1 },
          averageRating: { $avg: "$rating" },
        },
      },
      { $sort: { reviewCount: -1 } },
      { $limit: 10 },
    ]);

    // Get recent reviews
    const recentReviews = await Review.find()
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      totalReviews,
      averageRating: ratingStats.length > 0 ? ratingStats[0].averageRating : 0,
      ratingDistribution,
      topRatedMovies,
      mostReviewedMovies,
      recentReviews,
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router; 