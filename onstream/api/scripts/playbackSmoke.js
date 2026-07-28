#!/usr/bin/env node
//
// Live round-trip through playback telemetry:
//   heartbeat -> WatchSession + progress store + user rollups -> analytics read
//
//   node scripts/playbackSmoke.js
//   PLAYBACK_SMOKE_DB=my_scratch_db node scripts/playbackSmoke.js
//
// Runs against a THROWAWAY database on the configured cluster, named by
// PLAYBACK_SMOKE_DB (default below) and never the application's own. Fixtures
// are deleted on the way out; every delete is guarded on the connection name,
// so a misconfigured MONGO_URL aborts rather than touching real data.
//
// The idempotency checks are the ones that matter: heartbeats are fire-and-
// forget over a flaky connection, so a duplicated or reordered one has to
// converge. If those fail, every watch-time figure in the admin app is inflated.

require("../loadEnv")();

const assert = require("node:assert");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Movie = require("../models/Movie");
const TVShow = require("../models/TVShow");
const Season = require("../models/Season");
const Episode = require("../models/Episode");
const WatchSession = require("../models/WatchSession");
const TVProgress = require("../models/TVProgress");

const TEST_DB = process.env.PLAYBACK_SMOKE_DB || "nextream_playback_smoke";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const MODELS = [User, Movie, TVShow, Season, Episode, WatchSession, TVProgress];

let failures = 0;

function check(label, fn) {
  try {
    fn();
    console.log(`  ok   ${label}`);
  } catch (err) {
    failures++;
    console.log(` FAIL  ${label}\n        ${err.message}`);
  }
}

// Atlas denies dropDatabase to an ordinary user, so teardown is plain deletes.
async function wipe() {
  assert.strictEqual(
    mongoose.connection.name,
    TEST_DB,
    `refusing to delete: connected to "${mongoose.connection.name}", not "${TEST_DB}"`
  );
  await Promise.all(MODELS.map((model) => model.deleteMany({})));
}

