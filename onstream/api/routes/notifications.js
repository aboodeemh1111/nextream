const router = require("express").Router();
const mongoose = require("mongoose");
const verify = require("../verifyToken");
const Notification = require("../models/Notification");
const User = require("../models/User");
const audience = require("../services/notifications/audience");
const { CATEGORIES, TYPES, typesByCategory } = require("../services/notifications/catalog");
const dispatch = require("../services/notifications/dispatch");
const events = require("../services/notifications/events");
const policy = require("../services/notifications/policy");
const push = require("../services/notifications/push");
const scheduler = require("../services/notifications/scheduler");
const stats = require("../services/notifications/stats");
const stream = require("../services/notifications/stream");
const { present, presentForAdmin } = require("../services/notifications/view");

/**
 * The notification API.
 *
 * Three groups of endpoints, and the boundary between them is enforced rather
 * than assumed:
 *
 *   - **Inbox** (`/`, `/stream`, `/:id/read`, …) — a viewer's own notifications.
 *     Every query is scoped by `userId` from the verified token, never from a
 *     parameter, so there is no shape of request that reads someone else's mail.
 *   - **Preferences** (`/preferences`) — validated through the policy engine on
 *     the way in, so a malformed clock or an unknown timezone is rejected at the
 *     edge instead of throwing during a send hours later.
 *   - **Admin** (`/admin/*`) — broadcasts and reporting, behind an isAdmin
 *     check, and rendered through `presentForAdmin` so the delivery machinery is
 *     visible there and only there.
 *
 * The route that shaped the rest is `/stream`. It carries the auth header like
 * every other route, which means the client cannot use `EventSource` (it cannot
 * set headers) and reads the stream with `fetch` instead. That is a deliberate
 * trade: the alternative is a token in a query string, where it would be logged
 * by every proxy in the path, and no amount of convenience is worth putting a
 * bearer token in a URL.
 */

const PAGE_SIZE = { default: 20, max: 50 };

function fail(res, code, err) {
  console.error(`${code}:`, err);
  return res.status(500).json({ error: code, message: err.message });
}

function badRequest(res, message) {
  return res.status(400).json({ error: "BAD_REQUEST", message });
}

function objectId(value) {
  return mongoose.isValidObjectId(String(value))
    ? new mongoose.Types.ObjectId(String(value))
    : null;
}

/**
 * Cursor pagination over (createdAt, _id).
 *
 * `createdAt` alone is not a cursor: a fan-out writes every row in one bulk
 * operation with an identical timestamp, so paging on it drops or repeats the
 * whole batch at the page boundary — which is exactly the case where a viewer has
 * the most notifications to page through. The id breaks the tie.
 */
function encodeCursor(doc) {
  if (!doc) return null;
  return `${new Date(doc.createdAt).toISOString()}|${doc._id}`;
}

function decodeCursor(value) {
  if (typeof value !== "string" || !value.includes("|")) return null;
  const [at, id] = value.split("|");
  const date = new Date(at);
  const oid = objectId(id);
  if (!Number.isFinite(date.getTime()) || !oid) return null;
  return { at: date, id: oid };
}

// --- admin -------------------------------------------------------------------
// Registered first so no `/:id` pattern below can shadow them.

const adminOnly = [
  verify,
  (req, res, next) => {
    if (!req.user?.isAdmin) return res.status(403).json({ message: "You are not allowed!" });
    next();
  },
];

/** The catalog itself, so the composer's dropdowns come from the source. */
router.get("/admin/catalog", adminOnly, (req, res) => {
  res.json({
    categories: Object.values(CATEGORIES),
    types: Object.values(TYPES).map((definition) => ({
      type: definition.type,
      category: definition.category,
      priority: definition.priority,
      channels: definition.channels,
      ttlDays: definition.ttlDays ?? null,
      minScore: definition.minScore ?? null,
    })),
    byCategory: typesByCategory(),
  });
});

/**
 * How many people a segment reaches, before anything is sent.
 *
 * The single most useful thing an admin composer can show. Without it, "send to
 * everyone who watches horror" is a guess that is only resolved by pressing the
 * button, and the button is not reversible.
 */
