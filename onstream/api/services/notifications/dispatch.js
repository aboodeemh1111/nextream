const mongoose = require("mongoose");
const Notification = require("../../models/Notification");
const User = require("../../models/User");
const { buildEntry } = require("./catalog");
const policy = require("./policy");
const push = require("./push");
const stats = require("./stats");
const stream = require("./stream");
const { present } = require("./view");

/**
 * One event in, N delivered notifications out.
 *
 * The whole pipeline, in the order it runs:
 *
 *   1. **Render** — each recipient's context becomes a draft through the catalog.
 *      A draft that cannot be rendered honestly is dropped here, before any
 *      state is touched.
 *   2. **Load** — preferences, device tokens and engagement counters for the
 *      whole recipient set, in two queries. This is the step that decides
 *      whether a fan-out is cheap or quadratic.
 *   3. **Decide** — the pure policy engine, per draft.
 *   4. **Persist** — one bulk write, keyed on the dedupe key, so sending the
 *      same event twice is a no-op rather than a duplicate.
 *   5. **Deliver** — SSE to whoever is connected, FCM to whoever is not, with
 *      the deferred ones left for the scheduler.
 *   6. **Record** — counters, so the next decision is better informed than this
 *      one was.
 *
 * Two properties this is built around:
 *
 * **Idempotence.** Every step past the render is safe to run twice. The insert
 * is an upsert on a unique key, the push is only attempted for rows the insert
 * reports as new, and the counters are incremented from the delivery result
 * rather than from the intent. A retried webhook, a double-clicked admin button
 * and a redeployed process mid-fan-out all converge on the same state.
 *
 * **It never breaks its caller.** Notifications are a side effect of something
 * else succeeding — publishing an episode, posting a comment. `emit()` in
 * events.js is the fire-and-forget entry point precisely so that a notification
 * bug cannot fail the request that triggered it, and every failure here is
 * logged and swallowed rather than thrown.
 */

/** Recipients handled in one dispatch. Above this the caller is told it was cut. */
const MAX_RECIPIENTS = 5_000;

/** Rows per bulk write. Keeps one fan-out from building a 40MB command. */
const WRITE_CHUNK = 500;

