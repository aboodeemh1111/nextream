const { isStorageKey } = require("../../storage/keys");
const sign = require("../../storage/sign");
const { CATEGORIES } = require("./catalog");

/**
 * The wire shape of a notification, and the one place artwork gets signed.
 *
 * Both matter more than they look.
 *
 * **Signing.** Every other read path signs storage keys through the mediaUrls
 * middleware, which works by wrapping `res.json`. Two of this feature's delivery
 * paths do not go through it — an SSE frame and an FCM payload are written
 * directly — so artwork stored as a bucket key would reach the client as a raw
 * key and render as a broken image. This is the shared helper both use.
 *
 * **A shape, not the document.** The stored row carries the machinery of the
 * decision: which rule suppressed the push, how many devices took it, the
 * dedupe key, the score. None of that belongs on the client, and `dedupeKey` in
 * particular is a value another viewer's row can be derived from. The inbox, the
 * SSE frame and the push payload all render from this function, so a field can
 * never be visible on one channel and missing on another.
 */

let signFailureLogged = false;

function signMedia(value) {
  if (!value || typeof value !== "string") return "";
  if (!isStorageKey(value)) return value;
  try {
    return sign.presignGet(value);
  } catch (err) {
    // Storage unconfigured is the local-development default; a missing image is
    // a far better outcome than a failed request.
    if (!signFailureLogged) {
      signFailureLogged = true;
      console.error("notifications: could not sign artwork:", err.message);
    }
    return "";
  }
}

/** What the viewer's own clients see. */
function present(doc) {
  if (!doc) return null;

  return {
    id: String(doc._id),
    type: doc.type,
    category: doc.category,
    categoryLabel: CATEGORIES[doc.category]?.label || doc.category,
    priority: doc.priority || "normal",

    title: doc.title || "",
    body: doc.body || "",
    image: signMedia(doc.image),
    icon: doc.icon || "",
    deepLink: doc.deepLink || "/",

    entity: {
      kind: doc.entity?.kind || "",
      id: doc.entity?.id || "",
      title: doc.entity?.title || "",
    },

    /** The one line explaining why this arrived. Empty when there isn't one. */
    reason: doc.reason || "",
    groupKey: doc.groupKey || null,

    read: Boolean(doc.read),
    readAt: doc.readAt || null,
    clickedAt: doc.clickedAt || null,
    archived: Boolean(doc.archived),

    createdAt: doc.createdAt || null,
    /** Whether a push was attempted, so the UI can say "sent to your devices". */
    pushed: doc.delivery?.push === "sent",
  };
}

/**
 * The admin view: the same row plus the delivery machinery.
 *
 * Separate from `present` on purpose — the fields below are exactly the ones a
 * viewer must not see, and keeping them in a different function means adding a
 * field to the admin console cannot leak it to the client by accident.
 */
function presentForAdmin(doc) {
  if (!doc) return null;

  return {
    ...present(doc),
    userId: String(doc.userId),
    score: doc.score ?? null,
    dedupeKey: doc.dedupeKey || null,
    campaignId: doc.campaignId || null,
    channels: doc.channels || [],
    delivery: {
      push: doc.delivery?.push || "none",
      deferUntil: doc.delivery?.deferUntil || null,
      sentAt: doc.delivery?.sentAt || null,
      suppressedBy: doc.delivery?.suppressedBy || "",
      error: doc.delivery?.error || "",
      attempts: doc.delivery?.attempts || 0,
      devices: doc.delivery?.devices || 0,
    },
  };
}

module.exports = { present, presentForAdmin, signMedia };
