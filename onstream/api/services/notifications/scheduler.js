const mongoose = require("mongoose");
const Episode = require("../../models/Episode");
const Movie = require("../../models/Movie");
const Notification = require("../../models/Notification");
const TVProgress = require("../../models/TVProgress");
const TVShow = require("../../models/TVShow");
const User = require("../../models/User");
const WatchSession = require("../../models/WatchSession");
const audience = require("./audience");
const dispatch = require("./dispatch");
const policy = require("./policy");

/**
 * The background half of the notification system.
 *
 * Three jobs, none of which can be done from a request:
 *
 *   **drainDeferred** — pushes that quiet hours or the spacing rule held back.
 *   Every one is re-judged at the moment it comes due rather than sent blindly,
 *   because a deferral can be eight hours old and everything it was waiting on
 *   may have changed. Without the re-check, quiet hours would not prevent an
 *   interruption so much as postpone it into a single 8am burst.
 *
 *   **sendReminders** — the "you started this and stopped" nudges. These are the
 *   only notifications with no triggering event at all: the signal *is* the
 *   absence of activity, so nothing but a sweep can find them.
 *
 *   **sendDigests** — the weekly summary for viewers who chose one message a
 *   week over alerts as things happen. Sent when it is morning where the viewer
 *   is, which is the only reason this needs to run more often than weekly.
 *
 * Deliberately an interval in the API process rather than a queue or a cron
 * container. This deployment is a single Node process behind Render; adding
 * Redis and a worker to send a few thousand notifications a week would be
 * infrastructure with no corresponding problem. What that costs is stated
 * plainly: with two API instances both would sweep, so every job here is
 * idempotent through the same dedupe keys that protect the request path, and
 * `NOTIFY_SCHEDULER=false` turns it off on the instances that should not run it.
 */

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const INTERVALS = {
  /** Deferred pushes are time-critical: a 10-minute lag is a 10-minute lag. */
  deferred: Number(process.env.NOTIFY_DEFERRED_INTERVAL_MS) || 2 * MINUTE_MS,
  /** Reminders and digests are not, and both scan broadly. */
  sweep: Number(process.env.NOTIFY_SWEEP_INTERVAL_MS) || 60 * MINUTE_MS,
};

const LIMITS = {
  deferredPerPass: 500,
  progressRows: 3_000,
  movieSessions: 3_000,
  /** Reminders one viewer can receive from a single sweep. */
  remindersPerUser: 1,
  digestUsers: 2_000,
  digestItems: 6,
};

/** A title is worth a nudge once it has been idle this long, and not before. */
const REMIND_AFTER_DAYS = 3;
/** Past this it is abandoned, and a reminder reads as the app being confused. */
const REMIND_BEFORE_DAYS = 21;
/** Below this they never really started; above it they effectively finished. */
const REMIND_PERCENT = { min: 5, max: 90 };

/** At or under this many episodes left in a season, finishing is one sitting. */
const FINISH_NUDGE_MAX_REMAINING = 2;

/** Digests go out on Monday morning, local time. */
const DIGEST_WEEKDAY = 1; // 1 = Monday, matching Date#getUTCDay
const DIGEST_HOUR = { from: 8, to: 12 };

/** How far back a digest looks for things to mention. */
const DIGEST_WINDOW_DAYS = 7;

let timers = [];
const running = new Set();

function objectId(value) {
  return mongoose.isValidObjectId(String(value)) ? new mongoose.Types.ObjectId(String(value)) : null;
}

/**
 * Runs a job unless it is already running.
 *
 * A sweep that takes longer than its interval would otherwise start overlapping
 * itself, and two concurrent passes over the same rows is how a "once a week"
 * reminder becomes two.
 */
async function once(name, work) {
  if (running.has(name)) return null;
  running.add(name);
  try {
    return await work();
  } catch (err) {
    console.error(`NOTIFY_SCHEDULER_${name}_FAILED:`, err?.message || err);
    return null;
  } finally {
    running.delete(name);
  }
}

// --- deferred pushes ---------------------------------------------------------

