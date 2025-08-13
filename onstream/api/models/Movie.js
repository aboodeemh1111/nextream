const mongoose = require("mongoose");

const MovieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true },
    desc: { type: String },
    img: { type: String },
    imgTitle: { type: String },
    imgSm: { type: String },
    trailer: { type: String },
    video: { type: String },
    year: { type: String },
    limit: { type: Number },
    genre: { type: String },
    isSeries: { type: Boolean, default: false },
    duration: { type: String },
    views: { type: Number, default: 0 },
    // Rating information
    avgRating: { type: Number, default: 0 },
    numRatings: { type: Number, default: 0 },
    totalRating: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Performance indexes
MovieSchema.index({ title: 1 });
MovieSchema.index({ genre: 1 });
MovieSchema.index({ isSeries: 1 });
MovieSchema.index({ createdAt: -1 });
MovieSchema.index({ year: -1 });

module.exports = mongoose.model("Movie", MovieSchema);
