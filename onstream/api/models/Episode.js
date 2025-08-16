const mongoose = require('mongoose');
const { Schema } = mongoose;

const EpisodeSchema = new Schema(
  {
    showId: { type: Schema.Types.ObjectId, ref: 'TVShow', index: true, required: true },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', index: true, required: true },
    seasonNumber: { type: Number, required: true },
    episodeNumber: { type: Number, required: true },
    title: { type: String, required: true, index: true },
    overview: String,
    airDate: Date,
    duration: Number,
    stillPath: String,
    videoSources: [{ label: String, url: String }],
    subtitles: [{ lang: String, url: String }],
    thumbnails: [String],
    published: { type: Boolean, default: false },
    deepLink: String,
  },
  { timestamps: true }
);

EpisodeSchema.index({ showId: 1, seasonNumber: 1, episodeNumber: 1 }, { unique: true });

module.exports = mongoose.model('Episode', EpisodeSchema);