/**
 * Sends the pushes whose hold has expired, re-deciding each one first.
 *
 * The re-decision is the whole value of this job. A viewer who switched the
 * category off overnight gets nothing; one who has since had their fill of
 * pushes is capped; one who is now inside a *new* quiet window is deferred
 * again — and one whose message has stopped being news is dropped, which is what
 * `reconsiderDeferred` uses `deferredAt` for.
 */
async function drainDeferred(now = new Date()) {
  const due = await Notification.find({
    "delivery.push": "deferred",
    "delivery.deferUntil": { $lte: now },
  })
    .sort({ "delivery.deferUntil": 1 })
    .limit(LIMITS.deferredPerPass)
    .lean();

  if (!due.length) return { considered: 0, sent: 0, dropped: 0, redeferred: 0 };

  const userIds = [...new Set(due.map((row) => String(row.userId)))];
  const { byUser, counters } = await dispatch.loadContext(userIds);

  const operations = [];
  const ready = [];
  let dropped = 0;
  let redeferred = 0;

  for (const row of due) {
    const context = byUser.get(String(row.userId));
    if (!context) {
      operations.push(setPush(row._id, "suppressed", { suppressedBy: "no_user" }));
      dropped += 1;
      continue;
    }

    const decision = policy.reconsiderDeferred({
      entry: row,
      preferences: context.preferences,
      stats: counters.get(String(row.userId)),
      now,
      hasDevices: context.tokens.length > 0,
      // `updatedAt` is when the row was last written, which for a row that has
      // only ever been deferred is when it was deferred.
      deferredAt: row.createdAt,
    });

    if (decision.push?.state === "pending") {
      ready.push({ ...row, delivery: { ...row.delivery, push: "pending" } });
      continue;
    }
    if (decision.push?.state === "deferred") {
      operations.push(setPush(row._id, "deferred", { deferUntil: decision.push.deferUntil }));
      redeferred += 1;
      continue;
    }
    operations.push(
      setPush(row._id, "suppressed", { suppressedBy: decision.push?.suppressedBy || decision.rule })
    );
    dropped += 1;
  }

  if (operations.length) {
    await Notification.bulkWrite(operations, { ordered: false }).catch((err) =>
      console.error("NOTIFY_DEFERRED_WRITE_FAILED:", err.message)
    );
  }

  // Flip the rows we are about to send, so a crash between here and the send
  // leaves them retryable rather than stuck as `deferred` forever.
  if (ready.length) {
    await Notification.updateMany(
      { _id: { $in: ready.map((row) => row._id) } },
      { $set: { "delivery.push": "pending", "delivery.deferUntil": null } }
    );
  }

  const result = await dispatch.deliverPush(ready, { context: byUser, counters, now });
  return { considered: due.length, sent: result.pushed, dropped, redeferred };
}

function setPush(id, state, extra = {}) {
  return {
    updateOne: {
      filter: { _id: id },
      update: {
        $set: {
          "delivery.push": state,
          "delivery.deferUntil": extra.deferUntil || null,
          ...(extra.suppressedBy ? { "delivery.suppressedBy": extra.suppressedBy } : {}),
        },
      },
    },
  };
}

// --- continue-watching reminders --------------------------------------------

/**
 * Unfinished episodes, stale enough to have been forgotten.
 *
 * Windowed on both sides: something paused an hour ago is not forgotten, and
 * something paused two months ago was abandoned on purpose. What is left is the
 * band where a nudge is a favour rather than a nag.
 */
async function staleEpisodes(now) {
  const rows = await TVProgress.find({
    completed: false,
    watchedAt: {
      $lte: new Date(now.getTime() - REMIND_AFTER_DAYS * DAY_MS),
      $gte: new Date(now.getTime() - REMIND_BEFORE_DAYS * DAY_MS),
    },
    percent: { $gte: REMIND_PERCENT.min, $lte: REMIND_PERCENT.max },
  })
    .sort({ watchedAt: -1 })
    .limit(LIMITS.progressRows)
    .lean();

  return rows;
}

