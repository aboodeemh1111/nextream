const mongoose = require("mongoose");

/**
 * Per-viewer, per-category engagement counters.
 *
 * Everything here is derivable from the Notification collection, and that is
 * exactly the problem: the policy engine needs "how many pushes has this person
 * had today" and "have they ignored the last four of these" *before* deciding
 * whether to send, on every single send. Running two aggregations per recipient
 * over a growing collection makes a hundred-recipient fan-out a hundred
 * aggregations. One indexed document per (user, category) makes it one query
 * per user for every category at once.
 *
 * The row where `category` is `"*"` is the whole-account rollup. Frequency caps
 * are an account-level promise — "at most six pushes a day" means six in total,
 * not six per category — while engagement suppression is per-category, because
 * ignoring every social notification says nothing about new-episode alerts.
 * Both live in one collection so policy can load them in a single read.
 */
const NotificationStatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    /** A catalog category, or "*" for the account-wide rollup. */
    category: { type: String, required: true },

    // --- lifetime counters --------------------------------------------------
    created: { type: Number, default: 0 },
    pushed: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },

    // --- rolling window for frequency caps ----------------------------------
    /**
     * The calendar day `pushesToday` counts, as YYYY-MM-DD in the *viewer's*
     * timezone. Stored as a string rather than a Date because the reset is a
     * local-midnight boundary, and comparing a stored key to a freshly computed
     * one is the only version of that check with no timezone arithmetic in it.
     */
    pushDay: { type: String, default: "" },
    pushesToday: { type: Number, default: 0 },
    lastPushAt: { type: Date, default: null },
    lastCreatedAt: { type: Date, default: null },

    /**
     * Consecutive notifications in this category that were pushed and never
     * opened. Reset to zero the moment one is opened.
     *
     * This is the whole "smart" part of the volume control: a viewer who has
     * ignored four straight recommendation pushes stops receiving them as
     * pushes and keeps receiving them in the inbox, which is where they were
     * already choosing to find them.
     */
    ignoredStreak: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One row per user per category; every write is an upsert against this.
NotificationStatSchema.index({ userId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model("NotificationStat", NotificationStatSchema);
