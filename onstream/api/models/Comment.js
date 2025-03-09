const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    movieId: { type: String, required: true },
    comment: { type: String, required: true, maxlength: 1000 },
    username: { type: String, required: false }, // Store username for easier retrieval
    title: { type: String, required: false }, // Store movie title for easier retrieval
    approved: { type: Boolean, default: true }, // For moderation purposes
    likes: { type: Number, default: 0 }, // Number of likes on the comment
    likedBy: { type: [String], default: [] }, // Array of userIds who liked the comment
  },
  { timestamps: true }
);

module.exports = mongoose.model("Comment", CommentSchema); 