function chunk(items, size) {
  const out = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

/** Deduped, bounded, and normalised to the one shape the rest of this expects. */
function normaliseRecipients(recipients) {
  const seen = new Map();
  for (const entry of recipients || []) {
    const userId = String(entry?.userId || entry?._id || entry || "");
    if (!userId || !mongoose.isValidObjectId(userId)) continue;

    const score = Number.isFinite(Number(entry?.score)) ? Number(entry.score) : 1;
    const existing = seen.get(userId);
    // Two sources can nominate the same person — a follower who is also
    // mid-season. Keep the stronger claim, and the reason that came with it.
    if (!existing || score > existing.score) {
      seen.set(userId, { userId, score, reason: entry?.reason || "" });
    }
  }
  return [...seen.values()];
}

/**
 * The two reads the whole fan-out needs.
 *
 * Preferences and device tokens come off the same User document, so they are one
 * query; the counters are the other. Everything downstream is in-memory.
 */
async function loadContext(userIds) {
  const [users, counters] = await Promise.all([
    User.find({ _id: { $in: userIds } })
      .select("notificationPrefs deviceTokens.token")
      .lean(),
    stats.loadStats(userIds),
  ]);

  const byUser = new Map();
  for (const user of users) {
    const tokens = (user.deviceTokens || []).map((device) => device.token).filter(Boolean);
    byUser.set(String(user._id), {
      preferences: policy.resolvePreferences(user.notificationPrefs),
      tokens,
    });
  }

  return { byUser, counters };
}

/**
 * Turns a decided draft into the document to write.
 *
 * The `_id` is generated here rather than by Mongo, which is what makes the
 * read-back after the bulk write exact: a row that comes back under an id we
 * minted is one we created, and a dedupe collision leaves an older row under a
 * different id. Without that, telling "created" from "already existed" needs a
 * timestamp comparison that is wrong under clock skew.
 */
function toDocument(draft, decision, userId, now) {
  return {
    _id: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(String(userId)),
    type: draft.type,
    category: draft.category,
    priority: draft.priority,
    title: draft.title,
    body: draft.body,
    icon: draft.icon,
    image: draft.image,
    deepLink: draft.deepLink,
    entity: draft.entity,
    data: draft.data,
    reason: draft.reason,
    score: draft.score,
    groupKey: draft.groupKey,
    dedupeKey: draft.dedupeKey,
    channels: decision.channels,
    delivery: {
      push: decision.push?.state || "none",
      deferUntil: decision.push?.deferUntil || null,
      sentAt: null,
      messageId: "",
      error: "",
      suppressedBy: decision.push?.suppressedBy || "",
      attempts: 0,
      devices: 0,
    },
    seenAt: null,
    read: false,
    readAt: null,
    clickedAt: null,
    archived: false,
    campaignId: draft.campaignId,
    createdBy: draft.createdBy,
    expiresAt: draft.expiresAt,
    createdAt: now,
    // `updatedAt` is deliberately absent. The schema has `timestamps: true`, so
    // Mongoose adds `$set: { updatedAt }` to every bulkWrite operation — and a
    // field present in both `$set` and `$setOnInsert` makes MongoDB reject the
    // whole operation with "would create a conflict at 'updatedAt'" (code 40).
    // That failure is per-operation, so nothing was written and no duplicate-key
    // error appeared either; the symptom was every catalog notification silently
    // not existing while announcements, which take the insertOne branch, worked.
  };
}

/**
 * Writes the rows, and reports exactly which ones are new.
 *
 * Rows with a dedupe key are upserted on it with `$setOnInsert`, so a second
 * dispatch of the same event matches the existing row and changes nothing —
 * notably it does not reset `read`, which a plain insert-and-ignore-the-error
 * approach gets right only by accident and an `updateOne` without
 * `$setOnInsert` gets wrong outright, resurfacing a notification the viewer had
 * already dismissed.
 */
async function persist(documents) {
  if (!documents.length) return [];

  const ids = [];
  for (const batch of chunk(documents, WRITE_CHUNK)) {
    const operations = batch.map((doc) =>
      doc.dedupeKey
        ? { updateOne: { filter: { dedupeKey: doc.dedupeKey }, update: { $setOnInsert: doc }, upsert: true } }
        : { insertOne: { document: doc } }
    );

    try {
      await Notification.bulkWrite(operations, { ordered: false });
    } catch (err) {
      /**
       * An unordered bulk write applies what it can and reports the rest, so a
       * duplicate key racing another process is expected and not worth a log
       * line — that is the dedupe index doing its job.
       *
       * Everything else is. The earlier version of this treated the mere
       * *presence* of `writeErrors` as benign, which meant a genuine schema
       * conflict was indistinguishable from a dedupe hit: notifications simply
       * did not appear, with nothing in the log to say why. Each error is now
       * inspected, and only 11000 is quiet.
       */
      const errors = err?.writeErrors?.length ? err.writeErrors : [err];
      const unexpected = errors.filter((entry) => (entry.code ?? entry.err?.code) !== 11000);
      if (unexpected.length) {
        console.error(
          `NOTIFICATION_WRITE_FAILED: ${unexpected.length}/${operations.length} operations failed —`,
          unexpected[0].errmsg || unexpected[0].err?.errmsg || unexpected[0].message || err.message
        );
      }
    }
    ids.push(...batch.map((doc) => doc._id));
  }

  // Only ids we minted come back, so this is precisely the set that was created.
  return Notification.find({ _id: { $in: ids } }).lean();
}

/**
 * Sends the pushes for a set of persisted rows and records the outcome.
 *
 * Shared with the scheduler, which calls it for deferred rows that have come
 * due, so the send path and its bookkeeping exist once.
 */
async function deliverPush(rows, { context, counters, now = new Date() } = {}) {
  const pending = rows.filter((row) => row.delivery?.push === "pending");
  if (!pending.length) return { pushed: 0, failed: 0 };

  const tokensByUser =
    context || (await push.tokensByUser(pending.map((row) => String(row.userId))));

  const operations = [];
  const delivered = [];
  const dead = new Set();
  let pushed = 0;
  let failed = 0;

  for (const row of pending) {
    const entry = tokensByUser.get(String(row.userId));
    const tokens = Array.isArray(entry) ? entry : entry?.tokens || [];

    if (!tokens.length) {
      operations.push({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $set: { "delivery.push": "suppressed", "delivery.suppressedBy": "no_device" },
            $inc: { "delivery.attempts": 1 },
          },
        },
      });
      continue;
    }

    const result = await push.sendToTokens(tokens, row);
    for (const token of result.deadTokens) dead.add(token);

    if (result.sent > 0) {
      pushed += 1;
      delivered.push({
        userId: String(row.userId),
        category: row.category,
        timezone: entry?.preferences?.timezone || "UTC",
      });
      operations.push({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $set: {
              "delivery.push": "sent",
              "delivery.sentAt": now,
              "delivery.messageId": result.messageId,
              "delivery.devices": result.sent,
              "delivery.error": "",
            },
            $inc: { "delivery.attempts": 1 },
          },
        },
      });
    } else {
      failed += 1;
      operations.push({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $set: { "delivery.push": "failed", "delivery.error": result.error || "unknown" },
            $inc: { "delivery.attempts": 1 },
          },
        },
      });
    }
  }

  if (operations.length) {
    await Notification.bulkWrite(operations, { ordered: false }).catch((err) =>
      console.error("NOTIFICATION_DELIVERY_WRITE_FAILED:", err.message)
    );
  }
  // Pruning last: a token is only known to be dead once the send that used it
  // has been accounted for.
  if (dead.size) await push.pruneTokens([...dead]);
  if (delivered.length) await stats.recordPushed(delivered, { stats: counters, now });

  return { pushed, failed };
}

