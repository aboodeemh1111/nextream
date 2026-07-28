const test = require("node:test");
const assert = require("node:assert");

const {
  CLOCK_GRACE_SEC,
  computePosition,
  genreKey,
  mergeQoe,
  reconcileSeconds,
  sanitiseQoe,
} = require("./playbackMetrics");

// Heartbeats arrive twice, out of order, and from clients that lie. Everything
// below states what has to stay true when they do — these are the rules that
// decide whether the admin profile shows a real number or an inflated one.

const T0 = new Date("2026-07-01T12:00:00Z");
const at = (seconds) => new Date(T0.getTime() + seconds * 1000);

test("a fresh session accepts the reported total", () => {
  const { seconds, delta } = reconcileSeconds({
    priorSeconds: 0,
    reportedSeconds: 30,
    startedAt: T0,
    now: at(30),
  });

  assert.strictEqual(seconds, 30);
  assert.strictEqual(delta, 30);
});

test("delta is the difference against what is stored, not the reported value", () => {
  // This is what makes the rollup on the User document correctable: the client
  // sends 90 having already sent 30, and only 60 more seconds are credited.
  const { seconds, delta } = reconcileSeconds({
    priorSeconds: 30,
    reportedSeconds: 90,
    startedAt: T0,
    now: at(90),
  });

  assert.strictEqual(seconds, 90);
  assert.strictEqual(delta, 60);
});

test("a replayed heartbeat credits nothing", () => {
  const { seconds, delta } = reconcileSeconds({
    priorSeconds: 90,
    reportedSeconds: 90,
    startedAt: T0,
    now: at(95),
  });

  assert.strictEqual(seconds, 90);
  assert.strictEqual(delta, 0);
});

test("a stale heartbeat cannot walk the total backwards", () => {
  // Reordering on a flaky connection delivers an older total after a newer one.
  const { seconds, delta } = reconcileSeconds({
    priorSeconds: 90,
    reportedSeconds: 30,
    startedAt: T0,
    now: at(95),
  });

  assert.strictEqual(seconds, 90);
  assert.strictEqual(delta, 0);
});

test("a total larger than the session's wall clock is clamped", () => {
  const { seconds } = reconcileSeconds({
    priorSeconds: 0,
    reportedSeconds: 999999,
    startedAt: T0,
    now: at(60),
  });

  assert.strictEqual(seconds, 60 + CLOCK_GRACE_SEC);
});

test("the grace covers a client whose session predates its first heartbeat", () => {
  // The row is created one interval in, so an honest total always runs a
  // little ahead of the time elapsed since the row existed.
  const { seconds } = reconcileSeconds({
    priorSeconds: 0,
    reportedSeconds: 20,
    startedAt: T0,
    now: T0,
  });

  assert.strictEqual(seconds, 20);
});

test("garbage seconds fall back to zero rather than NaN", () => {
  const { seconds, delta } = reconcileSeconds({
    priorSeconds: 0,
    reportedSeconds: "not a number",
    startedAt: T0,
    now: at(10),
  });

  assert.strictEqual(seconds, 0);
  assert.strictEqual(delta, 0);
});

// --- position ---------------------------------------------------------------

test("percent comes from the furthest point reached, not the current one", () => {
  // Watched to the end, then scrubbed back to rewatch a scene.
  const result = computePosition({
    positionSec: 10,
    durationSec: 1000,
    storedMaxPositionSec: 990,
  });

  assert.strictEqual(result.percent, 99);
  assert.strictEqual(result.completed, true);
});

test("completion survives a heartbeat that lands after a seek to zero", () => {
  const result = computePosition({
    positionSec: 0,
    durationSec: 1000,
    storedMaxPositionSec: 0,
    previouslyCompleted: true,
  });

  assert.strictEqual(result.completed, true);
});

test("the catalogue duration stands in before loadedmetadata", () => {
  // The player has not reported a duration yet; without the fallback every
  // early heartbeat would record 0%.
  const result = computePosition({
    positionSec: 300,
    durationSec: 0,
    catalogueDurationMin: 10,
  });

  assert.strictEqual(result.duration, 600);
  assert.strictEqual(result.percent, 50);
});

test("an unknown duration yields 0% and not a division by zero", () => {
  const result = computePosition({ positionSec: 300, durationSec: 0 });

  assert.strictEqual(result.percent, 0);
  assert.strictEqual(result.completed, false);
});

test("95% counts as finished", () => {
  assert.strictEqual(computePosition({ positionSec: 950, durationSec: 1000 }).completed, true);
  assert.strictEqual(computePosition({ positionSec: 940, durationSec: 1000 }).completed, false);
});

// --- QoE --------------------------------------------------------------------

test("a heartbeat without QoE does not erase what was already measured", () => {
  // The regression this exists for: the final flush omitted the block and
  // wiped a session that had reported a slow start and two rebuffers.
  const stored = { startupMs: 850, rebufferCount: 2, rebufferSec: 3.5, qualityLabel: "1080p" };
  const merged = mergeQoe(stored, undefined);

  assert.strictEqual(merged.startupMs, 850);
  assert.strictEqual(merged.rebufferCount, 2);
  assert.strictEqual(merged.rebufferSec, 3.5);
  assert.strictEqual(merged.qualityLabel, "1080p");
});

test("QoE counters only ever climb", () => {
  const merged = mergeQoe(
    { rebufferCount: 5, rebufferSec: 10, errorCount: 2 },
    { rebufferCount: 3, rebufferSec: 4, errorCount: 0 }
  );

  assert.strictEqual(merged.rebufferCount, 5);
  assert.strictEqual(merged.rebufferSec, 10);
  assert.strictEqual(merged.errorCount, 2);
});

test("startup is measured once per session and never re-measured", () => {
  // A rebuffer late in the session must not be recorded as a slow start.
  assert.strictEqual(mergeQoe({ startupMs: 700 }, { startupMs: 9000 }).startupMs, 700);
  assert.strictEqual(mergeQoe({ startupMs: 0 }, { startupMs: 9000 }).startupMs, 9000);
});

test("absurd QoE values are clamped rather than trusted", () => {
  const q = sanitiseQoe({
    startupMs: 1e9,
    rebufferCount: 1e9,
    rebufferSec: 1e9,
    errorCount: -5,
    lastError: "x".repeat(500),
    qualitySwitches: 1e9,
  });

  assert.strictEqual(q.startupMs, 600000);
  assert.strictEqual(q.rebufferCount, 10000);
  assert.strictEqual(q.rebufferSec, 86400);
  assert.strictEqual(q.errorCount, 0);
  assert.strictEqual(q.lastError.length, 200);
  assert.strictEqual(q.qualitySwitches, 10000);
});

// --- genre keys -------------------------------------------------------------

test("genres that would break a dotted update path are rewritten or rejected", () => {
  // genrePreferences is a Map, so its keys become `genrePreferences.<key>`.
  assert.strictEqual(genreKey("Sci-Fi"), "Sci-Fi");
  assert.strictEqual(genreKey("Sci.Fi"), "Sci Fi");
  assert.strictEqual(genreKey("$where"), "where");
  assert.strictEqual(genreKey(""), null);
  assert.strictEqual(genreKey(null), null);
  assert.strictEqual(genreKey("   "), null);
  assert.strictEqual(genreKey("x".repeat(61)), null);
});
