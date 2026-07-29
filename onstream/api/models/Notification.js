const mongoose = require("mongoose");

/**
 * One notification, for one person.
 *
 * The old schema was a push receipt: a title, a body, a `read` flag and a
 * four-value `status`. That is enough to render a bell and nothing else — it
 * cannot say *why* someone received a thing, cannot stop the same episode being
 * announced twice, cannot hold a send back until quiet hours are over, and has
 * no notion of which category a notification belongs to, so a viewer who wants
 * new-episode alerts but not marketing had to choose between all and nothing.
 *
 * What is stored here instead is a decision with its evidence:
 *
 *   - `type` / `category` / `priority` come from the catalog and drive every
 *     policy rule (services/notifications/catalog.js).
 *   - `dedupeKey` is uniquely indexed, so "notify this user about this episode"
 *     is idempotent at the database level rather than by hoping the caller
 *     checked first. A duplicate insert fails as E11000 and is discarded.
 *   - `score` and `reason` record why this person was chosen, which is what
 *     makes a recommendation-driven notification debuggable and lets the UI say
 *     "Because you watch Horror" instead of an unexplained interruption.
 *   - `delivery` tracks the push attempt separately from the in-app record,
 *     because the in-app copy always lands and the push often should not.
 *
 * Everything expires. A notification is a statement about a moment, and an
 * inbox that accumulates forever is a table scan waiting to happen, so
 * `expiresAt` carries a TTL index and the catalog sets a horizon per type.
 */

/** Where a notification can be delivered. In-app is the durable record. */
const CHANNELS = ["inapp", "push"];

/**
 * Push lifecycle.
 *
 * `deferred` is the interesting one: the in-app copy is already visible, and
 * the push is waiting for the viewer's quiet hours to end. The scheduler drains
 * these. `suppressed` means policy decided this person should not be
 * interrupted at all — kept rather than deleted so the admin console can show
 * why a campaign reached fewer devices than it had recipients.
 */
const PUSH_STATES = [
  "none",
  "pending",
  "deferred",
  "sent",
  "failed",
  "suppressed",
];

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // --- classification -----------------------------------------------------
    /** A key in the catalog, e.g. "episode.published". */
    type: { type: String, required: true },
    /** The preference bucket the viewer can switch off, e.g. "new_content". */
    category: { type: String, required: true },
    priority: {
      type: String,
      enum: ["transactional", "high", "normal", "low"],
      default: "normal",
    },

    // --- content ------------------------------------------------------------
    title: { type: String, required: true },
    body: { type: String, default: "" },
    icon: { type: String, default: "" },
    image: { type: String, default: "" },
    /** In-app route. Relative, so it works on every deployment host. */
    deepLink: { type: String, default: "" },

    /**
     * What the notification is about, denormalised.
     *
     * Kept as a loose { kind, id, title } rather than a ref because the target
     * can be a Movie, a TVShow, an Episode or a Review, and a notification must
     * still render correctly after that document has been deleted — a dangling
     * populate would blank the row.
     */
    entity: {
      kind: { type: String, default: "" },
      id: { type: String, default: "" },
      title: { type: String, default: "" },
    },

    /** Extra values forwarded to the push payload. Stringified on the way out. */
    data: { type: Object, default: {} },

    // --- targeting evidence -------------------------------------------------
    /** One line the UI shows under the body: why this person, in their words. */
    reason: { type: String, default: "" },
    /**
     * How well this matched the recipient, 0..1. Recommendation-driven types
     * carry a floor in the catalog, so a weak match is never sent as a push.
     */
    score: { type: Number, default: 0 },

    /** Collapses a burst in the UI: five new episodes of one show is one card. */
    groupKey: { type: String, default: null },
    /**
     * Idempotency. Types that legitimately repeat — an admin broadcast, a digest
     * for a new week — leave it null, and the partial index below is what makes
     * that work. See the index comment: `sparse` is not enough.
     */
    dedupeKey: { type: String, default: null },

    // --- delivery -----------------------------------------------------------
    channels: { type: [String], default: ["inapp"] },
    delivery: {
      push: { type: String, enum: PUSH_STATES, default: "none" },
      /** Set when the send is held for quiet hours. The scheduler polls this. */
      deferUntil: { type: Date, default: null },
      sentAt: { type: Date, default: null },
      /** FCM message id, or the count when a multicast fanned out. */
      messageId: { type: String, default: "" },
      error: { type: String, default: "" },
      /** Which policy rule stopped the push. Reported in the admin console. */
      suppressedBy: { type: String, default: "" },
      attempts: { type: Number, default: 0 },
      /** How many devices actually accepted it. */
      devices: { type: Number, default: 0 },
    },

    // --- engagement ---------------------------------------------------------
    /** The row was rendered in front of the viewer. Distinct from opened. */
    seenAt: { type: Date, default: null },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    /** They acted on it. The only signal that says the send was worth making. */
    clickedAt: { type: Date, default: null },
    /** Dismissed from the inbox without being deleted, so stats survive. */
    archived: { type: Boolean, default: false },

    // --- bookkeeping --------------------------------------------------------
    /** Groups the rows one admin broadcast produced, for per-send reporting. */
    campaignId: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The inbox query: one user's unarchived rows, newest first.
NotificationSchema.index({ userId: 1, archived: 1, createdAt: -1 });
// The badge count, which runs on every poll and must never touch a document.
NotificationSchema.index({ userId: 1, read: 1, archived: 1 });
/**
 * Idempotency.
 *
 * Partial rather than sparse, and the difference is not academic: a sparse index
 * skips documents where the field is *absent*, but Mongoose applies the `null`
 * default above, so every repeatable notification carries an explicit null and is
 * indexed under it. With `sparse` the first admin broadcast claims the null slot
 * and every broadcast after it fails as a duplicate key — silently, because the
 * dispatcher treats a collision as "already sent". `$type: "string"` indexes only
 * the rows that actually opted into deduplication.
 */
NotificationSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } }
);
// The scheduler's queue of held-back pushes.
NotificationSchema.index({ "delivery.push": 1, "delivery.deferUntil": 1 });
// Admin reporting, by type and by send.
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ campaignId: 1, createdAt: -1 });
// Mongo reaps expired rows itself; nothing in the app has to remember to.
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Notification", NotificationSchema);
module.exports.CHANNELS = CHANNELS;
module.exports.PUSH_STATES = PUSH_STATES;