/** The same band, for movies. Sessions hold the position; the User document does not. */
async function staleMovies(now) {
  return WatchSession.find({
    contentType: "movie",
    completed: false,
    startedAt: {
      $lte: new Date(now.getTime() - REMIND_AFTER_DAYS * DAY_MS),
      $gte: new Date(now.getTime() - REMIND_BEFORE_DAYS * DAY_MS),
    },
    percent: { $gte: REMIND_PERCENT.min, $lte: REMIND_PERCENT.max },
  })
    .select("userId contentId title percent startedAt")
    .sort({ startedAt: -1 })
    .limit(LIMITS.movieSessions)
    .lean();
}

/**
 * How many published episodes of a viewer's current season they have left.
 *
 * The distinction that makes `finish.nudge` worth having: "3 episodes left in
 * Season 2" is a plan for an evening, where "still watching?" is a question.
 * Counted against *published* episodes only — `episodesCount` on the show
 * includes drafts, so trusting it would promise episodes that do not exist.
 */
async function seasonRemaining(rows) {
  const seasonIds = [...new Set(rows.map((row) => String(row.seasonId)))].map(objectId).filter(Boolean);
  if (!seasonIds.length) return new Map();

  const [episodes, progress] = await Promise.all([
    Episode.find({ seasonId: { $in: seasonIds }, published: true })
      .select("_id seasonId showId seasonNumber episodeNumber title stillPath")
      .lean(),
    TVProgress.find({
      userId: { $in: [...new Set(rows.map((row) => objectId(row.userId)))].filter(Boolean) },
      seasonId: { $in: seasonIds },
    })
      .select("userId seasonId episodeId completed")
      .lean(),
  ]);

  const bySeason = new Map();
  for (const episode of episodes) {
    const key = String(episode.seasonId);
    if (!bySeason.has(key)) bySeason.set(key, []);
    bySeason.get(key).push(episode);
  }
  for (const list of bySeason.values()) {
    list.sort((a, b) => a.episodeNumber - b.episodeNumber);
  }

  const doneByUserSeason = new Map();
  for (const row of progress) {
    if (!row.completed) continue;
    const key = `${row.userId}:${row.seasonId}`;
    if (!doneByUserSeason.has(key)) doneByUserSeason.set(key, new Set());
    doneByUserSeason.get(key).add(String(row.episodeId));
  }

  const out = new Map();
  for (const row of rows) {
    const key = `${row.userId}:${row.seasonId}`;
    const all = bySeason.get(String(row.seasonId)) || [];
    if (!all.length) continue;

    const done = doneByUserSeason.get(key) || new Set();
    const remaining = all.filter((episode) => !done.has(String(episode._id)));
    out.set(key, { remaining, next: remaining[0] || null, total: all.length });
  }
  return out;
}

/**
 * One sweep of reminders.
 *
 * At most `remindersPerUser` per viewer per pass, chosen as the most recently
 * touched title. Without that cap someone who sampled ten things in a fortnight
 * gets ten reminders in one minute, which is the failure this job would
 * otherwise introduce all by itself.
 */
