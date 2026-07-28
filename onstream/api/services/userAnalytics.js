const mongoose = require("mongoose");
const User = require("../models/User");
const WatchSession = require("../models/WatchSession");
const TVProgress = require("../models/TVProgress");
const { describeDevice } = require("./deviceInfo");

/**
 * Everything the admin user-profile page needs about one viewer, assembled
 * from the three stores that actually hold viewer state:
 *
 *   WatchSession — what happened while they watched (the analytics spine)
 *   TVProgress   — where they are in each episode
 *   User         — their lists, preferences and login history
 *
 * All watch-time figures come from sessions, never from the `$inc` counters on
 * the User document. Those counters are kept for legacy rows written before
 * telemetry existed and are reported separately as `legacy`, so a profile that
 * predates this pipeline reads as "no measured data" instead of silently
 * mixing an uncorrectable running total into a real one.
 */

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

function toObjectId(id) {
  return new mongoose.Types.ObjectId(String(id));
}

function round(value, places = 0) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function pct(part, whole, places = 1) {
  if (!whole) return 0;
  return round((part / whole) * 100, places);
}

function first(rows, fallback = {}) {
  return Array.isArray(rows) && rows.length ? rows[0] : fallback;
}

/** Calendar date in the requested zone, as the YYYY-MM-DD key the pipeline emits. */
function dateKey(date, timezone) {
  // en-CA formats as YYYY-MM-DD, which is exactly $dateToString's format here.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Dense day series. The pipeline only emits days the viewer actually watched
 * on; a chart drawn straight from that would join 3 March to 19 March with a
 * straight line and imply activity that never happened.
 */
function fillDays(rows, from, to, timezone) {
  const byDate = new Map(rows.map((row) => [row._id, row]));
  const lastKey = dateKey(to, timezone);
  const series = [];

  // Walk the keys in UTC date-only space rather than stepping the real
  // instants: once a day is reduced to YYYY-MM-DD, +24h in UTC always
  // advances exactly one calendar day, whereas stepping a zoned instant
  // skips or repeats a bucket across a DST boundary.
  let cursor = new Date(`${dateKey(from, timezone)}T00:00:00.000Z`);

  for (let guard = 0; guard <= MAX_WINDOW_DAYS + 1; guard += 1) {
    const key = cursor.toISOString().slice(0, 10);
    const row = byDate.get(key);
    series.push({
      date: key,
      watchSeconds: round(row?.watchSeconds || 0),
      sessions: row?.sessions || 0,
    });
    if (key >= lastKey) break;
    cursor = new Date(cursor.getTime() + DAY_MS);
  }

  return series;
}

/** Facet stages shared by the windowed and lifetime pipelines. */
const totalsFacet = [
  {
    $group: {
      _id: null,
      watchSeconds: { $sum: "$secondsWatched" },
      sessions: { $sum: 1 },
      longestSessionSeconds: { $max: "$secondsWatched" },
      firstSessionAt: { $min: "$startedAt" },
      lastSessionAt: { $max: "$lastHeartbeatAt" },
    },
  },
];

const titlesFacet = [
  {
    $group: {
      _id: { contentType: "$contentType", contentId: "$contentId" },
      title: { $last: "$title" },
      genre: { $last: "$genre" },
      showId: { $last: "$showId" },
      watchSeconds: { $sum: "$secondsWatched" },
      sessions: { $sum: 1 },
      maxPercent: { $max: "$percent" },
      completed: { $max: { $cond: ["$completed", 1, 0] } },
      lastWatchedAt: { $max: "$lastHeartbeatAt" },
    },
  },
  { $sort: { watchSeconds: -1 } },
];

function buildWindowPipeline(userId, from, timezone) {
  return [
    { $match: { userId: toObjectId(userId), startedAt: { $gte: from } } },
    {
      $facet: {
        totals: totalsFacet,
        titles: titlesFacet,
        daily: [
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$startedAt", timezone },
              },
              watchSeconds: { $sum: "$secondsWatched" },
              sessions: { $sum: 1 },
            },
          },
        ],
        hourly: [
          {
            $group: {
              _id: { $hour: { date: "$startedAt", timezone } },
              watchSeconds: { $sum: "$secondsWatched" },
              sessions: { $sum: 1 },
            },
          },
        ],
        genres: [
          // Sessions carry a denormalised genre; blank means the title had
          // none, which is a real category and not a reason to drop the time.
          {
            $group: {
              _id: { $ifNull: ["$genre", ""] },
              watchSeconds: { $sum: "$secondsWatched" },
              sessions: { $sum: 1 },
            },
          },
          { $sort: { watchSeconds: -1 } },
        ],
        devices: [
          {
            $group: {
              _id: {
                type: "$device.type",
                os: "$device.os",
                browser: "$device.browser",
              },
              sessions: { $sum: 1 },
              watchSeconds: { $sum: "$secondsWatched" },
              lastSeenAt: { $max: "$lastHeartbeatAt" },
            },
          },
          { $sort: { watchSeconds: -1 } },
        ],
        qoe: [
          // Only the real <video> players report QoE, so averaging over every
          // session would drag every figure toward zero. Restrict to sessions
          // that actually measured a startup time.
          { $match: { "qoe.startupMs": { $gt: 0 } } },
          {
            $group: {
              _id: null,
              sessions: { $sum: 1 },
              startupMs: { $avg: "$qoe.startupMs" },
              rebufferCount: { $sum: "$qoe.rebufferCount" },
              rebufferSec: { $sum: "$qoe.rebufferSec" },
              errorCount: { $sum: "$qoe.errorCount" },
              watchSeconds: { $sum: "$secondsWatched" },
            },
          },
        ],
        recent: [
          { $sort: { lastHeartbeatAt: -1 } },
          { $limit: 15 },
          {
            $project: {
              _id: 0,
              sessionId: 1,
              contentType: 1,
              contentId: 1,
              showId: 1,
              seasonNumber: 1,
              episodeNumber: 1,
              title: 1,
              genre: 1,
              startedAt: 1,
              lastHeartbeatAt: 1,
              endedAt: 1,
              secondsWatched: 1,
              percent: 1,
              completed: 1,
              device: 1,
              qoe: 1,
            },
          },
        ],
      },
    },
  ];
}

