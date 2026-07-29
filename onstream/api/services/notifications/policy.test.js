const test = require("node:test");
const assert = require("node:assert");

const { buildEntry } = require("./catalog");
const {
  decide,
  inQuietHours,
  localDayKey,
  mergePreferences,
  parseClock,
  quietHoursEnd,
  reconsiderDeferred,
  resolvePreferences,
} = require("./policy");

// Every rule here exists because leaving it out produces a specific failure a
// viewer notices, so each test names that failure. The two that matter most are
// the wrap-around quiet window (a naive comparison inverts it, so the feature
// silences the day and shouts through the night) and the stale daily counter
// (read without checking its day, it silences someone all morning because of
// yesterday evening).

const NOW = new Date("2026-07-29T12:00:00Z"); // Wednesday, midday UTC

const show = { _id: "show1", title: "The Long Dark", backdrop: "b.jpg" };
const episode = { _id: "ep1", title: "Whiteout", seasonNumber: 2, episodeNumber: 7 };

/** A `high`-priority entry: a new episode of a followed show. */
function followed(overrides = {}) {
  return { ...buildEntry("episode.published", { show, episode, userId: "u1", now: NOW }), ...overrides };
}

/** A `normal`-priority entry: an unsolicited recommendation. */
function suggested(overrides = {}) {
  return {
    ...buildEntry("show.published", { show, userId: "u1", score: 0.9, now: NOW }),
    ...overrides,
  };
}

// --- preference resolution ---------------------------------------------------

test("an empty preference document resolves to the documented defaults", () => {
  const prefs = resolvePreferences(null);

  assert.strictEqual(prefs.push, true);
  assert.strictEqual(prefs.categories.new_content, true);
  assert.strictEqual(prefs.categories.digest, false);
  assert.strictEqual(prefs.quietHours.enabled, false);
  assert.strictEqual(prefs.timezone, "UTC");
});

test("a category added after the viewer last saved gets its default, not false", () => {
  // The bug this prevents: reading a missing switch as falsy silently opts
  // everyone out of every category the product adds from here on.
  const prefs = resolvePreferences({ categories: { social: false } });

  assert.strictEqual(prefs.categories.social, false);
  assert.strictEqual(prefs.categories.new_content, true);
});

test("the account category cannot be switched off, however it is stored", () => {
  const prefs = resolvePreferences({ categories: { account: false } });
  assert.strictEqual(prefs.categories.account, true);

  const merged = mergePreferences({}, { categories: { account: false } });
  assert.strictEqual(merged.categories.account, true);
});

test("legacy opt-outs are honoured rather than reset", () => {
  // The old schema had three booleans. Someone who turned marketing off years
  // ago must not be opted back in by the migration to categories.
  const prefs = resolvePreferences({ marketing: false, reminders: false, product: true });

  assert.strictEqual(prefs.categories.recommendations, false);
  assert.strictEqual(prefs.categories.digest, false);
  assert.strictEqual(prefs.categories.continue_watching, false);
  assert.strictEqual(prefs.categories.product, true);
});

test("legacy quiet hours with no enabled flag stay in effect", () => {
  const prefs = resolvePreferences({ quietHours: { start: "23:00", end: "07:00" } });
  assert.strictEqual(prefs.quietHours.enabled, true);
});

test("a malformed clock is rejected instead of parsing as midnight", () => {
  assert.strictEqual(parseClock("22:00"), 22 * 60);
  assert.strictEqual(parseClock("7:05"), 7 * 60 + 5);
  assert.strictEqual(parseClock("24:00"), null);
  assert.strictEqual(parseClock("22:60"), null);
  assert.strictEqual(parseClock("10pm"), null);
  assert.strictEqual(parseClock(""), null);
  assert.strictEqual(parseClock(null), null);

  // And a rejected value falls back rather than putting the window at midnight.
  const prefs = resolvePreferences({ quietHours: { enabled: true, start: "nonsense", end: "08:00" } });
  assert.strictEqual(prefs.quietHours.start, "22:00");
});

test("a zero-length window is treated as unset", () => {
  const prefs = resolvePreferences({ quietHours: { enabled: true, start: "08:00", end: "08:00" } });
  assert.strictEqual(prefs.quietHours.enabled, false);
});

test("an unknown timezone falls back instead of throwing at send time", () => {
  assert.strictEqual(resolvePreferences({ timezone: "Mars/Olympus" }).timezone, "UTC");
  assert.strictEqual(resolvePreferences({ timezone: "Asia/Tokyo" }).timezone, "Asia/Tokyo");
});