async function sendReminders(now = new Date()) {
  const [episodeRows, movieRows] = await Promise.all([staleEpisodes(now), staleMovies(now)]);
  if (!episodeRows.length && !movieRows.length) {
    return { episodes: 0, movies: 0, finishes: 0 };
  }

  const remainingByKey = await seasonRemaining(episodeRows);

  const showIds = [...new Set(episodeRows.map((row) => String(row.showId)))].map(objectId).filter(Boolean);
  const movieIds = [...new Set(movieRows.map((row) => String(row.contentId)))].map(objectId).filter(Boolean);

  const [shows, movies] = await Promise.all([
    showIds.length
      ? TVShow.find({ _id: { $in: showIds }, published: true })
          .select("_id title poster backdrop")
          .lean()
      : [],
    movieIds.length
      ? Movie.find({ _id: { $in: movieIds } }).select("_id title img imgSm").lean()
      : [],
  ]);
  const showById = new Map(shows.map((show) => [String(show._id), show]));
  const movieById = new Map(movies.map((movie) => [String(movie._id), movie]));

  /** userId -> the single best candidate for this pass. */
  const chosen = new Map();

  // Episodes first, and finish-nudges preferred over plain reminders: being told
  // "2 left" is strictly more useful than being asked "still watching?".
  for (const row of episodeRows) {
    const userId = String(row.userId);
    if (chosen.size >= dispatch.MAX_RECIPIENTS) break;
    const show = showById.get(String(row.showId));
    if (!show) continue;

    const season = remainingByKey.get(`${row.userId}:${row.seasonId}`);
    const remaining = season?.remaining?.length || 0;

    if (season?.next && remaining > 0 && remaining <= FINISH_NUDGE_MAX_REMAINING) {
      chosen.set(userId, {
        kind: "finish",
        userId,
        at: row.watchedAt,
        ctx: {
          show,
          episode: season.next,
          remaining,
          seasonNumber: row.seasonNumber,
        },
      });
      continue;
    }

    const existing = chosen.get(userId);
    if (existing && (existing.kind === "finish" || new Date(existing.at) >= new Date(row.watchedAt))) {
      continue;
    }
    chosen.set(userId, {
      kind: "episode",
      userId,
      at: row.watchedAt,
      ctx: {
        entityTitle: show.title,
        entityKind: "show",
        entityId: String(show._id),
        deepLink: `/watch/episode/${row.episodeId}`,
        image: show.backdrop || show.poster,
        percent: row.percent,
        episodeCode: `S${row.seasonNumber}:E${row.episodeNumber}`,
      },
    });
  }

  for (const row of movieRows) {
    const userId = String(row.userId);
    if (chosen.has(userId)) continue;
    const movie = movieById.get(String(row.contentId));
    if (!movie) continue;

    chosen.set(userId, {
      kind: "movie",
      userId,
      at: row.startedAt,
      ctx: {
        entityTitle: movie.title,
        entityKind: "movie",
        entityId: String(movie._id),
        deepLink: `/watch/${movie._id}`,
        image: movie.img || movie.imgSm,
        percent: row.percent,
      },
    });
  }

  // Grouped by type so each shape is one dispatch rather than one per viewer —
  // the whole point of dispatch taking a recipient list.
  const groups = { finish: [], episode: [], movie: [] };
  for (const entry of chosen.values()) groups[entry.kind].push(entry);

  const counts = { episodes: 0, movies: 0, finishes: 0 };

  for (const entry of groups.finish) {
    const result = await dispatch.dispatch(
      "finish.nudge",
      [{ userId: entry.userId, score: 1, reason: "" }],
      entry.ctx,
      { now }
    );
    counts.finishes += result.created;
  }
  for (const entry of [...groups.episode, ...groups.movie]) {
    const result = await dispatch.dispatch(
      "continue.reminder",
      [{ userId: entry.userId, score: 1, reason: "" }],
      entry.ctx,
      { now }
    );
    if (entry.kind === "movie") counts.movies += result.created;
    else counts.episodes += result.created;
  }

  return counts;
}

// --- weekly digest -----------------------------------------------------------

/**
 * Is it digest o'clock where this viewer is?
 *
 * Monday morning in their own timezone. Running the sweep hourly and checking
 * the local clock is what makes "Monday morning" mean Monday morning for
 * everybody rather than for whichever timezone the server happens to be in.
 */
function isDigestWindow(now, timezone) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(now);
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  if (days[weekday] !== DIGEST_WEEKDAY) return false;

  const hour = Math.floor(policy.localMinutes(now, timezone) / 60);
  return hour >= DIGEST_HOUR.from && hour < DIGEST_HOUR.to;
}

/**
 * The week's new titles, once, for everybody.
 *
 * Loaded outside the per-viewer loop: the catalogue is the same for all of them
 * and only the ranking differs, so this is two queries for the whole run rather
 * than two per recipient.
 */
