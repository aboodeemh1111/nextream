const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    movieId: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, required: false, maxlength: 1000 },
    username: { type: String, required: false }, // Store username for easier retrieval
    title: { type: String, required: false }, // Store movie title for easier retrieval
    approved: { type: Boolean, default: true }, // For moderation purposes
    likes: { type: Number, default: 0 }, // Number of likes on the review
    likedBy: { type: [String], default: [] }, // Array of userIds who liked the review
  },
  { timestamps: true }
);

// Compound index to ensure a user can only review a movie once
ReviewSchema.index({ userId: 1, movieId: 1 }, { unique: true });

module.exports = mongoose.model("Review", ReviewSchema); 