test("merging a patch keeps every switch the patch did not mention", () => {
  const stored = resolvePreferences({ categories: { social: false }, maxPushPerDay: 3 });
  const next = mergePreferences(stored, { categories: { recommendations: false } });

  assert.strictEqual(next.categories.recommendations, false);
  assert.strictEqual(next.categories.social, false, "an unmentioned switch was dropped");
  assert.strictEqual(next.maxPushPerDay, 3);
});

test("merged numeric limits are clamped, not trusted", () => {
  assert.strictEqual(mergePreferences({}, { maxPushPerDay: 9999 }).maxPushPerDay, 50);
  assert.strictEqual(mergePreferences({}, { maxPushPerDay: -4 }).maxPushPerDay, 6);
  assert.strictEqual(mergePreferences({}, { minPushGapMinutes: 100000 }).minPushGapMinutes, 1440);
});

// --- quiet hours -------------------------------------------------------------

test("an overnight window covers the night and not the day", () => {
  const prefs = resolvePreferences({
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    timezone: "UTC",
  });

  assert.strictEqual(inQuietHours(new Date("2026-07-29T23:30:00Z"), prefs), true);
  assert.strictEqual(inQuietHours(new Date("2026-07-30T03:00:00Z"), prefs), true);
  assert.strictEqual(inQuietHours(new Date("2026-07-30T07:59:00Z"), prefs), true);
  assert.strictEqual(inQuietHours(new Date("2026-07-30T08:00:00Z"), prefs), false);
  assert.strictEqual(inQuietHours(new Date("2026-07-29T12:00:00Z"), prefs), false);
  assert.strictEqual(inQuietHours(new Date("2026-07-29T21:59:00Z"), prefs), false);
});

test("a same-day window covers only that stretch of the day", () => {
  const prefs = resolvePreferences({
    quietHours: { enabled: true, start: "09:00", end: "17:00" },
    timezone: "UTC",
  });

  assert.strictEqual(inQuietHours(new Date("2026-07-29T12:00:00Z"), prefs), true);
  assert.strictEqual(inQuietHours(new Date("2026-07-29T08:59:00Z"), prefs), false);
  assert.strictEqual(inQuietHours(new Date("2026-07-29T17:00:00Z"), prefs), false);
  assert.strictEqual(inQuietHours(new Date("2026-07-29T23:00:00Z"), prefs), false);
});

test("quiet hours are the viewer's, not the server's", () => {
  const tokyo = resolvePreferences({
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    timezone: "Asia/Tokyo",
  });

  // 14:00 UTC is 23:00 in Tokyo — the middle of their night.
  assert.strictEqual(inQuietHours(new Date("2026-07-29T14:00:00Z"), tokyo), true);
  // 03:00 UTC is midday in Tokyo.
  assert.strictEqual(inQuietHours(new Date("2026-07-29T03:00:00Z"), tokyo), false);
});

test("the deferral lands at the end of the window, not a fixed delay later", () => {
  const prefs = resolvePreferences({
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    timezone: "UTC",
  });

  const at2300 = quietHoursEnd(new Date("2026-07-29T23:00:00Z"), prefs);
  assert.strictEqual(at2300.toISOString(), "2026-07-30T08:00:00.000Z");

  const at0700 = quietHoursEnd(new Date("2026-07-30T07:00:00Z"), prefs);
  assert.strictEqual(at0700.toISOString(), "2026-07-30T08:00:00.000Z");

  // Outside the window there is nothing to wait for.
  assert.strictEqual(quietHoursEnd(new Date("2026-07-29T12:00:00Z"), prefs), null);
});

test("a local day key rolls over on the viewer's midnight", () => {
  // 21:00 UTC is already tomorrow in Tokyo, which is what the daily cap counts.
  const instant = new Date("2026-07-29T21:00:00Z");
  assert.strictEqual(localDayKey(instant, "UTC"), "2026-07-29");
  assert.strictEqual(localDayKey(instant, "Asia/Tokyo"), "2026-07-30");
});

// --- the decision ------------------------------------------------------------

test("a plain entry with nothing in the way is sent", () => {
  const decision = decide({ entry: followed(), preferences: {}, stats: {}, now: NOW });

  assert.strictEqual(decision.create, true);
  assert.deepStrictEqual(decision.channels, ["inapp", "push"]);
  assert.strictEqual(decision.push.state, "pending");
  assert.strictEqual(decision.rule, "send");
});

test("a switched-off category produces nothing at all, inbox included", () => {
  // A switch that silences the push but keeps filling the bell is not an off
  // switch, and viewers read it as the setting being broken.
  const decision = decide({
    entry: followed(),
    preferences: { categories: { new_content: false } },
    stats: {},
    now: NOW,
  });

  assert.strictEqual(decision.create, false);
  assert.deepStrictEqual(decision.channels, []);
  assert.strictEqual(decision.rule, "category_off");
});

