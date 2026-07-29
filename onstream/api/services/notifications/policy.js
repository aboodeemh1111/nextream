const { CATEGORIES, defaultPreferences, getType } = require("./catalog");

/**
 * Whether, and how, one notification is allowed to reach one person.
 *
 * This is the part of a notification system that decides whether people keep it
 * switched on. Everything else — the fan-out, the templates, the push transport
 * — only affects whether a message *can* be delivered; this decides whether it
 * *should* be, and it is the difference between an inbox someone reads and a
 * permission they revoke.
 *
 * Six rules, applied in this order, each of which exists because skipping it
 * produces a specific well-known failure:
 *
 *   1. Category      — a viewer who switched a category off gets nothing from
 *                      it, inbox included. A switch that only silences the push
 *                      but keeps filling the bell is not an off switch.
 *   2. Digest mode   — "one summary a week" has to actually suppress the
 *                      per-event pushes, or it is a second inbox rather than a
 *                      replacement for the first.
 *   3. Engagement    — a category whose last several pushes were all ignored
 *                      stops pushing and keeps filing. This is the only rule
 *                      that learns, and it is what stops a recommendation
 *                      stream from training people to dismiss the app.
 *   4. Daily cap     — an account-wide ceiling. Without it, a ten-episode
 *                      season drop across three followed shows is thirty
 *                      interruptions in a minute.
 *   5. Quiet hours   — a push inside them is deferred, not dropped: the message
 *                      was still worth sending, just not at 3am.
 *   6. Minimum gap   — spacing, so a burst arrives as a short queue instead of
 *                      a vibration the phone cannot keep up with.
 *
 * Priority is the escape hatch, and it is deliberately narrow. `high` skips the
 * daily cap only — a viewer who followed a show asked for its episodes, so the
 * volume of *other* notifications should not swallow them. `transactional`
 * skips everything, and only account security uses it.
 *
 * Pure throughout: no database, no `Date.now()`. `now` is always a parameter,
 * which is what makes the quiet-hours and cap arithmetic testable at all.
 */

const MINUTE_MS = 60 * 1000;
const DAY_MINUTES = 24 * 60;

/**
 * Consecutive ignored pushes before a category is demoted to inbox-only.
 *
 * Higher for `high`-priority types because those follow an explicit action —
 * you followed the show, you wrote the comment — and a few unopened pushes are
 * weaker evidence of disinterest than they are for something we chose to send.
 */
const IGNORED_STREAK_LIMIT = { high: 8, normal: 4, low: 3 };

/** Ceiling on how far a quiet-hours deferral may push a send. */
const MAX_DEFER_MINUTES = DAY_MINUTES;

// --- preferences -------------------------------------------------------------

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * "HH:MM" -> minutes since local midnight, or null.
 *
 * Deliberately strict. A malformed clock string that parsed as 0 would put
 * quiet hours at midnight for everyone who typed one in wrong, which reads as
 * the feature being broken rather than as the input being rejected.
 */
