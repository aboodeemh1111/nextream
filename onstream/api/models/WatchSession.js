const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * One row per playback session, for movies and TV episodes alike.
 *
 * This is the analytics source of truth. Progress stores answer "where do I
 * resume"; they cannot answer "how long did they actually watch", "on what
 * device", or "where did they drop off", because they only ever keep the
 * latest position. A session row keeps the whole shape of one sitting.
 *
 * Counters live here rather than as `$inc`s on the User document because an
 * increment can never be corrected: a dropped ack, a retried heartbeat or a
 * refreshed tab all inflate it, and nothing downstream can tell the difference
 * later. A heartbeat instead rewrites its own session row with the client's
 * running total, so replaying the same heartbeat twice is a no-op. User-level
 * rollups are recomputed from the delta between the stored and incoming value.
 *
 * Title and genre are denormalised so the profile aggregations stay a single
 * indexed scan, and so a session still reads correctly after the title it
 * points at has been deleted from the catalogue.
 */
const WatchSessionSchema = new Schema(
  {
    // Client-generated per sitting. Scoped to the user so a hostile or buggy
    // client cannot overwrite somebody else's session by guessing an id.
    sessionId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    contentType: { type: String, enum: ["movie", "episode"], required: true },
    contentId: { type: Schema.Types.ObjectId, required: true },

    // Episode sessions only — lets "which shows did they watch" avoid a join.
    showId: { type: Schema.Types.ObjectId, ref: "TVShow", default: null },
    seasonNumber: { type: Number, default: null },
    episodeNumber: { type: Number, default: null },

    title: { type: String, default: "" },
    genre: { type: String, default: "" },

    startedAt: { type: Date, default: Date.now },
    lastHeartbeatAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },

    // Wall-clock seconds the media element actually spent playing. Distinct
    // from position: seeking forward does not earn watch time, and a rewatch
    // within the same sitting does.
    secondsWatched: { type: Number, default: 0 },

    positionSec: { type: Number, default: 0 },
    // Retained separately from position so a viewer who watches to the end and
    // then seeks back still registers as having reached the end.
    maxPositionSec: { type: Number, default: 0 },
    durationSec: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },

    device: {
      type: {
        type: String,
        enum: ["desktop", "mobile", "tablet", "tv", "unknown"],
        default: "unknown",
      },
      os: { type: String, default: "unknown" },
      browser: { type: String, default: "unknown" },
      userAgent: { type: String, default: "" },
    },

    // Quality of experience, reported by the player. Populated only for the
    // real <video> players; iframe embeds leave these at zero.
    qoe: {
      startupMs: { type: Number, default: 0 },
      rebufferCount: { type: Number, default: 0 },
      rebufferSec: { type: Number, default: 0 },
      errorCount: { type: Number, default: 0 },
      lastError: { type: String, default: "" },
      qualityLabel: { type: String, default: "" },
      qualitySwitches: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// The upsert key for every heartbeat.
WatchSessionSchema.index({ userId: 1, sessionId: 1 }, { unique: true });
// Profile timeline, recent sessions, and the activity window all read this.
WatchSessionSchema.index({ userId: 1, startedAt: -1 });
// "How much of this title has this viewer watched across sittings".
WatchSessionSchema.index({ userId: 1, contentType: 1, contentId: 1 });
// Per-title analytics across all viewers (drop-off, QoE by title).
WatchSessionSchema.index({ contentId: 1, startedAt: -1 });
// Platform-wide rollups over a date window.
WatchSessionSchema.index({ startedAt: -1 });

module.exports = mongoose.model("WatchSession", WatchSessionSchema);
