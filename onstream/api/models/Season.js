const mongoose = require("mongoose");

const SeasonSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    seasonNumber: { type: Number, required: true },
    year: { type: String },
    poster: { type: String },
    episodes: { type: Number, default: 0 },
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
      required: true,
    },
  },
  { timestamps: true }
);

// Add index for efficient queries
SeasonSchema.index({ seriesId: 1, seasonNumber: 1 }, { unique: true });

module.exports = mongoose.model("Season", SeasonSchema);