test("the master push switch keeps the inbox and drops the interruption", () => {
  const decision = decide({ entry: followed(), preferences: { push: false }, stats: {}, now: NOW });

  assert.strictEqual(decision.create, true);
  assert.deepStrictEqual(decision.channels, ["inapp"]);
  assert.strictEqual(decision.push.state, "suppressed");
  assert.strictEqual(decision.push.suppressedBy, "push_off");
});

test("an in-app-only type is never promoted to a push", () => {
  const entry = buildEntry("next_episode.ready", { show, episode, userId: "u1", now: NOW });
  const decision = decide({ entry, preferences: {}, stats: {}, now: NOW });

  assert.deepStrictEqual(decision.channels, ["inapp"]);
  assert.strictEqual(decision.push.state, "none");
});

test("a viewer with no registered device is recorded, not silently skipped", () => {
  const decision = decide({ entry: followed(), preferences: {}, stats: {}, now: NOW, hasDevices: false });

  assert.deepStrictEqual(decision.channels, ["inapp"]);
  assert.strictEqual(decision.push.suppressedBy, "no_device");
});

test("digest mode absorbs the quiet types and lets the loud ones through", () => {
  const preferences = { digest: true };

  const recommendation = decide({ entry: suggested(), preferences, stats: {}, now: NOW });
  assert.strictEqual(recommendation.push.suppressedBy, "digest_mode");
  assert.deepStrictEqual(recommendation.channels, ["inapp"]);

  // A followed show's new episode is not marketing; a weekly summary is not an
  // acceptable substitute for it.
  const episodeDecision = decide({ entry: followed(), preferences, stats: {}, now: NOW });
  assert.strictEqual(episodeDecision.push.state, "pending");
});

test("a category whose pushes are always ignored stops pushing", () => {
  const stats = { recommendations: { ignoredStreak: 4 } };
  const decision = decide({ entry: suggested(), preferences: {}, stats, now: NOW });

  assert.strictEqual(decision.push.suppressedBy, "ignored_streak");
  assert.deepStrictEqual(decision.channels, ["inapp"], "the inbox copy still lands");
});

test("ignoring one category does not silence another", () => {
  const stats = { social: { ignoredStreak: 20 } };
  const decision = decide({ entry: suggested(), preferences: {}, stats, now: NOW });

  assert.strictEqual(decision.push.state, "pending");
});

test("an explicitly-followed show survives a longer ignored streak", () => {
  const stats = { new_content: { ignoredStreak: 5 } };

  // 5 is past the limit for unsolicited sends but not for one the viewer asked
  // for by following the show.
  assert.strictEqual(decide({ entry: followed(), preferences: {}, stats, now: NOW }).push.state, "pending");
  assert.strictEqual(
    decide({ entry: suggested(), preferences: {}, stats: { recommendations: { ignoredStreak: 5 } }, now: NOW })
      .push.suppressedBy,
    "ignored_streak"
  );
});

test("the daily cap counts only today's pushes", () => {
  const preferences = { maxPushPerDay: 3, timezone: "UTC" };

  const atCap = decide({
    entry: suggested(),
    preferences,
    stats: { "*": { pushDay: "2026-07-29", pushesToday: 3 } },
    now: NOW,
  });
  assert.strictEqual(atCap.push.suppressedBy, "cap_reached");

  // The same counter, left over from yesterday, must not silence today. This is
  // the bug that makes notifications stop for a whole morning.
  const stale = decide({
    entry: suggested(),
    preferences,
    stats: { "*": { pushDay: "2026-07-28", pushesToday: 99 } },
    now: NOW,
  });
  assert.strictEqual(stale.push.state, "pending");
});

test("the cap is account-wide, not per category", () => {
  // Six recommendation pushes must exhaust the same budget as six social ones,
  // or the ceiling is a ceiling per category and the account has none.
  const decision = decide({
    entry: suggested(),
    preferences: { maxPushPerDay: 2, timezone: "UTC" },
    stats: { "*": { pushDay: "2026-07-29", pushesToday: 2 }, recommendations: { pushesToday: 0 } },
    now: NOW,
  });
  assert.strictEqual(decision.push.suppressedBy, "cap_reached");
});

test("a high-priority send is not hidden behind the day's noise", () => {
  const decision = decide({
    entry: followed(),
    preferences: { maxPushPerDay: 2, timezone: "UTC" },
    stats: { "*": { pushDay: "2026-07-29", pushesToday: 20 } },
    now: NOW,
  });

  assert.strictEqual(decision.push.state, "pending");
});