router.post("/admin/preview", adminOnly, async (req, res) => {
  try {
    const { mode = "segment", userIds = [], segment = {} } = req.body || {};

    if (mode === "users") {
      const valid = (Array.isArray(userIds) ? userIds : []).filter((id) =>
        mongoose.isValidObjectId(String(id))
      );
      const found = await User.countDocuments({ _id: { $in: valid } });
      return res.json({
        total: found,
        truncated: false,
        description: `${found} named ${found === 1 ? "viewer" : "viewers"}`,
        invalid: valid.length - found + ((Array.isArray(userIds) ? userIds.length : 0) - valid.length),
        withPush: await User.countDocuments({
          _id: { $in: valid },
          "deviceTokens.0": { $exists: true },
        }),
      });
    }

    const resolved = await audience.resolveSegment(segment, { limit: dispatch.MAX_RECIPIENTS });
    const withPush = resolved.recipients.length
      ? await User.countDocuments({
          _id: { $in: resolved.recipients.map((row) => row.userId) },
          "deviceTokens.0": { $exists: true },
        })
      : 0;

    res.json({
      total: resolved.total,
      reachable: resolved.recipients.length,
      truncated: resolved.truncated,
      description: resolved.description,
      withPush,
    });
  } catch (err) {
    return fail(res, "NOTIFICATION_PREVIEW_FAILED", err);
  }
});

/**
 * Sends an announcement.
 *
 * Awaited rather than fire-and-forget, because the admin is looking at a spinner
 * and the numbers that come back — created, pushed, and why the rest were not —
 * are the only feedback that the send did what they meant.
 */
router.post("/admin/broadcast", adminOnly, async (req, res) => {
  try {
    const { title, body, deepLink, image, mode = "segment", userIds = [], segment = {} } = req.body || {};
    if (!title || !String(title).trim()) return badRequest(res, "A title is required");

    let recipients;
    if (mode === "users") {
      const valid = (Array.isArray(userIds) ? userIds : [])
        .map(String)
        .filter((id) => mongoose.isValidObjectId(id));
      if (!valid.length) return badRequest(res, "No valid user ids were given");
      recipients = valid.map((userId) => ({ userId, score: 1, reason: "" }));
    } else {
      const resolved = await audience.resolveSegment(segment, { limit: dispatch.MAX_RECIPIENTS });
      recipients = resolved.recipients;
    }

    if (!recipients.length) {
      return res.json({ ok: true, campaignId: null, summary: { requested: 0, created: 0, pushed: 0 } });
    }

    // A stable id per send, so the reporting endpoint can show this campaign's
    // open and click rates rather than the type's lifetime average.
    const campaignId = new mongoose.Types.ObjectId().toString();
    const summary = await events.announce({
      title,
      body,
      deepLink,
      image,
      recipients,
      campaignId,
      createdBy: req.user.id,
    });

    res.json({ ok: true, campaignId, summary });
  } catch (err) {
    return fail(res, "NOTIFICATION_BROADCAST_FAILED", err);
  }
});

/** A send to the admin's own account, to see the real thing before a broadcast. */
router.post("/admin/test", adminOnly, async (req, res) => {
  try {
    const { title = "Test notification", body = "", deepLink = "/", image = "" } = req.body || {};
    const summary = await events.announce({
      title,
      body,
      deepLink,
      image,
      recipients: [{ userId: String(req.user.id), score: 1, reason: "" }],
      campaignId: null,
      createdBy: req.user.id,
    });
    res.json({ ok: true, summary });
  } catch (err) {
    return fail(res, "NOTIFICATION_TEST_FAILED", err);
  }
});

/**
 * Delivery and engagement, by type and by day.
 *
 * `created` is the denominator throughout — the notifications that were made,
 * not the pushes that were attempted — because a type whose pushes are being
 * suppressed by policy is a type doing its job, and dividing by sends would
 * report that as a failure.
 */
