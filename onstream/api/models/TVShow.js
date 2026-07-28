const mongoose = require('mongoose');
const { Schema } = mongoose;

const TVShowSchema = new Schema(
  {
    title: { type: String, required: true, index: true },
    slug: { type: String, unique: true, index: true, sparse: true },
    overview: String,
    genres: [String],
    status: { type: String, enum: ['ongoing', 'ended'], default: 'ongoing' },
    poster: String,
    backdrop: String,
    trailerUrl: String,
    tags: [String],
    tmdbId: Number,
    rating: Number,
    releaseYear: Number,
    isSeries: { type: Boolean, default: true },
    published: { type: Boolean, default: false },
    seasonsCount: { type: Number, default: 0 },
    episodesCount: { type: Number, default: 0 },
    lastAirDate: Date,
    // Incremented the first time a viewer starts an episode. Drives the
    // trending row and the Top 10; without it "popular" could only ever mean
    // "recently created", which never changes as the catalogue ages.
    views: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TVShow', TVShowSchema);