test("quiet hours defer the push and keep the inbox row", () => {
  const decision = decide({
    entry: followed(),
    preferences: { quietHours: { enabled: true, start: "22:00", end: "08:00" }, timezone: "UTC" },
    stats: {},
    now: new Date("2026-07-29T23:30:00Z"),
  });

  assert.strictEqual(decision.create, true);
  assert.strictEqual(decision.push.state, "deferred");
  assert.strictEqual(decision.push.deferUntil.toISOString(), "2026-07-30T08:00:00.000Z");
});

test("a security alert ignores every rule, including quiet hours", () => {
  const entry = buildEntry("account.security", { userId: "u1", device: "Chrome on Windows", now: NOW });
  const decision = decide({
    entry,
    preferences: {
      push: false,
      digest: true,
      maxPushPerDay: 0,
      categories: { account: false },
      quietHours: { enabled: true, start: "00:00", end: "23:59" },
      timezone: "UTC",
    },
    stats: { "*": { pushDay: "2026-07-29", pushesToday: 500 }, account: { ignoredStreak: 99 } },
    now: new Date("2026-07-30T03:00:00Z"),
  });

  assert.strictEqual(decision.push.state, "pending");
  assert.strictEqual(decision.rule, "transactional");
});

test("even a security alert cannot push to a device that does not exist", () => {
  const entry = buildEntry("account.security", { userId: "u1", device: "Chrome", now: NOW });
  const decision = decide({ entry, preferences: {}, stats: {}, now: NOW, hasDevices: false });

  assert.deepStrictEqual(decision.channels, ["inapp"]);
  assert.strictEqual(decision.push.suppressedBy, "no_device");
});

test("two sends close together are spaced rather than dropped", () => {
  const decision = decide({
    entry: followed(),
    preferences: { minPushGapMinutes: 20, timezone: "UTC" },
    stats: { "*": { lastPushAt: new Date("2026-07-29T11:55:00Z") } },
    now: NOW,
  });

  assert.strictEqual(decision.push.state, "deferred");
  assert.strictEqual(decision.push.deferUntil.toISOString(), "2026-07-29T12:15:00.000Z");
  assert.strictEqual(decision.rule, "min_gap");
});

test("a gap that has already elapsed does not delay anything", () => {
  const decision = decide({
    entry: followed(),
    preferences: { minPushGapMinutes: 20, timezone: "UTC" },
    stats: { "*": { lastPushAt: new Date("2026-07-29T11:00:00Z") } },
    now: NOW,
  });

  assert.strictEqual(decision.push.state, "pending");
});

test("quiet hours win over spacing", () => {
  // Both apply; deferring to the shorter of the two would push at 3am.
  const decision = decide({
    entry: followed(),
    preferences: {
      quietHours: { enabled: true, start: "22:00", end: "08:00" },
      minPushGapMinutes: 20,
      timezone: "UTC",
    },
    stats: { "*": { lastPushAt: new Date("2026-07-30T02:55:00Z") } },
    now: new Date("2026-07-30T03:00:00Z"),
  });

  assert.strictEqual(decision.push.deferUntil.toISOString(), "2026-07-30T08:00:00.000Z");
});

// --- deferred sends ----------------------------------------------------------

test("a deferred push is re-judged when it comes due, not sent blindly", () => {
  const deferredAt = new Date("2026-07-29T23:30:00Z");
  const dueAt = new Date("2026-07-30T08:00:00Z");

  const ok = reconsiderDeferred({ entry: followed(), preferences: {}, stats: {}, now: dueAt, deferredAt });
  assert.strictEqual(ok.push.state, "pending");

  // Switched off while it waited: the queued interruption is dropped, and the
  // row that is already in the inbox stays there.
  const off = reconsiderDeferred({
    entry: followed(),
    preferences: { categories: { new_content: false } },
    stats: {},
    now: dueAt,
    deferredAt,
  });
  assert.strictEqual(off.create, true);
  assert.strictEqual(off.push.state, "suppressed");
  assert.strictEqual(off.push.suppressedBy, "category_off");
});

test("a deferral that has stopped being news is not sent late", () => {
  const decision = reconsiderDeferred({
    entry: followed(),
    preferences: { quietHours: { enabled: true, start: "22:00", end: "08:00" }, timezone: "UTC" },
    stats: {},
    now: new Date("2026-07-31T23:00:00Z"),
    deferredAt: new Date("2026-07-29T23:00:00Z"),
  });

  assert.strictEqual(decision.push.state, "suppressed");
  assert.strictEqual(decision.push.suppressedBy, "stale");
});

test("an invalid entry is refused rather than dispatched", () => {
  assert.strictEqual(decide({ entry: null }).create, false);
  assert.strictEqual(decide({ entry: {} }).create, false);
});