router.get("/admin/stats", adminOnly, async (req, res) => {
  try {
    const days = Math.min(180, Math.max(1, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const match = { createdAt: { $gte: since } };

    const counters = {
      created: { $sum: 1 },
      pushed: { $sum: { $cond: [{ $eq: ["$delivery.push", "sent"] }, 1, 0] } },
      deferred: { $sum: { $cond: [{ $eq: ["$delivery.push", "deferred"] }, 1, 0] } },
      suppressed: { $sum: { $cond: [{ $eq: ["$delivery.push", "suppressed"] }, 1, 0] } },
      failed: { $sum: { $cond: [{ $eq: ["$delivery.push", "failed"] }, 1, 0] } },
      read: { $sum: { $cond: ["$read", 1, 0] } },
      clicked: { $sum: { $cond: [{ $ne: ["$clickedAt", null] }, 1, 0] } },
    };

    const [byType, byCategory, byDay, suppression, totals, recipients] = await Promise.all([
      Notification.aggregate([
        { $match: match },
        { $group: { _id: "$type", ...counters } },
        { $sort: { created: -1 } },
      ]),
      Notification.aggregate([
        { $match: match },
        { $group: { _id: "$category", ...counters } },
        { $sort: { created: -1 } },
      ]),
      Notification.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            ...counters,
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Notification.aggregate([
        { $match: { ...match, "delivery.suppressedBy": { $nin: ["", null] } } },
        { $group: { _id: "$delivery.suppressedBy", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Notification.aggregate([{ $match: match }, { $group: { _id: null, ...counters } }]),
      // How many distinct people were reached at all, which is the number an
      // admin actually pictures when they think about a week's notifications.
      Notification.aggregate([
        { $match: match },
        { $group: { _id: "$userId" } },
        { $count: "users" },
      ]),
    ]);

    const rate = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
    const shape = (row) => ({
      key: row._id,
      label: CATEGORIES[row._id]?.label || row._id,
      created: row.created,
      pushed: row.pushed,
      deferred: row.deferred,
      suppressed: row.suppressed,
      failed: row.failed,
      read: row.read,
      clicked: row.clicked,
      readRate: rate(row.read, row.created),
      clickRate: rate(row.clicked, row.created),
      pushRate: rate(row.pushed, row.created),
    });

    const overall = totals[0] || {
      created: 0,
      pushed: 0,
      deferred: 0,
      suppressed: 0,
      failed: 0,
      read: 0,
      clicked: 0,
    };

    res.json({
      window: { days, since },
      totals: {
        ...shape({ ...overall, _id: "all" }),
        recipients: recipients[0]?.users || 0,
      },
      byType: byType.map(shape),
      byCategory: byCategory.map(shape),
      series: byDay.map((row) => ({
        date: row._id,
        created: row.created,
        pushed: row.pushed,
        read: row.read,
        clicked: row.clicked,
      })),
      suppression: suppression.map((row) => ({ reason: row._id, count: row.count })),
      push: push.status(),
      streams: stream.stats(),
      scheduler: { intervals: scheduler.INTERVALS },
    });
  } catch (err) {
    return fail(res, "NOTIFICATION_STATS_FAILED", err);
  }
});

/** The newest rows across all viewers, for eyeballing what the system is saying. */
router.get("/admin/recent", adminOnly, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const query = {};
    if (req.query.type) query.type = String(req.query.type);
    if (req.query.campaignId) query.campaignId = String(req.query.campaignId);

    const rows = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: "userId", select: "username email" })
      .lean();

    res.json(
      rows.map((row) => ({
        ...presentForAdmin({ ...row, userId: row.userId?._id || row.userId }),
        user: row.userId?.username
          ? { id: String(row.userId._id), username: row.userId.username, email: row.userId.email }
          : null,
      }))
    );
  } catch (err) {
    return fail(res, "NOTIFICATION_RECENT_FAILED", err);
  }
});

/**
 * Runs the background jobs now.
 *
 * The reminder and digest sweeps are otherwise only observable by waiting an
 * hour, which makes them the two parts of this system that would never get
 * tested. This is how you watch them work.
 */
router.post("/admin/run-jobs", adminOnly, async (req, res) => {
  try {
    // Any buffered episode announcements go out first, so a "publish then run
    // jobs" sequence behaves the way the admin expects.
    await events.flushNow();
    res.json(await scheduler.runAll(new Date()));
  } catch (err) {
    return fail(res, "NOTIFICATION_JOBS_FAILED", err);
  }
});

// --- health ------------------------------------------------------------------

/**
 * Unauthenticated on purpose, and it says nothing secret: whether the push
 * transport is configured, and which of the three credentials is missing if not.
 * That is the first question asked whenever push is silently not working.
 */
router.get("/health", (req, res) => {
  res.json({
    ok: true,
    enabled: events.enabled(),
    push: push.status(),
    streams: stream.stats(),
    types: Object.keys(TYPES).length,
    categories: Object.keys(CATEGORIES).length,
  });
});

// --- realtime ----------------------------------------------------------------

/**
 * The live inbox.
 *
 * Held open for as long as the tab is. The initial frame carries the unread
 * count so a reconnecting client is correct immediately, rather than showing a
 * stale badge until the next notification happens to arrive.
 */
router.get("/stream", verify, async (req, res) => {
  try {
    const unread = await Notification.countDocuments({
      userId: req.user.id,
      read: false,
      archived: false,
    });
    stream.subscribe(req.user.id, req, res, { unread });
  } catch (err) {
    // Headers may already be sent by subscribe; only answer if they are not.
    if (!res.headersSent) fail(res, "NOTIFICATION_STREAM_FAILED", err);
  }
});

// --- inbox -------------------------------------------------------------------

router.get("/", verify, async (req, res) => {
  try {
    const limit = Math.min(PAGE_SIZE.max, Math.max(1, Number(req.query.limit) || PAGE_SIZE.default));
    const query = { userId: req.user.id, archived: req.query.archived === "true" };

    if (req.query.category && CATEGORIES[req.query.category]) query.category = req.query.category;
    if (req.query.unread === "true") query.read = false;

    const cursor = decodeCursor(req.query.cursor);
    if (cursor) {
      query.$or = [
        { createdAt: { $lt: cursor.at } },
        { createdAt: cursor.at, _id: { $lt: cursor.id } },
      ];
    }

    const [rows, unread, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1, _id: -1 })
        // One extra row, so "is there another page" is answered without a count.
        .limit(limit + 1)
        .lean(),
      Notification.countDocuments({ userId: req.user.id, read: false, archived: false }),
      Notification.countDocuments({ userId: req.user.id, archived: false }),
    ]);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    // "Seen" is not "read": it records that the rows were rendered, which is what
    // separates a notification the viewer scrolled past from one they never had a
    // chance to see. Fire-and-forget — a failed receipt must not fail the read.
    if (items.length) {
      Notification.updateMany(
        { _id: { $in: items.map((row) => row._id) }, seenAt: null },
        { $set: { seenAt: new Date() } }
      ).catch(() => {});
    }

    res.json({
      items: items.map(present),
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
      unread,
      total,
    });
  } catch (err) {
    return fail(res, "NOTIFICATION_FETCH_FAILED", err);
  }
});

