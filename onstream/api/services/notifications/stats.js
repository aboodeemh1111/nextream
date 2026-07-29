const NotificationStat = require("../../models/NotificationStat");
const { localDayKey } = require("./policy");

/**
 * Reads and writes the engagement counters the policy engine decides on.
 *
 * Kept apart from the dispatcher because the counters are the one piece of state
 * here that is written from three unrelated places — a send, an open, a click —
 * and the invariants between them only make sense read together:
 *
 *   - `pushesToday` is only meaningful next to the `pushDay` it belongs to. It
 *     is reset on the first push of a new local day rather than by a scheduled
 *     job, so there is no window in which a stale counter is trusted and no
 *     cron to be running for the caps to be correct.
 *   - `ignoredStreak` counts *up* on every push and is zeroed the moment
 *     anything in that category is opened. Counting optimistically like this
 *     means a viewer who never engages is throttled after a handful of sends
 *     rather than after a delay long enough to have already annoyed them.
 *
 * A concurrent pair of dispatches to the same viewer can leave `pushesToday`
 * one short, because the day-rollover decision is made from a value read a
 * moment earlier. That is deliberate: the alternative is a read-after-write per
 * recipient in the middle of a fan-out, and being off by one against a ceiling
 * of six is not a difference anybody can perceive.
 */

/** The row that holds account-wide totals rather than one category's. */
const GLOBAL = "*";

/**
 * Counters for a set of viewers, as userId -> (category -> row).
 *
 * One query for the whole fan-out. The dispatcher needs every category's row
 * for each recipient — the global one for caps, the entry's own for engagement —
 * so fetching per category would be two queries per person.
 */
async function loadStats(userIds) {
  const ids = [...new Set((userIds || []).map(String))].filter(Boolean);
  const out = new Map();
  if (!ids.length) return out;

  const rows = await NotificationStat.find({ userId: { $in: ids } }).lean();

  for (const row of rows) {
    const key = String(row.userId);
    if (!out.has(key)) out.set(key, new Map());
    out.get(key).set(row.category, row);
  }
  return out;
}

/** The two rows one notification touches: its category, and the rollup. */
function rowsFor(stats, userId) {
  return stats?.get(String(userId)) || new Map();
}

function bulk(ops) {
  if (!ops.length) return Promise.resolve(null);
  // Unordered: these are independent per-user upserts, and one failing must not
  // abandon the rest of a fan-out's bookkeeping.
  return NotificationStat.bulkWrite(ops, { ordered: false }).catch((err) => {
    console.error("NOTIFICATION_STATS_WRITE_FAILED:", err.message);
    return null;
  });
}

function upsert(userId, category, update) {
  return {
    updateOne: { filter: { userId, category }, update, upsert: true },
  };
}

/**
 * Records that notifications were created, whether or not they were pushed.
 *
 * `created` is the denominator every rate in the admin console is over, so it
 * counts the inbox rows rather than the sends.
 */
async function recordCreated(rows, now = new Date()) {
  const counts = new Map();
  for (const row of rows || []) {
    const key = `${row.userId}|${row.category}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    const globalKey = `${row.userId}|${GLOBAL}`;
    counts.set(globalKey, (counts.get(globalKey) || 0) + 1);
  }

  const ops = [];
  for (const [key, count] of counts) {
    const [userId, category] = key.split("|");
    ops.push(upsert(userId, category, { $inc: { created: count }, $set: { lastCreatedAt: now } }));
  }
  return bulk(ops);
}

/**
 * Records pushes that actually reached a device.
 *
 * `entries` is [{ userId, category, timezone }], one per delivered push. The
 * timezone comes along because the daily counter is reset on the *viewer's*
 * midnight, and the server's has nothing to do with it.
 */
async function recordPushed(entries, { stats, now = new Date() } = {}) {
  const grouped = new Map();
  for (const entry of entries || []) {
    const key = `${entry.userId}|${entry.category}|${entry.timezone || "UTC"}`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }

  const ops = [];
  for (const [key, count] of grouped) {
    const [userId, category, timezone] = key.split("|");
    const today = localDayKey(now, timezone);

    for (const bucket of [category, GLOBAL]) {
      const existing = rowsFor(stats, userId).get(bucket);
      const rolled = existing?.pushDay !== today;

      // $set and $inc cannot touch the same field, so a day rollover writes the
      // count and a same-day push increments it.
      const update = {
        $set: { lastPushAt: now, pushDay: today },
        $inc: { pushed: count, ignoredStreak: count },
      };
      if (rolled) update.$set.pushesToday = count;
      else update.$inc.pushesToday = count;

      ops.push(upsert(userId, bucket, update));
    }
  }
  return bulk(ops);
}

/**
 * Records that a viewer read something.
 *
 * Zeroing `ignoredStreak` is the whole point: one open is enough evidence that
 * the category is wanted, and leaving a decayed streak in place would keep a
 * viewer throttled after they had started engaging again.
 */
async function recordOpened(userId, category) {
  if (!userId || !category) return null;
  return bulk([
    upsert(userId, category, { $inc: { opened: 1 }, $set: { ignoredStreak: 0 } }),
    upsert(userId, GLOBAL, { $inc: { opened: 1 }, $set: { ignoredStreak: 0 } }),
  ]);
}

/** A click is a stronger signal than an open, and also clears the streak. */
async function recordClicked(userId, category) {
  if (!userId || !category) return null;
  return bulk([
    upsert(userId, category, { $inc: { clicked: 1 }, $set: { ignoredStreak: 0 } }),
    upsert(userId, GLOBAL, { $inc: { clicked: 1 }, $set: { ignoredStreak: 0 } }),
  ]);
}

/** One viewer's counters, shaped for the settings page's "why am I not getting…". */
async function forUser(userId) {
  const rows = await NotificationStat.find({ userId }).lean();
  const byCategory = {};
  let global = null;

  for (const row of rows) {
    const summary = {
      created: row.created || 0,
      pushed: row.pushed || 0,
      opened: row.opened || 0,
      clicked: row.clicked || 0,
      ignoredStreak: row.ignoredStreak || 0,
      lastPushAt: row.lastPushAt || null,
    };
    if (row.category === GLOBAL) global = { ...summary, pushesToday: row.pushesToday || 0, pushDay: row.pushDay || "" };
    else byCategory[row.category] = summary;
  }

  return { global, categories: byCategory };
}

module.exports = {
  GLOBAL,
  forUser,
  loadStats,
  recordClicked,
  recordCreated,
  recordOpened,
  recordPushed,
  rowsFor,
};