async function digestCandidates(now) {
  const since = new Date(now.getTime() - DIGEST_WINDOW_DAYS * DAY_MS);

  const [movies, shows] = await Promise.all([
    Movie.find({ createdAt: { $gte: since } })
      .select("_id title genre img imgSm createdAt")
      .sort({ createdAt: -1 })
      .limit(60)
      .lean(),
    TVShow.find({ published: true, createdAt: { $gte: since } })
      .select("_id title genres poster backdrop createdAt")
      .sort({ createdAt: -1 })
      .limit(60)
      .lean(),
  ]);

  return [
    ...movies.map((movie) => ({
      title: movie.title,
      genres: movie.genre ? [movie.genre] : [],
      image: movie.img || movie.imgSm || "",
    })),
    ...shows.map((show) => ({
      title: show.title,
      genres: show.genres || [],
      image: show.backdrop || show.poster || "",
    })),
  ];
}

/**
 * Sends the weekly roundup to whoever asked for one and is due.
 *
 * Ordered per viewer by taste, so two people receive the same week's catalogue
 * described by the three titles each is most likely to open. A viewer with no
 * matching titles gets nothing rather than a digest of things they will ignore —
 * an empty week is not worth a send.
 */
async function sendDigests(now = new Date()) {
  const subscribers = await User.find({ "notificationPrefs.digest": true })
    .select("_id notificationPrefs")
    .limit(LIMITS.digestUsers)
    .lean();
  if (!subscribers.length) return { sent: 0, due: 0 };

  const due = subscribers.filter((user) =>
    isDigestWindow(now, policy.resolvePreferences(user.notificationPrefs).timezone)
  );
  if (!due.length) return { sent: 0, due: 0 };

  const candidates = await digestCandidates(now);
  if (!candidates.length) return { sent: 0, due: due.length };

  const vectors = await audience.loadTaste({ now, userIds: due.map((user) => String(user._id)) });

  let sent = 0;
  for (const user of due) {
    const taste = vectors.get(String(user._id));

    const ranked = candidates
      .map((item) => ({ item, score: audience.affinity(item.genres, taste) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, LIMITS.digestItems)
      .map((row) => row.item);

    const result = await dispatch.dispatch(
      "digest.weekly",
      [{ userId: String(user._id), score: 1, reason: "" }],
      { items: ranked },
      { now }
    );
    sent += result.created;
  }

  return { sent, due: due.length };
}

// --- lifecycle ---------------------------------------------------------------

/** One pass of everything. Exported so it can be triggered by hand. */
async function runAll(now = new Date()) {
  return {
    deferred: await once("DEFERRED", () => drainDeferred(now)),
    reminders: await once("REMINDERS", () => sendReminders(now)),
    digests: await once("DIGESTS", () => sendDigests(now)),
  };
}

/**
 * Starts the intervals.
 *
 * Off by default in tests and wherever `NOTIFY_SCHEDULER=false`, and always off
 * when notifications are disabled outright. Both timers are unref'd, so a
 * scheduled sweep can never be the reason a process refuses to exit.
 */
function start() {
  if (timers.length) return false;
  if (process.env.NOTIFICATIONS_DISABLED === "true") return false;
  if (process.env.NOTIFY_SCHEDULER === "false") return false;

  const add = (interval, work) => {
    const timer = setInterval(work, interval);
    if (typeof timer.unref === "function") timer.unref();
    timers.push(timer);
  };

  add(INTERVALS.deferred, () => once("DEFERRED", () => drainDeferred(new Date())));
  add(INTERVALS.sweep, () =>
    once("SWEEP", async () => {
      await sendReminders(new Date());
      await sendDigests(new Date());
    })
  );

  console.log(
    `Notification scheduler started (deferred every ${Math.round(
      INTERVALS.deferred / MINUTE_MS
    )}m, sweep every ${Math.round(INTERVALS.sweep / MINUTE_MS)}m)`
  );
  return true;
}

function stop() {
  for (const timer of timers) clearInterval(timer);
  timers = [];
}

module.exports = {
  DIGEST_HOUR,
  DIGEST_WEEKDAY,
  FINISH_NUDGE_MAX_REMAINING,
  INTERVALS,
  LIMITS,
  REMIND_AFTER_DAYS,
  REMIND_BEFORE_DAYS,
  REMIND_PERCENT,
  digestCandidates,
  drainDeferred,
  isDigestWindow,
  runAll,
  seasonRemaining,
  sendDigests,
  sendReminders,
  start,
  stop,
};