/** Just the badge. Cheap enough to be a fallback poll when the stream is down. */
router.get("/unread-count", verify, async (req, res) => {
  try {
    const unread = await Notification.countDocuments({
      userId: req.user.id,
      read: false,
      archived: false,
    });
    res.json({ unread });
  } catch (err) {
    return fail(res, "NOTIFICATION_COUNT_FAILED", err);
  }
});

/**
 * Marks one as read.
 *
 * Guarded on `read: false` so re-reading something does not count as a second
 * open — the engagement counters drive the throttle, and inflating them would
 * make an ignored category look engaged.
 */
router.patch("/:id/read", verify, async (req, res) => {
  try {
    const id = objectId(req.params.id);
    if (!id) return badRequest(res, "Not a valid notification id");

    const now = new Date();
    const row = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user.id, read: false },
      { $set: { read: true, readAt: now, seenAt: now } },
      { new: true }
    ).lean();

    if (row) await stats.recordOpened(req.user.id, row.category);

    const unread = await Notification.countDocuments({
      userId: req.user.id,
      read: false,
      archived: false,
    });
    // The other tabs are showing the same badge.
    stream.publish(req.user.id, "read", { id: String(id), unread });

    res.json({ ok: true, unread });
  } catch (err) {
    return fail(res, "NOTIFICATION_READ_FAILED", err);
  }
});

/**
 * A click, which is the strongest engagement signal there is.
 *
 * Also marks the row read, because a viewer who acted on a notification has
 * plainly read it and asking them to do both is bookkeeping leaking into the UI.
 * Unauthenticated variants are not accepted: the service worker sends this from
 * a context that has the viewer's token.
 */