function parseClock(value) {
  if (typeof value !== "string") return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatClock(minutes) {
  const total = ((Math.round(Number(minutes)) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hours = Math.floor(total / 60);
  return `${String(hours).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Does this runtime know the zone? An unknown one would throw on every format. */
function isValidTimezone(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value }).format(new Date(0));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * A complete, valid preference object, whatever shape the stored one is in.
 *
 * Stored preferences are always partial: they predate categories that have
 * since been added, they were written by an older client, or the viewer has
 * never opened the settings page. Every read goes through here so that a
 * missing switch is the category's documented default rather than `undefined`,
 * which is falsy — and would silently opt people *out* of anything new.
 */
function resolvePreferences(stored) {
  const defaults = defaultPreferences();
  if (!isPlainObject(stored)) return defaults;

  const categories = { ...defaults.categories };
  const storedCategories = isPlainObject(stored.categories) ? stored.categories : null;
  for (const key of Object.keys(categories)) {
    // A locked category is not a preference; ignore whatever is stored for it.
    if (CATEGORIES[key]?.locked) {
      categories[key] = true;
      continue;
    }
    if (storedCategories && typeof storedCategories[key] === "boolean") {
      categories[key] = storedCategories[key];
      continue;
    }
    // Legacy flags from the pre-category schema, so viewers who set these years
    // ago are not opted back into what they turned off.
    if (key === "product" && typeof stored.product === "boolean") categories[key] = stored.product;
    if (key === "continue_watching" && typeof stored.reminders === "boolean") {
      categories[key] = stored.reminders;
    }
    if ((key === "recommendations" || key === "digest") && typeof stored.marketing === "boolean") {
      // `marketing: false` was the only way to opt out of unsolicited sends, so
      // it governs both taste-driven types. Digest stays off unless asked for.
      if (stored.marketing === false) categories[key] = false;
    }
  }

  const quiet = isPlainObject(stored.quietHours) ? stored.quietHours : {};
  const start = parseClock(quiet.start);
  const end = parseClock(quiet.end);
  const quietHours = {
    // The old schema had no `enabled` flag: quiet hours were on if both clock
    // values were set. Honour that, so an existing window keeps working.
    enabled:
      typeof quiet.enabled === "boolean"
        ? quiet.enabled && start !== null && end !== null
        : start !== null && end !== null,
    start: start === null ? defaults.quietHours.start : formatClock(start),
    end: end === null ? defaults.quietHours.end : formatClock(end),
  };
  // A window whose ends are equal is either zero-length or all day; neither is
  // what anyone means by it, so it is treated as unset.
  if (quietHours.start === quietHours.end) quietHours.enabled = false;

  const maxPushPerDay = Number(stored.maxPushPerDay);
  const minGap = Number(stored.minPushGapMinutes);

  return {
    push: typeof stored.push === "boolean" ? stored.push : defaults.push,
    categories,
    quietHours,
    timezone: isValidTimezone(stored.timezone) ? stored.timezone : defaults.timezone,
    maxPushPerDay:
      Number.isFinite(maxPushPerDay) && maxPushPerDay >= 0
        ? Math.min(50, Math.round(maxPushPerDay))
        : defaults.maxPushPerDay,
    minPushGapMinutes:
      Number.isFinite(minGap) && minGap >= 0
        ? Math.min(24 * 60, Math.round(minGap))
        : defaults.minPushGapMinutes,
    digest: typeof stored.digest === "boolean" ? stored.digest : defaults.digest,
  };
}

/**
 * Applies a client patch to stored preferences.
 *
 * Returns the full resolved object, so a PATCH of one switch cannot drop the
 * rest, and every value is validated on the way in rather than trusted and
 * discovered to be nonsense at send time.
 */
function mergePreferences(stored, patch) {
  const current = resolvePreferences(stored);
  if (!isPlainObject(patch)) return current;

  const next = {
    ...current,
    categories: { ...current.categories },
    quietHours: { ...current.quietHours },
  };

  if (typeof patch.push === "boolean") next.push = patch.push;
  if (typeof patch.digest === "boolean") next.digest = patch.digest;
  if (isValidTimezone(patch.timezone)) next.timezone = patch.timezone;

  if (isPlainObject(patch.categories)) {
    for (const [key, value] of Object.entries(patch.categories)) {
      if (!CATEGORIES[key] || CATEGORIES[key].locked) continue;
      if (typeof value === "boolean") next.categories[key] = value;
    }
  }

  if (isPlainObject(patch.quietHours)) {
    const start = parseClock(patch.quietHours.start);
    const end = parseClock(patch.quietHours.end);
    if (start !== null) next.quietHours.start = formatClock(start);
    if (end !== null) next.quietHours.end = formatClock(end);
    if (typeof patch.quietHours.enabled === "boolean") {
      next.quietHours.enabled = patch.quietHours.enabled;
    }
  }

  const maxPushPerDay = Number(patch.maxPushPerDay);
  if (Number.isFinite(maxPushPerDay) && maxPushPerDay >= 0) {
    next.maxPushPerDay = Math.min(50, Math.round(maxPushPerDay));
  }
  const minGap = Number(patch.minPushGapMinutes);
  if (Number.isFinite(minGap) && minGap >= 0) {
    next.minPushGapMinutes = Math.min(24 * 60, Math.round(minGap));
  }

  // Re-resolve so the invariants above (equal quiet-hour ends, locked
  // categories) hold on the way out as well as on the way in.
  return resolvePreferences(next);
}

// --- local time --------------------------------------------------------------

/**
 * The viewer's wall clock, in minutes since their local midnight.
 *
 * Intl rather than a fixed offset because a stored offset is wrong twice a year
 * and quiet hours are precisely the feature where that is noticed.
 */
function localMinutes(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  let hours = 0;
  let minutes = 0;
  for (const part of parts) {
    if (part.type === "hour") hours = Number(part.value);
    if (part.type === "minute") minutes = Number(part.value);
  }
  return hours * 60 + minutes;
}

/** Calendar day in the viewer's zone, as the YYYY-MM-DD key the caps compare. */
function localDayKey(date, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Is this instant inside the viewer's quiet window?
 *
 * Handles the wrap-around case, which is the normal one: 22:00–08:00 is two
 * disjoint intervals in clock-minutes, and a naive `start <= now < end` marks
 * the whole night as awake and the whole day as asleep.
 */
function inQuietHours(date, prefs) {
  if (!prefs?.quietHours?.enabled) return false;
  const start = parseClock(prefs.quietHours.start);
  const end = parseClock(prefs.quietHours.end);
  if (start === null || end === null || start === end) return false;

  const now = localMinutes(date, prefs.timezone);
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/**
 * When the current quiet window ends.
 *
 * Computed as a minute delta from the local clock rather than by constructing a
 * local datetime, because building "08:00 tomorrow in Asia/Tokyo" from a
 * timezone name needs a full tz database. Across a DST transition inside the
 * window the result is an hour out — for a "hold this until morning" rule that
 * is not a difference anyone can perceive, and it is bounded either way.
 */
function quietHoursEnd(date, prefs) {
  if (!inQuietHours(date, prefs)) return null;

  const end = parseClock(prefs.quietHours.end);
  const now = localMinutes(date, prefs.timezone);
  let delta = end - now;
  if (delta <= 0) delta += DAY_MINUTES;

  return new Date(date.getTime() + Math.min(delta, MAX_DEFER_MINUTES) * MINUTE_MS);
}

// --- the decision ------------------------------------------------------------

function statFor(stats, key) {
  if (!stats) return null;
  if (typeof stats.get === "function") return stats.get(key) || null;
  return stats[key] || null;
}

/**
 * How many pushes this account has already had today, in the viewer's own day.
 *
 * The stored counter carries the day it belongs to; when that day is not the
 * current one the counter is simply stale, and reading it as a live total would
 * silence someone all morning because of yesterday evening.
 */
function pushesToday(globalStat, now, timezone) {
  if (!globalStat) return 0;
  const today = localDayKey(now, timezone);
  return globalStat.pushDay === today ? Number(globalStat.pushesToday) || 0 : 0;
}

/**
 * Decides delivery for one drafted entry.
 *
 * Returns the shape the dispatcher persists:
 *
 *   {
 *     create,          // false means this notification does not exist at all
 *     channels,        // what will actually be used
 *     push: { state, deferUntil, suppressedBy },
 *     rule,            // the rule that determined the outcome, for reporting
 *   }
 *
 * `hasDevices` is passed in rather than looked up so this stays pure; a viewer
 * with no registered device is not a suppression to apologise for, but it is
 * worth recording, because "the campaign reached 40 of 200 people" is otherwise
 * indistinguishable from a broken transport.
 */
function decide({ entry, preferences, stats, now = new Date(), hasDevices = true } = {}) {
  if (!entry || !entry.type) return { create: false, channels: [], push: null, rule: "invalid" };

  const definition = getType(entry.type);
  const priority = entry.priority || definition?.priority || "normal";
  const category = entry.category || definition?.category || "product";
  const prefs = resolvePreferences(preferences);

  const suppress = (rule) => ({
    create: true,
    channels: ["inapp"],
    push: { state: "suppressed", deferUntil: null, suppressedBy: rule },
    rule,
  });

  // 1. Category. Transactional types are not governed by a switch, and their
  //    category is locked anyway — the check is belt and braces.
  const locked = Boolean(CATEGORIES[category]?.locked);
  if (priority !== "transactional" && !locked && prefs.categories[category] === false) {
    return { create: false, channels: [], push: null, rule: "category_off" };
  }

  const wantsPush = Array.isArray(entry.channels) && entry.channels.includes("push");
  if (!wantsPush) {
    return {
      create: true,
      channels: ["inapp"],
      push: { state: "none", deferUntil: null, suppressedBy: "" },
      rule: "inapp_only",
    };
  }

  // Transactional bypasses every remaining rule by design: the message is only
  // useful while the event it describes is still happening.
  if (priority === "transactional") {
    return {
      create: true,
      channels: hasDevices ? ["inapp", "push"] : ["inapp"],
      push: hasDevices
        ? { state: "pending", deferUntil: null, suppressedBy: "" }
        : { state: "suppressed", deferUntil: null, suppressedBy: "no_device" },
      rule: "transactional",
    };
  }

  if (!prefs.push) return suppress("push_off");
  if (!hasDevices) return suppress("no_device");

  // 2. Digest mode. Only the loud types survive it; everything else is what the
  //    weekly summary is for.
  if (prefs.digest && (priority === "normal" || priority === "low")) {
    return suppress("digest_mode");
  }

  // 3. Engagement. Counted per category, because ignoring social activity says
  //    nothing about whether new-episode alerts are wanted.
  const categoryStat = statFor(stats, category);
  const streakLimit = IGNORED_STREAK_LIMIT[priority] ?? IGNORED_STREAK_LIMIT.normal;
  if ((Number(categoryStat?.ignoredStreak) || 0) >= streakLimit) {
    return suppress("ignored_streak");
  }

  const globalStat = statFor(stats, "*");

  // 4. Daily cap. `high` is exempt: it is reserved for things the viewer asked
  //    for by name, and letting unsolicited sends consume the budget that hides
  //    them is the wrong trade.
  if (priority !== "high" && pushesToday(globalStat, now, prefs.timezone) >= prefs.maxPushPerDay) {
    return suppress("cap_reached");
  }

  // 5. Quiet hours — deferred rather than suppressed. The in-app row is already
  //    there; only the interruption waits.
  const quietEnd = quietHoursEnd(now, prefs);
  if (quietEnd) {
    return {
      create: true,
      channels: ["inapp", "push"],
      push: { state: "deferred", deferUntil: quietEnd, suppressedBy: "" },
      rule: "quiet_hours",
    };
  }

  // 6. Minimum gap. Also a deferral: the send is fine, the timing is not.
  const lastPushAt = globalStat?.lastPushAt ? new Date(globalStat.lastPushAt) : null;
  if (lastPushAt && Number.isFinite(lastPushAt.getTime()) && prefs.minPushGapMinutes > 0) {
    const earliest = lastPushAt.getTime() + prefs.minPushGapMinutes * MINUTE_MS;
    if (earliest > now.getTime()) {
      return {
        create: true,
        channels: ["inapp", "push"],
        push: { state: "deferred", deferUntil: new Date(earliest), suppressedBy: "" },
        rule: "min_gap",
      };
    }
  }

  return {
    create: true,
    channels: ["inapp", "push"],
    push: { state: "pending", deferUntil: null, suppressedBy: "" },
    rule: "send",
  };
}

/**
 * Re-checks a deferred push at the moment the scheduler is about to send it.
 *
 * A deferral can be hours old, and everything it was waiting on may have
 * changed: the viewer may have switched the category off, hit the cap on other
 * sends, or entered a *new* quiet window. Re-deciding is what stops a queue of
 * deferrals from turning into the 8am burst that quiet hours existed to avoid.
 *
 * The one thing it does not do is re-defer forever: past `expireAfterHours` the
 * message has stopped being news, and it stays in the inbox as one.
 */
function reconsiderDeferred({
  entry,
  preferences,
  stats,
  now = new Date(),
  hasDevices = true,
  deferredAt,
  expireAfterHours = 24,
} = {}) {
  const decision = decide({ entry, preferences, stats, now, hasDevices });

  const since = deferredAt ? new Date(deferredAt).getTime() : null;
  const expired =
    Number.isFinite(since) && now.getTime() - since > expireAfterHours * 60 * MINUTE_MS;

  if (expired && decision.push?.state === "deferred") {
    return {
      ...decision,
      push: { state: "suppressed", deferUntil: null, suppressedBy: "stale" },
      rule: "stale",
    };
  }
  // The row already exists; a category switched off since is a reason not to
  // interrupt, not a reason to retroactively delete what is in the inbox.
  if (!decision.create) {
    return {
      create: true,
      channels: ["inapp"],
      push: { state: "suppressed", deferUntil: null, suppressedBy: decision.rule },
      rule: decision.rule,
    };
  }
  return decision;
}

module.exports = {
  IGNORED_STREAK_LIMIT,
  decide,
  formatClock,
  inQuietHours,
  isValidTimezone,
  localDayKey,
  localMinutes,
  mergePreferences,
  parseClock,
  pushesToday,
  quietHoursEnd,
  reconsiderDeferred,
  resolvePreferences,
};