async function main() {
  await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    dbName: TEST_DB,
  });
  await wipe();
  console.log(`throwaway db: ${mongoose.connection.name}\n`);

  const user = await User.create({
    username: `smoke-${Date.now()}`,
    email: `smoke-${Date.now()}@example.invalid`,
    password: "x",
  });
  const movie = await Movie.create({
    title: `Smoke Movie ${Date.now()}`,
    genre: "Sci-Fi",
  });
  const show = await TVShow.create({
    title: `Smoke Show ${Date.now()}`,
    genres: ["Drama"],
    published: true,
  });
  const season = await Season.create({ showId: show._id, seasonNumber: 1, published: true });
  const episode = await Episode.create({
    showId: show._id,
    seasonId: season._id,
    seasonNumber: 1,
    episodeNumber: 1,
    title: "Pilot",
    duration: 45,
    published: true,
  });

  const token = `Bearer ${jwt.sign(
    { id: String(user._id), isAdmin: true },
    process.env.SECRET_KEY,
    { expiresIn: "10m" }
  )}`;

  const app = express();
  app.use(express.json());
  app.use("/api/playback", require("../routes/playback"));
  app.use("/api/users", require("../routes/users"));
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const post = (url, body) =>
    fetch(base + url, {
      method: "POST",
      headers: { "Content-Type": "application/json", token, "User-Agent": UA },
      body: JSON.stringify(body),
    }).then(async (res) => ({ status: res.status, body: await res.json() }));

  const get = (url) =>
    fetch(base + url, { headers: { token, "User-Agent": UA } }).then(async (res) => ({
      status: res.status,
      body: await res.json(),
    }));

  const beat = (body) =>
    post("/api/playback/heartbeat", {
      sessionId: "smoke-movie",
      contentType: "movie",
      contentId: String(movie._id),
      ...body,
    });

  console.log("movie heartbeats");
  const first = await beat({ positionSec: 30, durationSec: 6000, secondsWatched: 30 });
  check("first heartbeat accepted", () => assert.strictEqual(first.status, 200));
  check("counts one view", () => assert.strictEqual(first.body.countedView, true));

  const second = await beat({ positionSec: 90, durationSec: 6000, secondsWatched: 90 });
  check("does not re-count the view", () => assert.strictEqual(second.body.countedView, false));

  const replay = await beat({ positionSec: 90, durationSec: 6000, secondsWatched: 30 });
  check("a stale replay does not move the total", () =>
    assert.strictEqual(replay.body.secondsWatched, 90)
  );

  let fresh = await User.findById(user._id).lean();
  check("rollup equals the session total, not the sum of pings", () =>
    assert.strictEqual(fresh.totalWatchTime, 90)
  );
  check("genre counted once per session", () =>
    assert.strictEqual(fresh.genrePreferences["Sci-Fi"], 1)
  );
  check("continue-watching entry created", () =>
    assert.strictEqual(fresh.currentlyWatching.length, 1)
  );
  check("continue-watching time matches", () =>
    assert.strictEqual(fresh.currentlyWatching[0].watchTime, 90)
  );
  const seenMovie = await Movie.findById(movie._id).lean();
  check("movie.views === 1", () => assert.strictEqual(seenMovie.views, 1));

  console.log("\ncompletion");
  const done = await beat({ positionSec: 5900, durationSec: 6000, secondsWatched: 400 });
  check("completes past 95%", () => assert.strictEqual(done.body.completed, true));

  fresh = await User.findById(user._id).lean();
  check("removed from continue-watching", () =>
    assert.strictEqual(fresh.currentlyWatching.length, 0)
  );
  check("added to watch history", () => assert.strictEqual(fresh.watchHistory.length, 1));

  const rewind = await beat({ positionSec: 10, durationSec: 6000, secondsWatched: 420 });
  check("scrubbing back does not un-complete", () =>
    assert.strictEqual(rewind.body.completed, true)
  );

  console.log("\nepisode heartbeats");
  const ep = await post("/api/playback/heartbeat", {
    sessionId: "smoke-episode",
    contentType: "episode",
    contentId: String(episode._id),
    positionSec: 600,
    durationSec: 2700,
    secondsWatched: 600,
    qoe: { startupMs: 850, rebufferCount: 2, rebufferSec: 3.5, qualityLabel: "1080p" },
  });
  check("episode heartbeat accepted", () => assert.strictEqual(ep.status, 200));
  check("percent computed", () => assert.strictEqual(ep.body.percent, 22));

  const progress = await TVProgress.findOne({ userId: user._id, episodeId: episode._id }).lean();
  check("TVProgress row written", () => assert.ok(progress && progress.positionSec === 600));

  // Sent without a qoe block: the merge must not wipe what the first reported.
  await post("/api/playback/heartbeat", {
    sessionId: "smoke-episode",
    contentType: "episode",
    contentId: String(episode._id),
    positionSec: 900,
    durationSec: 2700,
    secondsWatched: 900,
  });
  const seenShow = await TVShow.findById(show._id).lean();
  check("show view counted exactly once", () => assert.strictEqual(seenShow.views, 1));

  console.log("\nvalidation");
  const missing = await post("/api/playback/heartbeat", {
    sessionId: "smoke-x",
    contentType: "movie",
    contentId: "6512aa000000000000000000",
  });
  check("unknown content is 404", () => assert.strictEqual(missing.status, 404));

  const noId = await post("/api/playback/heartbeat", {
    contentType: "movie",
    contentId: String(movie._id),
  });
  check("missing sessionId is 400", () => assert.strictEqual(noId.status, 400));

  const liar = await post("/api/playback/heartbeat", {
    sessionId: "smoke-liar",
    contentType: "movie",
    contentId: String(movie._id),
    positionSec: 10,
    durationSec: 6000,
    secondsWatched: 999999,
  });
  check("an impossible total is clamped", () =>
    assert.ok(liar.body.secondsWatched <= 130, `got ${liar.body.secondsWatched}`)
  );

  console.log("\nresume");
  const resume = await get(`/api/playback/resume/episode/${episode._id}`);
  check("episode resumes at the stored position", () =>
    assert.strictEqual(resume.body.positionSec, 900)
  );

  console.log("\nanalytics");
  const analytics = await get(`/api/users/${user._id}/analytics?days=30&tz=UTC`);
  const data = analytics.body;
  check("analytics 200", () => assert.strictEqual(analytics.status, 200));
  check("sessions counted", () => assert.strictEqual(data.totals.sessions, 3));
  check("distinct titles counted", () => assert.strictEqual(data.totals.titlesStarted, 2));
  check("activity series is dense", () => assert.strictEqual(data.activity.length, 30));
  check("hourly series is 24 long", () => assert.strictEqual(data.hourly.length, 24));
  check("genres split by watch time", () =>
    assert.deepStrictEqual(data.topGenres.map((row) => row.genre).sort(), ["Drama", "Sci-Fi"])
  );
  check("device bucketed from the User-Agent", () =>
    assert.strictEqual(data.devices[0].label, "Chrome on macOS")
  );
  check("QoE survives a heartbeat that omitted it", () =>
    assert.strictEqual(data.qoe.avgStartupMs, 850)
  );
  check("TV summary populated", () => assert.strictEqual(data.tv.episodesStarted, 1));
  const sessions = await WatchSession.countDocuments({ userId: user._id });
  check("one row per session, not per heartbeat", () => assert.strictEqual(sessions, 3));

  console.log("\nauthorisation");
  const stranger = `Bearer ${jwt.sign(
    { id: String(new mongoose.Types.ObjectId()), isAdmin: false },
    process.env.SECRET_KEY,
    { expiresIn: "10m" }
  )}`;
  const forbidden = await fetch(`${base}/api/users/${user._id}/analytics`, {
    headers: { token: stranger },
  });
  check("a non-admin cannot read another user's analytics", () =>
    assert.strictEqual(forbidden.status, 403)
  );

  server.close();
}

main()
  .catch((err) => {
    failures++;
    console.error("\nERROR:", err.message);
  })
  .then(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await wipe();
        console.log(`\ncleaned up ${TEST_DB}`);
      }
    } catch (err) {
      console.error("cleanup failed:", err.message);
    }
    await mongoose.disconnect().catch(() => {});
    console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
    process.exit(failures ? 1 : 0);
  });
