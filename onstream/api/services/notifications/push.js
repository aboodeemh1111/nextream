const admin = require("../../firebase");
const User = require("../../models/User");
const { signMedia } = require("./view");

/**
 * Web push transport, and the device registry behind it.
 *
 * Two decisions worth stating up front, because both are the opposite of what
 * the Firebase quickstart shows:
 *
 * 1. **Data-only messages.** A payload with a top-level `notification` key is
 *    rendered by the browser *and* delivered to `onBackgroundMessage`, so the
 *    obvious implementation shows every notification twice — once by Chrome and
 *    once by the service worker. Sending data only makes the worker the single
 *    renderer, which is also the only way to get action buttons, `tag`-based
 *    collapsing of a season drop into one card, and a click handler that can
 *    report the click back before it opens the deep link.
 *
 * 2. **Tokens are pruned on the send that discovered them.** FCM reports
 *    unregistered tokens per-recipient in a multicast response, and that is the
 *    only moment the system ever learns a device is gone. Left unpruned they
 *    accumulate forever: every future send carries them, every send reports
 *    failures, and the delivery rate in the admin console drifts down until it
 *    describes the size of the graveyard rather than the health of the send.
 *
 * Everything here degrades rather than throws. An API running without Firebase
 * credentials — which is the default in local development — must still record
 * notifications in the inbox; a missing service account is a reason for the bell
 * to work and the phone to stay quiet, not for the request to 500.
 */

/** FCM's hard limit on one sendEachForMulticast call. */
const MULTICAST_CHUNK = 500;

/**
 * How long FCM should keep trying to wake a sleeping browser. Four hours is
 * long enough to cover a closed laptop over lunch, short enough that a "new
 * episode" push cannot arrive the next day as news.
 */
const PUSH_TTL_SECONDS = 4 * 60 * 60;

/** Error codes that mean the token is dead, not that the send failed. */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

function isConfigured() {
  return Array.isArray(admin?.apps) && admin.apps.length > 0;
}

/**
 * Configuration report for the health endpoint.
 *
 * Which of the three env vars is missing is the single most useful thing to
 * know when push is silently not working, and it is not something the values
 * themselves can be read out to answer.
 */
function status() {
  return {
    configured: isConfigured(),
    env: {
      projectId: Boolean(process.env.FIREBASE_PROJECT_ID),
      clientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
      privateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    },
  };
}

// --- payload -----------------------------------------------------------------

/**
 * FCM data values must be strings — a number or a boolean is rejected for the
 * whole message, which turns one careless field into a total send failure.
 */
function stringifyData(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}

/**
 * The wire payload for one notification.
 *
 * `groupKey` travels in the data block because the service worker uses it as the
 * notification `tag`: that is what makes five new episodes of one show replace
 * each other on the lock screen instead of stacking five cards.
 */
function buildMessage(notification) {
  const data = stringifyData({
    ...(notification.data || {}),
    id: String(notification._id || ""),
    type: notification.type || "",
    category: notification.category || "",
    priority: notification.priority || "normal",
    title: notification.title || "",
    body: notification.body || "",
    image: signMedia(notification.image),
    icon: notification.icon || "",
    deepLink: notification.deepLink || "/",
    groupKey: notification.groupKey || "",
    entityKind: notification.entity?.kind || "",
    entityId: notification.entity?.id || "",
  });

  return {
    data,
    webpush: {
      headers: {
        // `high` asks the push service to wake the worker now rather than
        // batching; anything the viewer did not explicitly ask for uses the
        // battery-friendly path.
        Urgency: notification.priority === "low" ? "normal" : "high",
        TTL: String(PUSH_TTL_SECONDS),
      },
      // No `notification` block: the service worker renders it. See the note at
      // the top of this file.
      fcmOptions: { link: notification.deepLink || "/" },
    },
  };
}

// --- device registry ---------------------------------------------------------

/**
 * Records a device against a viewer.
 *
 * Upsert semantics by hand, because the same browser profile can produce the
 * same token for two accounts (a shared machine), and a token that has moved
 * accounts must stop receiving the previous viewer's notifications — otherwise
 * signing out and back in as someone else leaks their notifications to the
 * first account's device row.
 */
async function registerDevice(userId, { token, platform = "web", userAgent = "" }) {
  if (!token || typeof token !== "string" || token.length > 4096) {
    return { ok: false, error: "INVALID_TOKEN" };
  }

  await User.updateMany(
    { _id: { $ne: userId }, "deviceTokens.token": token },
    { $pull: { deviceTokens: { token } } }
  );

  // Two unconditional writes rather than update-or-insert: `timestamps: true`
  // makes modifiedCount 1 on every update whether or not an array element
  // matched, so "insert if nothing was modified" cannot work here. The $ne
  // guard makes the push a no-op when the row is already present.
  await User.updateOne(
    { _id: userId, "deviceTokens.token": { $ne: token } },
    { $push: { deviceTokens: { token, platform, userAgent, createdAt: new Date() } } }
  );
  await User.updateOne(
    { _id: userId, "deviceTokens.token": token },
    { $set: { "deviceTokens.$.userAgent": userAgent, "deviceTokens.$.platform": platform } }
  );

  return { ok: true };
}

