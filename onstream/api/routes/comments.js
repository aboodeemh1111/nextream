const router = require("express").Router();
const Comment = require("../models/Comment");
const Movie = require("../models/Movie");
const User = require("../models/User");
const verify = require("../verifyToken");

// Create a comment
router.post("/", verify, async (req, res) => {
  try {
    // Check if movie exists
    const movie = await Movie.findById(req.body.movieId);
    if (!movie) {
      return res.status(404).json("Movie not found");
    }

    // Get user info for storing username
    const user = await User.findById(req.user.id);
    
    // Create new comment
    const newComment = new Comment({
      userId: req.user.id,
      movieId: req.body.movieId,
      comment: req.body.comment,
      username: user.username,
      title: movie.title,
    });

    const savedComment = await newComment.save();
    
    res.status(201).json(savedComment);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Update a comment
router.put("/:id", verify, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json("Comment not found");

    // Only the comment owner or an admin can update the comment
    if (comment.userId === req.user.id || req.user.isAdmin) {
      const updatedComment = await Comment.findByIdAndUpdate(
        req.params.id,
        {
          $set: req.body,
        },
        { new: true }
      );
      
      res.status(200).json(updatedComment);
    } else {
      res.status(403).json("You can update only your comment");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// Delete a comment
router.delete("/:id", verify, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json("Comment not found");

    // Only the comment owner or an admin can delete the comment
    if (comment.userId === req.user.id || req.user.isAdmin) {
      await Comment.findByIdAndDelete(req.params.id);
      
      res.status(200).json("The comment has been deleted");
    } else {
      res.status(403).json("You can delete only your comment");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// Like a comment
router.put("/:id/like", verify, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json("Comment not found");

    // Check if user has already liked this comment
    if (comment.likedBy.includes(req.user.id)) {
      // Unlike the comment
      await Comment.findByIdAndUpdate(req.params.id, {
        $pull: { likedBy: req.user.id },
        $inc: { likes: -1 },
      });
      res.status(200).json("The comment has been unliked");
    } else {
      // Like the comment
      await Comment.findByIdAndUpdate(req.params.id, {
        $push: { likedBy: req.user.id },
        $inc: { likes: 1 },
      });
      res.status(200).json("The comment has been liked");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// Get all comments for a movie
router.get("/movie/:movieId", async (req, res) => {
  try {
    const comments = await Comment.find({ 
      movieId: req.params.movieId,
      approved: true 
    }).sort({ createdAt: -1 });
    res.status(200).json(comments);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Get all comments by a user
router.get("/user/:userId", verify, async (req, res) => {
  try {
    // Only the user or an admin can see all the user's comments
    if (req.params.userId === req.user.id || req.user.isAdmin) {
      const comments = await Comment.find({ userId: req.params.userId }).sort({
        createdAt: -1,
      });
      res.status(200).json(comments);
    } else {
      res.status(403).json("You can only access your own comments");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// Admin routes

// Get all comments (admin only)
router.get("/", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed to see all comments");
  }

  const query = req.query.new;
  const movieId = req.query.movieId;
  const approved = req.query.approved;

  try {
    let comments;

    if (query) {
      // Get latest comments
      comments = await Comment.find().sort({ createdAt: -1 }).limit(10);
    } else if (movieId) {
      // Get comments for a specific movie
      comments = await Comment.find({ movieId });
    } else if (approved !== undefined) {
      // Get approved/unapproved comments
      comments = await Comment.find({ approved: approved === 'true' });
    } else {
      // Get all comments
      comments = await Comment.find();
    }
    res.status(200).json(comments);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Approve/disapprove a comment (admin only)
router.put("/:id/approve", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed to approve comments");
  }

  try {
    const updatedComment = await Comment.findByIdAndUpdate(
      req.params.id,
      {
        $set: { approved: req.body.approved },
      },
      { new: true }
    );
    res.status(200).json(updatedComment);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router; 