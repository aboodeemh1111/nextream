const test = require("node:test");
const assert = require("node:assert");

const { fillDays, dateKey, pct } = require("./userAnalytics");

// The profile page draws an activity chart straight from fillDays. Everything
// here is about the two ways that chart lies: a gap the viewer never watched
// on being drawn as a slope between two real days, and a day going missing or
// doubling because the window crossed a DST boundary.

/** Matches the shape $group emits: _id is the YYYY-MM-DD key. */
function day(id, watchSeconds, sessions) {
  return { _id: id, watchSeconds, sessions };
}

test("emits one bucket per calendar day, inclusive of both ends", () => {
  const series = fillDays([], new Date("2026-03-01T12:00:00Z"), new Date("2026-03-05T12:00:00Z"), "UTC");

  assert.deepStrictEqual(
    series.map((row) => row.date),
    ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"]
  );
});

test("zero-fills days with no sessions rather than omitting them", () => {
  const series = fillDays(
    [day("2026-03-01", 600, 2), day("2026-03-04", 300, 1)],
    new Date("2026-03-01T00:00:00Z"),
    new Date("2026-03-04T23:59:59Z"),
    "UTC"
  );

  assert.deepStrictEqual(series, [
    { date: "2026-03-01", watchSeconds: 600, sessions: 2 },
    { date: "2026-03-02", watchSeconds: 0, sessions: 0 },
    { date: "2026-03-03", watchSeconds: 0, sessions: 0 },
    { date: "2026-03-04", watchSeconds: 300, sessions: 1 },
  ]);
});

test("a single-day window yields exactly one bucket", () => {
  const series = fillDays([], new Date("2026-03-01T08:00:00Z"), new Date("2026-03-01T20:00:00Z"), "UTC");

  assert.strictEqual(series.length, 1);
  assert.strictEqual(series[0].date, "2026-03-01");
});

// 8 March 2026 is the US spring-forward date: that local day is 23 hours long.
// Stepping the real instants by +24h skips 9 March entirely.
test("does not skip a day across a spring-forward boundary", () => {
  const series = fillDays(
    [],
    new Date("2026-03-07T12:00:00Z"),
    new Date("2026-03-11T12:00:00Z"),
    "America/New_York"
  );

  assert.deepStrictEqual(
    series.map((row) => row.date),
    ["2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10", "2026-03-11"]
  );
});

// 1 November 2026 is the US fall-back date: that local day is 25 hours long,
// so +24h steps land on it twice.
test("does not repeat a day across a fall-back boundary", () => {
  const series = fillDays(
    [],
    new Date("2026-10-31T12:00:00Z"),
    new Date("2026-11-03T12:00:00Z"),
    "America/New_York"
  );

  assert.deepStrictEqual(
    series.map((row) => row.date),
    ["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"]
  );
});

test("buckets by the requested zone, not the server's", () => {
  // 21:00 UTC on 1 March is already 2 March in Tokyo (+09:00). The window has
  // to start on the local day, or the viewer's evening lands in yesterday.
  const instant = new Date("2026-03-01T21:00:00Z");

  assert.strictEqual(dateKey(instant, "UTC"), "2026-03-01");
  assert.strictEqual(dateKey(instant, "Asia/Tokyo"), "2026-03-02");
  assert.strictEqual(fillDays([], instant, instant, "Asia/Tokyo")[0].date, "2026-03-02");
});

test("percentages guard against a zero denominator", () => {
  // An empty profile divides by zero everywhere; NaN reaches the page as a
  // blank stat tile that reads as a bug rather than as "no data yet".
  assert.strictEqual(pct(0, 0), 0);
  assert.strictEqual(pct(5, 0), 0);
  assert.strictEqual(pct(1, 3), 33.3);
  assert.strictEqual(pct(1, 2), 50);
});
