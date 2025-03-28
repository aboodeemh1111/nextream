const mongoose = require("mongoose");

const EpisodeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    episodeNumber: { type: Number, required: true },
    duration: { type: String },
    thumbnail: { type: String },
    video: { type: String, required: true },
    trailer: { type: String },
    releaseDate: { type: String },
    director: { type: String },
    isPreview: { type: Boolean, default: false },
    subtitles: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      required: true,
    },
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
      required: true,
    },
  },
  { timestamps: true }
);

// Add index for efficient queries
EpisodeSchema.index({ seasonId: 1, episodeNumber: 1 }, { unique: true });
EpisodeSchema.index({ seriesId: 1 });

module.exports = mongoose.model("Episode", EpisodeSchema);
