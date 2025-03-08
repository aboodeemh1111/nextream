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
        completed: { type: Boolean, default: true }
      }
    ],
    currentlyWatching: [
      { 
        movie: { type: mongoose.Schema.Types.ObjectId, ref: "Movie" },
        lastWatchedAt: { type: Date, default: Date.now },
        progress: { type: Number, default: 0 }, // percentage watched
      }
    ],
    watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Movie" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