router.post("/:id/click", verify, async (req, res) => {
  try {
    const id = objectId(req.params.id);
    if (!id) return badRequest(res, "Not a valid notification id");

    const now = new Date();
    const before = await Notification.findOne({ _id: id, userId: req.user.id })
      .select("category read readAt clickedAt")
      .lean();
    if (!before) return res.status(404).json({ message: "Not found" });

    // Built conditionally rather than with `undefined` placeholders: Mongoose 5
    // does not strip undefined from `$set`, so an absent value would be written
    // as null and erase the timestamp it was meant to preserve.
    const update = { read: true, seenAt: now, clickedAt: before.clickedAt || now };
    if (!before.readAt) update.readAt = now;

    await Notification.updateOne({ _id: id, userId: req.user.id }, { $set: update });

    // Counted once per notification, however many times it is opened.
    if (!before.clickedAt) await stats.recordClicked(req.user.id, before.category);

    res.json({ ok: true });
  } catch (err) {
    return fail(res, "NOTIFICATION_CLICK_FAILED", err);
  }
});

router.post("/read-all", verify, async (req, res) => {
  try {
    const now = new Date();
    const pending = await Notification.find({ userId: req.user.id, read: false, archived: false })
      .select("category")
      .lean();

    if (pending.length) {
      await Notification.updateMany(
        { userId: req.user.id, read: false, archived: false },
        { $set: { read: true, readAt: now, seenAt: now } }
      );
      // One open per category, not per row: "mark all read" is a dismissal, and
      // counting it as engagement with everything would clear every throttle at
      // once — which is the opposite of what the gesture means.
      for (const category of new Set(pending.map((row) => row.category))) {
        await stats.recordOpened(req.user.id, category);
      }
    }

    stream.publish(req.user.id, "read", { id: null, unread: 0 });
    res.json({ ok: true, marked: pending.length, unread: 0 });
  } catch (err) {
    return fail(res, "NOTIFICATION_READ_ALL_FAILED", err);
  }
});

/**
 * Dismisses one from the inbox.
 *
 * Archived rather than deleted: the engagement history behind the throttle and
 * the admin console's rates are both derived from these rows, and deleting them
 * would make a viewer who tidies their inbox look like one who never engages.
 */
router.delete("/:id", verify, async (req, res) => {
  try {
    const id = objectId(req.params.id);
    if (!id) return badRequest(res, "Not a valid notification id");

    await Notification.updateOne(
      { _id: id, userId: req.user.id },
      { $set: { archived: true, read: true } }
    );

    const unread = await Notification.countDocuments({
      userId: req.user.id,
      read: false,
      archived: false,
    });
    stream.publish(req.user.id, "archived", { id: String(id), unread });

    res.json({ ok: true, unread });
  } catch (err) {
    return fail(res, "NOTIFICATION_ARCHIVE_FAILED", err);
  }
});

router.post("/archive-read", verify, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, read: true, archived: false },
      { $set: { archived: true } }
    );
    res.json({ ok: true, archived: result.nModified ?? result.modifiedCount ?? 0 });
  } catch (err) {
    return fail(res, "NOTIFICATION_ARCHIVE_READ_FAILED", err);
  }
});

// --- preferences -------------------------------------------------------------

/**
 * The settings page's whole payload.
 *
 * The category metadata travels with the values so the UI renders labels and
 * descriptions from the catalog rather than keeping its own copy — a copy that
 * would silently disagree the first time a category was added.
 *
 * `stats` is included for the same reason: a viewer whose recommendation pushes
 * have been throttled for ignoring them deserves to be able to see that, rather
 * than concluding the feature is broken.
 */
async function readPreferences(req, res) {
  try {
    const [user, counters] = await Promise.all([
      User.findById(req.user.id).select("notificationPrefs deviceTokens").lean(),
      stats.forUser(req.user.id),
    ]);

    res.json({
      preferences: policy.resolvePreferences(user?.notificationPrefs),
      categories: Object.values(CATEGORIES),
      devices: (user?.deviceTokens || []).map((device) => ({
        // Never the token itself: it is a send credential for that browser.
        id: String(device.token || "").slice(-8),
        platform: device.platform || "web",
        userAgent: device.userAgent || "",
        createdAt: device.createdAt || null,
      })),
      stats: counters,
      pushAvailable: push.isConfigured(),
    });
  } catch (err) {
    return fail(res, "NOTIFICATION_PREFS_FETCH_FAILED", err);
  }
}

