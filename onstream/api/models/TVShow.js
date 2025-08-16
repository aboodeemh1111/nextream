const mongoose = require('mongoose');
const { Schema } = mongoose;

const TVShowSchema = new Schema(
  {
    title: { type: String, required: true, index: true },
    slug: { type: String, unique: true, index: true },
    overview: String,
    genres: [String],
    status: { type: String, enum: ['ongoing', 'ended'], default: 'ongoing' },
    poster: String,
    backdrop: String,
    tags: [String],
    tmdbId: Number,
    rating: Number,
    releaseYear: Number,
    isSeries: { type: Boolean, default: true },
    published: { type: Boolean, default: false },
    seasonsCount: { type: Number, default: 0 },
    episodesCount: { type: Number, default: 0 },
    lastAirDate: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('TVShow', TVShowSchema);


