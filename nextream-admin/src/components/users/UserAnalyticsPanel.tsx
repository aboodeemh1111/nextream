"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  FaBolt,
  FaClock,
  FaDesktop,
  FaExclamationTriangle,
  FaFilm,
  FaHistory,
  FaMobileAlt,
  FaPlay,
  FaSignInAlt,
  FaTabletAlt,
  FaTv,
  FaQuestion,
} from "react-icons/fa";
import { chartTooltipStyle, useChartTheme } from "@/lib/chartTheme";

/** Mirrors the payload of GET /users/:id/analytics. */
export interface UserAnalytics {
  window: { days: number; timezone: string; from: string; to: string };
  account: {
    createdAt: string;
    daysSinceJoin: number | null;
    lastActiveAt: string | null;
    registeredDevices: number;
  };
  totals: {
    watchSeconds: number;
    sessions: number;
    titlesStarted: number;
    titlesCompleted: number;
    completionRate: number;
    firstSessionAt: string | null;
    lastSessionAt: string | null;
  };
  windowTotals: {
    watchSeconds: number;
    sessions: number;
    titlesStarted: number;
    titlesCompleted: number;
    completionRate: number;
    activeDays: number;
    avgSecondsPerActiveDay: number;
    avgSessionSeconds: number;
    longestSessionSeconds: number;
  };
  activity: { date: string; watchSeconds: number; sessions: number }[];
  hourly: { hour: number; watchSeconds: number; sessions: number }[];
  topGenres: { genre: string; watchSeconds: number; sessions: number; share: number }[];
  topTitles: {
    contentType: string;
    contentId: string;
    showId: string | null;
    title: string;
    genre: string;
    watchSeconds: number;
    sessions: number;
    percent: number;
    completed: boolean;
    lastWatchedAt: string | null;
  }[];
  devices: {
    type: string;
    os: string;
    browser: string;
    label: string;
    sessions: number;
    watchSeconds: number;
    share: number;
    lastSeenAt: string | null;
  }[];
  qoe: {
    sessions: number;
    avgStartupMs: number;
    rebufferCount: number;
    rebufferSeconds: number;
    rebufferRatio: number;
    errorCount: number;
    errorRate: number;
  };
  recentSessions: {
    sessionId: string;
    contentType: string;
    title: string;
    startedAt: string;
    secondsWatched: number;
    percent: number;
    completed: boolean;
    deviceLabel: string;
    device?: { type?: string };
  }[];
  tv: {
    episodesStarted: number;
    episodesCompleted: number;
    showsWatched: number;
    inProgress: number;
    lastWatchedAt: string | null;
  };
  logins: {
    lastLoginDate: string | null;
    total: number;
    recent: { date: string; device: string; location: string }[];
  };
  legacy: {
    totalWatchTimeField: number;
    watchHistorySeconds: number;
    genrePreferences: { genre: string; plays: number }[];
  };
}

const SERIES = ["#dc2626", "#f97316", "#0ea5e9", "#22c55e", "#a855f7", "#facc15", "#64748b"];

