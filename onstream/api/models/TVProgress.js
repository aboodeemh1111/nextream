const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Per-user, per-episode playback progress.
 *
 * Kept out of the User document on purpose. `User.currentlyWatching` is an
 * embedded array that refs Movie, so a binge-watcher would grow their own
 * document without bound and every progress ping would rewrite the whole array.
 * A separate collection keyed on (userId, episodeId) makes a ping a single
 * upsert, and "where am I in this show" a single indexed query.
 */
const TVProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    showId: { type: Schema.Types.ObjectId, ref: 'TVShow', required: true, index: true },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', required: true },
    episodeId: { type: Schema.Types.ObjectId, ref: 'Episode', required: true },

    // Denormalised so "next up" can order episodes without joining Episode.
    seasonNumber: { type: Number, required: true },
    episodeNumber: { type: Number, required: true },

    positionSec: { type: Number, default: 0 },
    durationSec: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },

    watchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One row per user/episode — progress pings are upserts against this.
TVProgressSchema.index({ userId: 1, episodeId: 1 }, { unique: true });
// "Continue watching" and next-up both read the newest rows for a show.
TVProgressSchema.index({ userId: 1, showId: 1, watchedAt: -1 });
TVProgressSchema.index({ userId: 1, watchedAt: -1 });

module.exports = mongoose.model('TVProgress', TVProgressSchema);
