const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    isAdmin: { type: Boolean, default: false },
    myList: [{ type: mongoose.Schema.Types.ObjectId, ref: "Movie" }],
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
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
