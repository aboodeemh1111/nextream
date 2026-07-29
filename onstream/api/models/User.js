const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    isAdmin: { type: Boolean, default: false },
    myList: [{ type: mongoose.Schema.Types.ObjectId, ref: "Movie" }],
    // myList refs Movie, so TV shows (a separate collection) need their own
    // list rather than a mixed-ref array that would break every populate above.
    myShows: [{ type: mongoose.Schema.Types.ObjectId, ref: "TVShow" }],
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Movie" }],
    watchHistory: [
      { 
        movie: { type: mongoose.Schema.Types.ObjectId, ref: "Movie" },
        watchedAt: { type: Date, default: Date.now },
        progress: { type: Number, default: 100 }, // percentage watched
        completed: { type: Boolean, default: true },
        watchTime: { type: Number, default: 0 }, // time in seconds
        dropOffPoint: { type: Number }, // timestamp in seconds where user stopped watching
        rewatchCount: { type: Number, default: 0 } // how many times this movie was rewatched
      }
    ],
    currentlyWatching: [
      { 
        movie: { type: mongoose.Schema.Types.ObjectId, ref: "Movie" },
        lastWatchedAt: { type: Date, default: Date.now },
        progress: { type: Number, default: 0 }, // percentage watched
        watchTime: { type: Number, default: 0 }, // time in seconds
        pausePoints: [{ type: Number }], // timestamps in seconds where user paused
      }
    ],
    watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Movie" }],
    // Analytics-specific fields
    lastLoginDate: { type: Date },
    totalWatchTime: { type: Number, default: 0 }, // total time in seconds
    loginHistory: [
      {
        date: { type: Date, default: Date.now },
        device: { type: String },
        location: { type: String }
      }
    ],
    genrePreferences: {
      type: Map,
      of: Number,
      default: {}
    }, // Map of genre to watch count
    subscriptionStatus: {
      plan: { type: String, default: "basic" },
      startDate: { type: Date },
      endDate: { type: Date },
      isActive: { type: Boolean, default: true }
    },
    // Push notifications
    deviceTokens: [
      {
        token: { type: String, index: true },
        platform: { type: String, enum: ["web"], default: "web" },
        userAgent: { type: String },
        subscribedTopics: [{ type: String }],
        createdAt: { type: Date, default: Date.now }
      }
    ],
    /**
     * Notification preferences.
     *
     * Deliberately schemaless (`Object`) rather than a nested path per switch.
     * The shape is owned by services/notifications/catalog.js — one category per
     * switch — and every read goes through `policy.resolvePreferences`, which
     * fills in defaults for categories a stored document predates. Pinning the
     * shape here as well would mean adding a category required a schema change
     * *and* a migration, and a Mongoose default of `false` on a new path would
     * silently opt every existing viewer out of it.
     *
     * The three legacy booleans (`marketing`, `product`, `reminders`) and the
     * old flat `quietHours` are still read by `resolvePreferences`, so an opt-out
     * recorded years ago survives.
     */
    notificationPrefs: { type: Object, default: {} },
    /**
     * Device fingerprints this account has signed in from before.
     *
     * Kept so a sign-in alert can distinguish "a device we have seen" from "a new
     * one", which is the only thing that makes the alert worth sending. A hash of
     * the device class rather than the raw user-agent, so a browser bumping its
     * version number is not reported as a new machine.
     */
    knownDevices: [
      {
        fingerprint: { type: String },
        label: { type: String },
        firstSeenAt: { type: Date, default: Date.now },
        lastSeenAt: { type: Date, default: Date.now }
      }
    ],
    // User preferences for UI/Playback/Accessibility
    preferences: {
      autoplayPreviews: { type: Boolean, default: true },
      reduceMotion: { type: Boolean, default: false },
      theme: { type: String, default: "system" }, // system | dark | light
      textSize: { type: String, default: "md" }, // sm | md | lg
      captionsStyle: {
        background: { type: String, default: "transparent" },
        color: { type: String, default: "#FFFFFF" },
        fontSize: { type: String, default: "medium" }
      },
      maturityRating: { type: String, default: "PG-13" },
      language: { type: String, default: "en" }
    }
  },
  { timestamps: true }
);

// Performance indexes.
//
// `email` and `username` are deliberately absent: both paths declare
// `unique: true`, which already creates `email_1` and `username_1`. Declaring
// them again asked for a *non-unique* index under the same auto-generated name,
// which MongoDB rejects as a name conflict — an error autoIndex swallows, so it
// failed silently on every startup and made `syncIndexes()` unusable.
UserSchema.index({ 'watchHistory.movie': 1 });
UserSchema.index({ 'currentlyWatching.movie': 1 });
UserSchema.index({ 'deviceTokens.token': 1 });
// Admin audience segments filter on recency; the heartbeat rollup keeps this
// field moving, so it is the closest thing the User document has to "active".
UserSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("User", UserSchema);
