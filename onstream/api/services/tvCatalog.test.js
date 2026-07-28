const test = require("node:test");
const assert = require("node:assert");

const {
  COMPLETE_PERCENT,
  computeNextUp,
  computeProgressUpdate,
  genreFilter,
  withProgress,
} = require("./tvCatalog");

// The two rules the series section is actually built on — "where do I land when
// I press play" and "how much of this have I seen" — decided without a database
// so they can be pinned cheaply.

function episode(seasonNumber, episodeNumber) {
  return {
    _id: `s${seasonNumber}e${episodeNumber}`,
    seasonNumber,
    episodeNumber,
    title: `S${seasonNumber}E${episodeNumber}`,
  };
}

// Ordered exactly as orderedEpisodes returns them: season, then episode.
const SERIES = [
  episode(1, 1),
  episode(1, 2),
  episode(1, 3),
  episode(2, 1),
  episode(2, 2),
];

/**
 * Builds the Map computeNextUp expects.
 *
 * `watchedAt` is a minute offset from a fixed instant so the *ordering* between
 * rows is stated outright — next-up keys off recency, and inferring it from any
 * other field is how a test ends up asserting the wrong thing.
 */
function progress(entries) {
  return new Map(
    entries.map(([id, row]) => [
      id,
      {
        watchedAt: new Date(Date.UTC(2026, 0, 1, 0, row.watchedAt ?? 0)),
        percent: row.percent,
        positionSec: row.position ?? 0,
        completed: row.completed,
      },
    ])
  );
}

test("a viewer with no history starts at the first episode", () => {
  const next = computeNextUp(SERIES, new Map());
  assert.strictEqual(next.reason, "start");
  assert.strictEqual(next.episode._id, "s1e1");
  assert.strictEqual(next.resumeSec, 0);
});

test("a part-watched episode is resumed at its position", () => {
  const next = computeNextUp(
    SERIES,
    progress([["s1e2", { position: 640, percent: 42, completed: false }]])
  );
  assert.strictEqual(next.reason, "resume");
  assert.strictEqual(next.episode._id, "s1e2");
  assert.strictEqual(next.resumeSec, 640);
});

test("a finished episode advances to the next one", () => {
  const next = computeNextUp(
    SERIES,
    progress([["s1e2", { position: 1400, percent: 100, completed: true }]])
  );
  assert.strictEqual(next.reason, "next");
  assert.strictEqual(next.episode._id, "s1e3");
  assert.strictEqual(next.resumeSec, 0);
});

test("next-up crosses a season boundary", () => {
  const next = computeNextUp(
    SERIES,
    progress([["s1e3", { position: 1400, percent: 100, completed: true }]])
  );
  assert.strictEqual(next.episode._id, "s2e1");
  assert.strictEqual(next.episode.seasonNumber, 2);
});

test("the newest activity wins, not the highest episode number", () => {
  // Finished the finale last week, then went back and started S1E1 today.
  const next = computeNextUp(
    SERIES,
    progress([
      ["s2e2", { watchedAt: 0, position: 1400, percent: 100, completed: true }],
      ["s1e1", { watchedAt: 45, position: 120, percent: 8, completed: false }],
    ])
  );
  assert.strictEqual(next.reason, "resume");
  assert.strictEqual(next.episode._id, "s1e1");
});

test("finishing the last published episode reports rewatch, not a crash", () => {
  // getContinueWatching drops shows in this state, so the row does not keep
  // offering a series the viewer has already completed.
  const next = computeNextUp(
    SERIES,
    progress([["s2e2", { position: 1400, percent: 100, completed: true }]])
  );
  assert.strictEqual(next.reason, "rewatch");
  assert.strictEqual(next.episode._id, "s1e1");
});

test("a show with no published episodes has no next-up", () => {
  assert.strictEqual(computeNextUp([], new Map()), null);
  assert.strictEqual(computeNextUp(undefined, new Map()), null);
});

test("percent is derived from the player's reported duration", () => {
  const update = computeProgressUpdate({ positionSec: 300, durationSec: 1200 });
  assert.strictEqual(update.percent, 25);
  assert.strictEqual(update.durationSec, 1200);
  assert.strictEqual(update.completed, false);
});

test("a ping before loadedmetadata falls back to the catalogue runtime", () => {
  // Episode.duration is authored in minutes; 22 minutes is 1320 seconds.
  const update = computeProgressUpdate({
    positionSec: 660,
    durationSec: 0,
    catalogueDurationMin: 22,
  });
  assert.strictEqual(update.durationSec, 1320);
  assert.strictEqual(update.percent, 50);
});

test("with no duration from either source, percent stays 0 rather than NaN", () => {
  const update = computeProgressUpdate({ positionSec: 90 });
  assert.strictEqual(update.percent, 0);
  assert.strictEqual(update.completed, false);
  assert.strictEqual(update.positionSec, 90);
});

test("crossing the completion threshold marks the episode watched", () => {
  const update = computeProgressUpdate({
    positionSec: COMPLETE_PERCENT * 12,
    durationSec: 1200,
  });
  assert.strictEqual(update.percent, COMPLETE_PERCENT);
  assert.strictEqual(update.completed, true);
});

test("completed never unlatches when the viewer scrubs back", () => {
  const update = computeProgressUpdate({
    positionSec: 30,
    durationSec: 1200,
    previouslyCompleted: true,
  });
  assert.strictEqual(update.percent, 3);
  assert.strictEqual(update.completed, true);
});

test("the player can declare completion explicitly", () => {
  const update = computeProgressUpdate({
    positionSec: 1100,
    durationSec: 1200,
    completedFlag: true,
  });
  assert.strictEqual(update.completed, true);
});

test("negative and non-numeric positions are clamped, not stored", () => {
  assert.strictEqual(computeProgressUpdate({ positionSec: -50 }).positionSec, 0);
  assert.strictEqual(computeProgressUpdate({ positionSec: "abc" }).positionSec, 0);
});

test("withProgress attaches the viewer's row and nulls the rest", () => {
  const decorated = withProgress(SERIES.slice(0, 2), progress([
    ["s1e1", { position: 900, percent: 99, completed: true }],
  ]));

  assert.strictEqual(decorated[0].progress.completed, true);
  assert.strictEqual(decorated[0].progress.positionSec, 900);
  assert.strictEqual(decorated[1].progress, null);
});

test("withProgress treats a row past the threshold as complete without the flag", () => {
  const [decorated] = withProgress([episode(1, 1)], progress([
    ["s1e1", { position: 900, percent: 97, completed: false }],
  ]));
  assert.strictEqual(decorated.progress.completed, true);
});

test("genre filtering is case-insensitive and anchored", () => {
  // Admin authors "Comedy"; the URL carries "comedy".
  const filter = genreFilter("comedy");
  assert.strictEqual(filter.$elemMatch.$options, "i");
  assert.strictEqual(filter.$elemMatch.$regex, "^comedy$");

  // Anchoring matters: without it "drama" would also match "Docudrama".
  assert.ok(new RegExp(filter.$elemMatch.$regex, "i").test("Comedy"));
  assert.ok(!new RegExp(genreFilter("drama").$elemMatch.$regex, "i").test("Docudrama"));
});

test("regex metacharacters in a genre are escaped, not interpreted", () => {
  const filter = genreFilter("sci-fi (.*)");
  assert.ok(!new RegExp(filter.$elemMatch.$regex, "i").test("sci-fi anything"));
  assert.ok(new RegExp(filter.$elemMatch.$regex, "i").test("sci-fi (.*)"));
});