/**
 * Saves preferences.
 *
 * The stored document is the *resolved* one, not the patch. Storing partials is
 * what left the old schema unable to tell "never set" from "explicitly off", and
 * writing the whole resolved object means a read never has to guess again.
 */
async function savePreferences(req, res) {
  try {
    const user = await User.findById(req.user.id).select("notificationPrefs").lean();
    const next = policy.mergePreferences(user?.notificationPrefs, req.body);

    await User.updateOne({ _id: req.user.id }, { $set: { notificationPrefs: next } });
    res.json({ preferences: next, categories: Object.values(CATEGORIES) });
  } catch (err) {
    return fail(res, "NOTIFICATION_PREFS_UPDATE_FAILED", err);
  }
}

router.get("/preferences", verify, readPreferences);
router.put("/preferences", verify, savePreferences);
// POST alongside PUT, and `/prefs` alongside `/preferences`: both are what the
// previous client called, and a 404 on either would silently stop preferences
// saving for any bundle that has not been redeployed yet.
router.post("/preferences", verify, savePreferences);
router.get("/prefs", verify, readPreferences);
router.post("/prefs", verify, savePreferences);

// --- devices -----------------------------------------------------------------

async function handleRegister(req, res) {
  try {
    const { token, platform = "web", userAgent } = req.body || {};
    const result = await push.registerDevice(req.user.id, {
      token,
      platform,
      userAgent: userAgent || req.headers["user-agent"] || "",
    });
    if (!result.ok) return badRequest(res, "A valid device token is required");
    res.json({ ok: true, pushAvailable: push.isConfigured() });
  } catch (err) {
    return fail(res, "NOTIFICATION_DEVICE_REGISTER_FAILED", err);
  }
}

router.post("/devices", verify, handleRegister);
// The previous client posts here; both paths are kept so a stale bundle keeps
// registering rather than losing push silently.
router.post("/devices/register", verify, handleRegister);

router.delete("/devices/:token", verify, async (req, res) => {
  try {
    await push.unregisterDevice(req.user.id, req.params.token);
    res.json({ ok: true });
  } catch (err) {
    return fail(res, "NOTIFICATION_DEVICE_UNREGISTER_FAILED", err);
  }
});

/**
 * Topic subscriptions.
 *
 * Retained for compatibility with the clients that call them, but no notification
 * this system generates is sent by topic: a topic cannot be filtered by anyone's
 * preferences, cannot respect quiet hours, and produces no per-viewer record to
 * show in an inbox. Per-user targeting is the whole point of the pipeline.
 */
router.post("/topics/subscribe", verify, async (req, res) => {
  try {
    const { token, topic } = req.body || {};
    if (!token || !topic) return badRequest(res, "token and topic are both required");
    const result = await push.subscribeToTopic([token], topic);
    if (!result.ok) return res.status(503).json({ error: "FCM_UNAVAILABLE", message: result.error });

    await User.updateOne(
      { _id: req.user.id, "deviceTokens.token": token },
      { $addToSet: { "deviceTokens.$.subscribedTopics": topic } }
    );
    res.json({ ok: true });
  } catch (err) {
    return fail(res, "NOTIFICATION_TOPIC_SUBSCRIBE_FAILED", err);
  }
});

router.post("/topics/unsubscribe", verify, async (req, res) => {
  try {
    const { token, topic } = req.body || {};
    if (!token || !topic) return badRequest(res, "token and topic are both required");
    const result = await push.unsubscribeFromTopic([token], topic);
    if (!result.ok) return res.status(503).json({ error: "FCM_UNAVAILABLE", message: result.error });

    await User.updateOne(
      { _id: req.user.id, "deviceTokens.token": token },
      { $pull: { "deviceTokens.$.subscribedTopics": topic } }
    );
    res.json({ ok: true });
  } catch (err) {
    return fail(res, "NOTIFICATION_TOPIC_UNSUBSCRIBE_FAILED", err);
  }
});

module.exports = router;