function summariseTitles(rows) {
  const started = rows.length;
  const completed = rows.filter((row) => row.completed).length;
  return { started, completed };
}

async function tvSummary(userId) {
  const rows = await TVProgress.aggregate([
    { $match: { userId: toObjectId(userId) } },
    {
      $group: {
        _id: null,
        episodesStarted: { $sum: 1 },
        episodesCompleted: { $sum: { $cond: ["$completed", 1, 0] } },
        shows: { $addToSet: "$showId" },
        positionSec: { $sum: "$positionSec" },
        lastWatchedAt: { $max: "$watchedAt" },
      },
    },
  ]);

  const row = first(rows);
  return {
    episodesStarted: row.episodesStarted || 0,
    episodesCompleted: row.episodesCompleted || 0,
    showsWatched: (row.shows || []).length,
    inProgress: (row.episodesStarted || 0) - (row.episodesCompleted || 0),
    // Sum of resume positions: a floor on TV time for viewers whose sessions
    // predate this pipeline, not a substitute for measured watch time.
    positionSeconds: round(row.positionSec || 0),
    lastWatchedAt: row.lastWatchedAt || null,
  };
}

/**
 * @param {string} userId
 * @param {{days?: number, timezone?: string}} [options]
 */
async function buildUserAnalytics(userId, options = {}) {
  const days = Math.min(
    Math.max(parseInt(options.days, 10) || DEFAULT_WINDOW_DAYS, 1),
    MAX_WINDOW_DAYS
  );
  const timezone = options.timezone || "UTC";
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * DAY_MS);
  from.setUTCHours(0, 0, 0, 0);

  const [user, windowRows, lifetimeRows, tv] = await Promise.all([
    User.findById(userId)
      .select(
        "username email profilePic isAdmin createdAt updatedAt lastLoginDate loginHistory " +
          "totalWatchTime genrePreferences subscriptionStatus preferences " +
          "myList myShows favorites watchlist watchHistory currentlyWatching deviceTokens"
      )
      .lean(),
    WatchSession.aggregate(buildWindowPipeline(userId, from, timezone)),
    WatchSession.aggregate([
      { $match: { userId: toObjectId(userId) } },
      { $facet: { totals: totalsFacet, titles: titlesFacet } },
    ]),
    tvSummary(userId),
  ]);

  if (!user) return null;

  const win = first(windowRows);
  const life = first(lifetimeRows);

  const windowTotals = first(win.totals || []);
  const lifetimeTotals = first(life.totals || []);
  const windowTitles = win.titles || [];
  const lifetimeTitles = life.titles || [];

  const daily = fillDays(win.daily || [], from, to, timezone);
  const activeDays = daily.filter((day) => day.sessions > 0).length;

  const windowWatchSeconds = round(windowTotals.watchSeconds || 0);
  const windowSessions = windowTotals.sessions || 0;
  const lifetimeWatchSeconds = round(lifetimeTotals.watchSeconds || 0);

  const windowTitleStats = summariseTitles(windowTitles);
  const lifetimeTitleStats = summariseTitles(lifetimeTitles);

  const genreRows = win.genres || [];
  const genreTotal = genreRows.reduce((sum, row) => sum + (row.watchSeconds || 0), 0);

  const deviceRows = win.devices || [];
  const deviceTotal = deviceRows.reduce((sum, row) => sum + (row.watchSeconds || 0), 0);

  const qoeRow = first(win.qoe || []);
  const qoeWatchSeconds = qoeRow.watchSeconds || 0;

  const hourlyByHour = new Map((win.hourly || []).map((row) => [row._id, row]));
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    watchSeconds: round(hourlyByHour.get(hour)?.watchSeconds || 0),
    sessions: hourlyByHour.get(hour)?.sessions || 0,
  }));

  const loginHistory = Array.isArray(user.loginHistory) ? user.loginHistory : [];
  const legacyHistory = Array.isArray(user.watchHistory) ? user.watchHistory : [];
  const legacyHistorySeconds = legacyHistory.reduce(
    (sum, entry) => sum + (entry?.watchTime || 0),
    0
  );

  const genrePreferences = user.genrePreferences || {};
  const preferenceRows = Object.entries(
    genrePreferences instanceof Map ? Object.fromEntries(genrePreferences) : genrePreferences
  )
    .map(([genre, plays]) => ({ genre, plays: Number(plays) || 0 }))
    .sort((a, b) => b.plays - a.plays);

  return {
    window: { days, timezone, from, to },

    account: {
      _id: String(user._id),
      username: user.username,
      email: user.email,
      profilePic: user.profilePic || "",
      isAdmin: Boolean(user.isAdmin),
      createdAt: user.createdAt,
      daysSinceJoin: user.createdAt
        ? Math.max(0, Math.floor((to - new Date(user.createdAt)) / DAY_MS))
        : null,
      subscriptionStatus: user.subscriptionStatus || null,
      preferences: user.preferences || {},
      registeredDevices: (user.deviceTokens || []).length,
      // The newest signal of life we have, whichever store it came from.
      lastActiveAt:
        [
          lifetimeTotals.lastSessionAt,
          tv.lastWatchedAt,
          user.lastLoginDate,
          user.updatedAt,
        ]
          .filter(Boolean)
          .map((value) => new Date(value))
          .sort((a, b) => b - a)[0] || null,
    },

    totals: {
      watchSeconds: lifetimeWatchSeconds,
      sessions: lifetimeTotals.sessions || 0,
      titlesStarted: lifetimeTitleStats.started,
      titlesCompleted: lifetimeTitleStats.completed,
      completionRate: pct(lifetimeTitleStats.completed, lifetimeTitleStats.started),
      firstSessionAt: lifetimeTotals.firstSessionAt || null,
      lastSessionAt: lifetimeTotals.lastSessionAt || null,
    },

    windowTotals: {
      watchSeconds: windowWatchSeconds,
      sessions: windowSessions,
      titlesStarted: windowTitleStats.started,
      titlesCompleted: windowTitleStats.completed,
      completionRate: pct(windowTitleStats.completed, windowTitleStats.started),
      activeDays,
      // Per *active* day, not per calendar day: a viewer who watches four
      // hours every Sunday is not a 34-minutes-a-day viewer.
      avgSecondsPerActiveDay: activeDays ? round(windowWatchSeconds / activeDays) : 0,
      avgSessionSeconds: windowSessions ? round(windowWatchSeconds / windowSessions) : 0,
      longestSessionSeconds: round(windowTotals.longestSessionSeconds || 0),
    },

    activity: daily,
    hourly,

    topGenres: genreRows.slice(0, 8).map((row) => ({
      genre: row._id || "Unclassified",
      watchSeconds: round(row.watchSeconds || 0),
      sessions: row.sessions || 0,
      share: pct(row.watchSeconds || 0, genreTotal),
    })),

    topTitles: windowTitles.slice(0, 10).map((row) => ({
      contentType: row._id.contentType,
      contentId: String(row._id.contentId),
      showId: row.showId ? String(row.showId) : null,
      title: row.title || "Untitled",
      genre: row.genre || "",
      watchSeconds: round(row.watchSeconds || 0),
      sessions: row.sessions || 0,
      percent: round(row.maxPercent || 0),
      completed: Boolean(row.completed),
      lastWatchedAt: row.lastWatchedAt || null,
    })),

    devices: deviceRows.map((row) => ({
      type: row._id.type || "unknown",
      os: row._id.os || "unknown",
      browser: row._id.browser || "unknown",
      label: describeDevice({ browser: row._id.browser, os: row._id.os }),
      sessions: row.sessions || 0,
      watchSeconds: round(row.watchSeconds || 0),
      share: pct(row.watchSeconds || 0, deviceTotal),
      lastSeenAt: row.lastSeenAt || null,
    })),

    qoe: {
      // How many sessions these figures are based on — without it, a 4000ms
      // average over one session reads the same as one over ten thousand.
      sessions: qoeRow.sessions || 0,
      avgStartupMs: round(qoeRow.startupMs || 0),
      rebufferCount: qoeRow.rebufferCount || 0,
      rebufferSeconds: round(qoeRow.rebufferSec || 0),
      rebufferRatio: pct(qoeRow.rebufferSec || 0, qoeWatchSeconds, 2),
      errorCount: qoeRow.errorCount || 0,
      errorRate: pct(qoeRow.errorCount || 0, qoeRow.sessions || 0),
    },

    recentSessions: (win.recent || []).map((row) => ({
      ...row,
      contentId: String(row.contentId),
      showId: row.showId ? String(row.showId) : null,
      secondsWatched: round(row.secondsWatched || 0),
      percent: round(row.percent || 0),
      deviceLabel: describeDevice(row.device),
    })),

    library: {
      myList: (user.myList || []).length,
      myShows: (user.myShows || []).length,
      favorites: (user.favorites || []).length,
      watchlist: (user.watchlist || []).length,
    },

    movies: {
      inProgress: (user.currentlyWatching || []).length,
      historyEntries: legacyHistory.length,
      completed: legacyHistory.filter((entry) => entry?.completed).length,
    },

    tv,

    logins: {
      lastLoginDate: user.lastLoginDate || null,
      total: loginHistory.length,
      recent: loginHistory
        .slice(-10)
        .reverse()
        .map((entry) => ({
          date: entry.date,
          device: entry.device || "Unknown device",
          location: entry.location || "",
        })),
    },

    // Pre-telemetry counters, reported so a profile with old data is visibly
    // "not measured" rather than blank.
    legacy: {
      totalWatchTimeField: user.totalWatchTime || 0,
      watchHistorySeconds: legacyHistorySeconds,
      genrePreferences: preferenceRows,
    },
  };
}

module.exports = {
  buildUserAnalytics,
  // Exported for tests: the date maths is the part that silently produces a
  // plausible-looking but wrong chart, so it is pinned without a database.
  fillDays,
  dateKey,
  pct,
  DEFAULT_WINDOW_DAYS,
  MAX_WINDOW_DAYS,
};