export function formatDuration(seconds?: number): string {
  const total = Math.max(0, Math.round(seconds || 0));
  if (total < 60) return `${total}s`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deviceIcon(type?: string) {
  switch (type) {
    case "mobile":
      return <FaMobileAlt />;
    case "tablet":
      return <FaTabletAlt />;
    case "tv":
      return <FaTv />;
    case "desktop":
      return <FaDesktop />;
    default:
      return <FaQuestion />;
  }
}

function Stat({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "default" | "accent";
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === "accent" ? "border-red-200 bg-red-50/60" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className="shrink-0 text-red-600">{icon}</span>
      </div>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function NoData({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

const WINDOWS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
];

export default function UserAnalyticsPanel({
  analytics,
  days,
  onDaysChange,
  loading,
}: {
  analytics: UserAnalytics;
  days: number;
  onDaysChange: (days: number) => void;
  loading?: boolean;
}) {
  const theme = useChartTheme();
  const tooltipStyle = chartTooltipStyle(theme);
  const tickStyle = { fontSize: 11, fill: theme.muted };

  const { totals, windowTotals, qoe, tv, logins, legacy } = analytics;

  // Minutes, not seconds: an axis in seconds reads as five digits for anything
  // longer than a sitcom and tells the reader nothing at a glance.
  const activity = useMemo(
    () =>
      analytics.activity.map((row) => ({
        ...row,
        minutes: Math.round(row.watchSeconds / 60),
        // A 90-day window cannot label every day, so the axis thins itself.
        label: new Date(`${row.date}T00:00:00Z`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      })),
    [analytics.activity]
  );

  const hourly = useMemo(
    () =>
      analytics.hourly.map((row) => ({
        ...row,
        minutes: Math.round(row.watchSeconds / 60),
        label: `${String(row.hour).padStart(2, "0")}:00`,
      })),
    [analytics.hourly]
  );

  const deviceSlices = useMemo(
    () =>
      analytics.devices.map((row) => ({
        name: `${row.type} · ${row.label}`,
        value: Math.max(1, Math.round(row.watchSeconds / 60)),
        type: row.type,
      })),
    [analytics.devices]
  );

  const hasSessions = totals.sessions > 0;
  const hasLegacy = legacy.totalWatchTimeField > 0 || legacy.watchHistorySeconds > 0;

  return (
    <div className={`space-y-6 ${loading ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Viewing analytics</h2>
          <p className="text-xs text-muted-foreground">
            Measured from playback sessions · times in {analytics.window.timezone}
          </p>
        </div>
        <div className="inline-flex rounded-md border border-border bg-background p-0.5">
          {WINDOWS.map((option) => (
            <button
              key={option.days}
              type="button"
              onClick={() => onDaysChange(option.days)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                days === option.days
                  ? "bg-red-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {!hasSessions && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <FaExclamationTriangle className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">No measured playback yet</p>
            <p className="mt-1 text-amber-800">
              This viewer has not produced a playback session since telemetry was
              enabled. Figures below stay at zero until they next press play.
              {hasLegacy && (
                <>
                  {" "}
                  Pre-telemetry counters on the account record{" "}
                  <strong>{formatDuration(legacy.totalWatchTimeField)}</strong> of
                  watch time and {legacy.genrePreferences.length} genre
                  {legacy.genrePreferences.length === 1 ? "" : "s"}; those were
                  incremented per request and are not comparable.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Lifetime */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total watch time"
          value={formatDuration(totals.watchSeconds)}
          hint={`${totals.sessions} session${totals.sessions === 1 ? "" : "s"} all time`}
          icon={<FaClock />}
          tone="accent"
        />
        <Stat
          label="Titles started"
          value={String(totals.titlesStarted)}
          hint={`${totals.titlesCompleted} finished`}
          icon={<FaFilm />}
        />
        <Stat
          label="Completion rate"
          value={`${totals.completionRate}%`}
          hint="Distinct titles finished vs started"
          icon={<FaPlay />}
        />
        <Stat
          label="Last watched"
          value={totals.lastSessionAt ? formatDate(totals.lastSessionAt) : "Never"}
          hint={
            analytics.account.lastActiveAt
              ? `Last active ${formatDate(analytics.account.lastActiveAt)}`
              : undefined
          }
          icon={<FaHistory />}
        />
      </div>

      {/* Window */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={`Watch time · ${days}d`}
          value={formatDuration(windowTotals.watchSeconds)}
          hint={`${windowTotals.sessions} session${windowTotals.sessions === 1 ? "" : "s"}`}
          icon={<FaClock />}
        />
        <Stat
          label="Active days"
          value={`${windowTotals.activeDays} / ${days}`}
          hint={`${formatDuration(windowTotals.avgSecondsPerActiveDay)} per active day`}
          icon={<FaBolt />}
        />
        <Stat
          label="Avg. session"
          value={formatDuration(windowTotals.avgSessionSeconds)}
          hint={`Longest ${formatDuration(windowTotals.longestSessionSeconds)}`}
          icon={<FaPlay />}
        />
        <Stat
          label="Logins recorded"
          value={String(logins.total)}
          hint={
            logins.lastLoginDate ? `Last ${formatDateTime(logins.lastLoginDate)}` : "Never signed in"
          }
          icon={<FaSignInAlt />}
        />
      </div>

      <Panel
        title={`Daily watch time · last ${days} days`}
        action={
          <span className="text-xs text-muted-foreground">
            {formatDuration(windowTotals.watchSeconds)} total
          </span>
        }
      >
        {windowTotals.sessions === 0 ? (
          <NoData message="No playback in this window." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={activity} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="watchFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
              <XAxis
                dataKey="label"
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={44} unit="m" />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [`${value} min`, "Watch time"]}
              />
              <Area
                type="monotone"
                dataKey="minutes"
                stroke="#dc2626"
                strokeWidth={2}
                fill="url(#watchFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Top genres by watch time">
          {analytics.topGenres.length === 0 ? (
            <NoData message="No genre data in this window." />
          ) : (
            <ul className="space-y-3">
              {analytics.topGenres.map((row, index) => (
                <li key={row.genre}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{row.genre}</span>
                    <span className="text-muted-foreground">
                      {formatDuration(row.watchSeconds)} · {row.share}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, row.share)}%`,
                        backgroundColor: SERIES[index % SERIES.length],
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Devices">
          {analytics.devices.length === 0 ? (
            <NoData message="No device data in this window." />
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="h-40 w-full sm:w-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deviceSlices}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={34}
                      outerRadius={64}
                      paddingAngle={2}
                    >
                      {deviceSlices.map((slice, index) => (
                        <Cell key={slice.name} fill={SERIES[index % SERIES.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [`${value} min`, "Watch time"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-2">
                {analytics.devices.slice(0, 6).map((row, index) => (
                  <li key={`${row.type}-${row.os}-${row.browser}`} className="flex items-center gap-3 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: SERIES[index % SERIES.length] }}
                    />
                    <span className="text-red-600">{deviceIcon(row.type)}</span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{row.label}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatDuration(row.watchSeconds)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="When they watch">
          {windowTotals.sessions === 0 ? (
            <NoData message="No playback in this window." />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hourly} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={40} unit="m" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [`${value} min`, "Watch time"]}
                />
                <Bar dataKey="minutes" fill="#dc2626" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Streaming quality">
          {qoe.sessions === 0 ? (
            <NoData message="No sessions reported quality metrics." />
          ) : (
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Avg. startup</dt>
                <dd className="font-medium text-foreground">
                  {(qoe.avgStartupMs / 1000).toFixed(2)}s
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Rebuffer ratio</dt>
                <dd className="font-medium text-foreground">{qoe.rebufferRatio}%</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Rebuffers</dt>
                <dd className="font-medium text-foreground">
                  {qoe.rebufferCount} · {formatDuration(qoe.rebufferSeconds)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Playback errors</dt>
                <dd className="font-medium text-foreground">
                  {qoe.errorCount} ({qoe.errorRate}%)
                </dd>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                Based on {qoe.sessions} measured session{qoe.sessions === 1 ? "" : "s"}.
              </p>
            </dl>
          )}
        </Panel>

        <Panel title="TV activity">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Shows watched</dt>
              <dd className="font-medium text-foreground">{tv.showsWatched}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Episodes started</dt>
              <dd className="font-medium text-foreground">{tv.episodesStarted}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Episodes completed</dt>
              <dd className="font-medium text-foreground">{tv.episodesCompleted}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">In progress</dt>
              <dd className="font-medium text-foreground">{tv.inProgress}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Last episode</dt>
              <dd className="font-medium text-foreground">{formatDate(tv.lastWatchedAt)}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={`Most watched · last ${days} days`}>
          {analytics.topTitles.length === 0 ? (
            <NoData message="No titles watched in this window." />
          ) : (
            <ul className="divide-y divide-border">
              {analytics.topTitles.map((row) => (
                <li key={`${row.contentType}-${row.contentId}`} className="flex items-center gap-3 py-2.5">
                  <span className="text-red-600">
                    {row.contentType === "episode" ? <FaTv /> : <FaFilm />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.sessions} session{row.sessions === 1 ? "" : "s"} ·{" "}
                      {row.completed ? "Completed" : `${row.percent}% watched`}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {formatDuration(row.watchSeconds)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent sessions">
          {analytics.recentSessions.length === 0 ? (
            <NoData message="No sessions in this window." />
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <ul className="divide-y divide-border">
                {analytics.recentSessions.map((row) => (
                  <li key={row.sessionId} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {row.title || "Untitled"}
                      </p>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {formatDuration(row.secondsWatched)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span>{formatDateTime(row.startedAt)}</span>
                      <span className="inline-flex items-center gap-1">
                        {deviceIcon(row.device?.type)} {row.deviceLabel}
                      </span>
                      <span>{row.completed ? "Completed" : `${row.percent}%`}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Sign-in history">
        {logins.recent.length === 0 ? (
          <NoData message="No sign-ins recorded yet." />
        ) : (
          <ul className="divide-y divide-border">
            {logins.recent.map((row, index) => (
              <li
                key={`${row.date}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <span className="text-foreground">{row.device}</span>
                <span className="text-muted-foreground">
                  {row.location ? `${row.location} · ` : ""}
                  {formatDateTime(row.date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
