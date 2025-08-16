const mongoose = require('mongoose');
const { Schema } = mongoose;

const SeasonSchema = new Schema(
  {
    showId: { type: Schema.Types.ObjectId, ref: 'TVShow', index: true, required: true },
    seasonNumber: { type: Number, required: true },
    name: String,
    overview: String,
    poster: String,
    backdrop: String,
    airDate: Date,
    published: { type: Boolean, default: false },
    episodesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SeasonSchema.index({ showId: 1, seasonNumber: 1 }, { unique: true });

module.exports = mongoose.model('Season', SeasonSchema);