async function unregisterDevice(userId, token) {
  if (!token) return { ok: false, error: "INVALID_TOKEN" };
  await User.updateOne({ _id: userId }, { $pull: { deviceTokens: { token } } });
  return { ok: true };
}

/** Map of userId -> [token], for the users that have any. */
async function tokensByUser(userIds) {
  const out = new Map();
  const ids = [...new Set((userIds || []).map(String))].filter(Boolean);
  if (!ids.length) return out;

  const users = await User.find({ _id: { $in: ids } })
    .select("deviceTokens.token")
    .lean();

  for (const user of users) {
    const tokens = (user.deviceTokens || []).map((device) => device.token).filter(Boolean);
    if (tokens.length) out.set(String(user._id), tokens);
  }
  return out;
}

/**
 * Drops tokens FCM has told us are gone.
 *
 * Unscoped by user on purpose: the same token can be recorded against more than
 * one account if a device was shared, and a token FCM rejects is dead for all
 * of them.
 */
async function pruneTokens(tokens) {
  const dead = [...new Set((tokens || []).filter(Boolean))];
  if (!dead.length) return 0;
  await User.updateMany(
    { "deviceTokens.token": { $in: dead } },
    { $pull: { deviceTokens: { token: { $in: dead } } } }
  );
  return dead.length;
}

// --- sending -----------------------------------------------------------------

function chunk(items, size) {
  const out = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

/**
 * Sends one notification to one viewer's devices.
 *
 * Returns what the caller needs to record and nothing it has to interpret:
 * whether anything landed, how many devices accepted it, which tokens are dead,
 * and a message worth storing when the whole attempt failed.
 */
async function sendToTokens(tokens, notification) {
  const list = [...new Set((tokens || []).filter(Boolean))];
  if (!list.length) return { sent: 0, failed: 0, deadTokens: [], error: "", messageId: "" };
  if (!isConfigured()) {
    return { sent: 0, failed: list.length, deadTokens: [], error: "FCM_NOT_CONFIGURED", messageId: "" };
  }

  const message = buildMessage(notification);
  let sent = 0;
  let failed = 0;
  const deadTokens = [];
  const errors = [];
  let messageId = "";

  for (const batch of chunk(list, MULTICAST_CHUNK)) {
    let response;
    try {
      response = await admin.messaging().sendEachForMulticast({ ...message, tokens: batch });
    } catch (err) {
      // A transport-level failure says nothing about the individual tokens, so
      // none are pruned on this path — pruning on a network blip would delete a
      // viewer's device registration for an outage they did not cause.
      failed += batch.length;
      errors.push(err.message || String(err));
      continue;
    }

    sent += response.successCount || 0;
    failed += response.failureCount || 0;

    (response.responses || []).forEach((result, index) => {
      if (result.success) {
        if (!messageId && result.messageId) messageId = result.messageId;
        return;
      }
      const code = result.error?.errorInfo?.code || result.error?.code || "";
      if (DEAD_TOKEN_CODES.has(code)) deadTokens.push(batch[index]);
      else if (result.error?.message) errors.push(result.error.message);
    });
  }

  return {
    sent,
    failed,
    deadTokens,
    error: sent > 0 ? "" : errors[0] || "",
    messageId,
  };
}

/** Topic sends, kept for admin broadcasts that predate per-user targeting. */
async function sendToTopic(topic, notification) {
  if (!isConfigured()) return { ok: false, error: "FCM_NOT_CONFIGURED", messageId: "" };
  try {
    const messageId = await admin.messaging().send({ ...buildMessage(notification), topic });
    return { ok: true, error: "", messageId };
  } catch (err) {
    return { ok: false, error: err.message || String(err), messageId: "" };
  }
}

async function subscribeToTopic(tokens, topic) {
  if (!isConfigured()) return { ok: false, error: "FCM_NOT_CONFIGURED" };
  try {
    await admin.messaging().subscribeToTopic([...new Set(tokens.filter(Boolean))], topic);
    return { ok: true, error: "" };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function unsubscribeFromTopic(tokens, topic) {
  if (!isConfigured()) return { ok: false, error: "FCM_NOT_CONFIGURED" };
  try {
    await admin.messaging().unsubscribeFromTopic([...new Set(tokens.filter(Boolean))], topic);
    return { ok: true, error: "" };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

module.exports = {
  MULTICAST_CHUNK,
  PUSH_TTL_SECONDS,
  buildMessage,
  isConfigured,
  pruneTokens,
  registerDevice,
  sendToTokens,
  sendToTopic,

  status,
  stringifyData,
  subscribeToTopic,
  tokensByUser,
  unregisterDevice,
  unsubscribeFromTopic,
};