/** Unread badge counts for a set of viewers, in one query. */
async function unreadCounts(userIds) {
  const rows = await Notification.aggregate([
    {
      $match: {
        userId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
        read: false,
        archived: false,
      },
    },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
  ]);

  const out = new Map();
  for (const row of rows) out.set(String(row._id), row.count);
  return out;
}

/**
 * The entry point.
 *
 * `recipients` is [{ userId, score, reason }] from audience.js, or plain ids.
 * `ctx` is the type's render context — the show, the episode, the actor — minus
 * the per-recipient fields, which are merged in per draft.
 *
 * Returns a summary rather than the rows: callers are hooks and admin endpoints,
 * and what both want to know is how many people it reached and why the rest were
 * skipped.
 */
async function dispatch(type, recipients, ctx = {}, { now = new Date() } = {}) {
  const audience = normaliseRecipients(recipients);
  const truncated = audience.length > MAX_RECIPIENTS;
  const targets = audience.slice(0, MAX_RECIPIENTS);

  const summary = {
    type,
    requested: audience.length,
    truncated,
    created: 0,
    pushed: 0,
    failed: 0,
    deferred: 0,
    duplicates: 0,
    skipped: 0,
    rules: {},
  };
  if (!targets.length) return summary;

  const count = (rule) => {
    summary.rules[rule] = (summary.rules[rule] || 0) + 1;
  };

  // 1. Render. Done before the reads so a type whose context is unusable costs
  //    nothing at all.
  const drafts = [];
  for (const target of targets) {
    const draft = buildEntry(type, {
      ...ctx,
      userId: target.userId,
      score: target.score,
      reason: target.reason || ctx.reason || "",
      now,
    });
    if (!draft) {
      summary.skipped += 1;
      count("not_rendered");
      continue;
    }
    drafts.push({ target, draft });
  }
  if (!drafts.length) return summary;

  // 2. Load.
  const userIds = drafts.map((row) => row.target.userId);
  const { byUser, counters } = await loadContext(userIds);

  // 3. Decide.
  const documents = [];
  for (const { target, draft } of drafts) {
    const context = byUser.get(target.userId);
    // No User document: the account was deleted between the audience query and
    // now. Nothing to notify.
    if (!context) {
      summary.skipped += 1;
      count("no_user");
      continue;
    }

    const decision = policy.decide({
      entry: draft,
      preferences: context.preferences,
      stats: counters.get(target.userId),
      now,
      hasDevices: context.tokens.length > 0,
    });

    count(decision.rule);
    if (!decision.create) {
      summary.skipped += 1;
      continue;
    }
    documents.push(toDocument(draft, decision, target.userId, now));
  }
  if (!documents.length) return summary;

  // 4. Persist.
  const rows = await persist(documents);
  summary.created = rows.length;
  summary.duplicates = documents.length - rows.length;
  summary.deferred = rows.filter((row) => row.delivery?.push === "deferred").length;

  // 5. Deliver. The in-app copy reaches connected tabs immediately; the badge
  //    goes with it so a client never has to re-fetch a count it could be told.
  const badges = await unreadCounts([...new Set(rows.map((row) => String(row.userId)))]);
  for (const row of rows) {
    stream.publish(String(row.userId), "notification", {
      notification: present(row),
      unread: badges.get(String(row.userId)) || 0,
    });
  }

  const delivery = await deliverPush(rows, { context: byUser, counters, now });
  summary.pushed = delivery.pushed;
  summary.failed = delivery.failed;

  // 6. Record.
  await stats.recordCreated(
    rows.map((row) => ({ userId: String(row.userId), category: row.category })),
    now
  );

  return summary;
}

module.exports = {
  MAX_RECIPIENTS,
  deliverPush,
  dispatch,
  loadContext,
  normaliseRecipients,
  persist,
  toDocument,
  unreadCounts,
};
