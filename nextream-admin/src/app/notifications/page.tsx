"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FaBell,
  FaExclamationTriangle,
  FaPaperPlane,
  FaPlay,
  FaSync,
} from "react-icons/fa";
import AdminLayout from "@/components/AdminLayout";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Select,
  SkeletonRows,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  RecentRow,
  StatsPayload,
  fetchRecent,
  fetchStats,
  runJobs,
  ruleLabel,
} from "@/lib/notificationsApi";

/**
 * The notification console.
 *
 * Built around one question an admin cannot otherwise answer: *of everything the
 * system decided to say this month, how much of it landed, and why did the rest
 * not?* The previous page listed the admin's own inbox, which answered nothing —
 * it showed one account's notifications and nothing about delivery at all.
 *
 * Every rate here is over `created`, never over pushes attempted. That is a
 * deliberate choice and the reason the suppression panel exists next to it: a
 * type whose pushes are mostly suppressed is usually the system working — quiet
 * hours, a daily cap, a viewer who opted out — and a "delivery rate" computed
 * over sends would report all of that as failure. Showing the reasons turns the
 * gap between created and pushed from an alarm into an explanation.
 */

const WINDOWS = [7, 14, 30, 90];

export default function NotificationsConsolePage() {
  const toast = useToast();

  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningJobs, setRunningJobs] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsPayload, recentRows] = await Promise.all([fetchStats(days), fetchRecent({ limit: 25 })]);
      setStats(statsPayload);
      setRecent(recentRows);
    } catch (err: unknown) {
      setError("Couldn't load notification stats. Is the API running?");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRunJobs = async () => {
    setRunningJobs(true);
    try {
      const result = await runJobs();
      const created =
        (result.reminders?.episodes || 0) +
        (result.reminders?.movies || 0) +
        (result.reminders?.finishes || 0);
      toast.success(
        "Background jobs finished",
        `${result.deferred?.sent || 0} held-back pushes sent, ${created} reminders created, ${
          result.digests?.sent || 0
        } digests sent.`
      );
      load();
    } catch {
      toast.error("Couldn't run the background jobs");
    } finally {
      setRunningJobs(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              What the system sent, what it held back, and why.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(days)}
              onChange={(event) => setDays(Number(event.target.value))}
              aria-label="Reporting window"
              className="w-32"
            >
              {WINDOWS.map((value) => (
                <option key={value} value={value}>
                  Last {value} days
                </option>
              ))}
            </Select>
            <Button icon={<FaSync />} onClick={load} loading={loading}>
              Refresh
            </Button>
            <Button
              icon={<FaPlay />}
              onClick={handleRunJobs}
              loading={runningJobs}
              title="Runs the deferred-push drain, the reminder sweep and the digest sweep now"
            >
              Run jobs
            </Button>
            <Link href="/notifications/new">
              <Button variant="primary" icon={<FaPaperPlane />}>
                Compose
              </Button>
            </Link>
          </div>
        </header>

        {error && (
          <Card className="border-danger/40">
            <CardBody className="flex items-start gap-3 text-sm text-danger">
              <FaExclamationTriangle className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </CardBody>
          </Card>
        )}

        {/* Configuration first: every other number on this page is meaningless if
            the push transport is not wired up, and "0 pushed" looks identical to
            a missing service account. */}
        {stats && !stats.push.configured && (
          <Card className="border-warning/40">
            <CardBody className="text-sm">
              <p className="flex items-start gap-2 font-medium text-foreground">
                <FaExclamationTriangle className="mt-0.5 shrink-0 text-warning" aria-hidden />
                Push notifications are not configured.
              </p>
              <p className="mt-1 text-muted-foreground">
                Notifications are still recorded and reach viewers in-app. To send to devices, set{" "}
                {(["projectId", "clientEmail", "privateKey"] as const)
                  .filter((key) => !stats.push.env[key])
                  .map((key) => `FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`)
                  .join(", ") || "the Firebase service account variables"}{" "}
                on the API.
              </p>
            </CardBody>
          </Card>
        )}

        {loading && !stats ? (
          <Card>
            <CardBody>
              <SkeletonRows count={6} />
            </CardBody>
          </Card>
        ) : stats ? (
          <>
            {/* --- headline numbers ------------------------------------------ */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat label="Created" value={stats.totals.created} hint="Notifications made" />
              <Stat
                label="People reached"
                value={stats.totals.recipients}
                hint="Distinct viewers"
              />
              <Stat
                label="Pushed"
                value={stats.totals.pushed}
                hint={`${stats.totals.pushRate}% of created`}
              />
              <Stat
                label="Read"
                value={stats.totals.read}
                hint={`${stats.totals.readRate}% of created`}
                tone={stats.totals.readRate >= 40 ? "good" : undefined}
              />
              <Stat
                label="Clicked"
                value={stats.totals.clicked}
                hint={`${stats.totals.clickRate}% of created`}
                tone={stats.totals.clickRate >= 10 ? "good" : undefined}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              {/* --- per type ------------------------------------------------ */}
              <Card className="xl:col-span-2">
                <CardHeader
                  title="By type"
                  description="Read and click rates are over notifications created, not pushes sent."
                />
                <CardBody className="p-0">
                  {stats.byType.length === 0 ? (
                    <EmptyState
                      icon={<FaBell />}
                      title="Nothing sent in this window"
                      description="Publish an episode, or compose an announcement, and it will appear here."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-2 font-medium">Type</th>
                            <th className="px-3 py-2 text-right font-medium">Created</th>
                            <th className="px-3 py-2 text-right font-medium">Pushed</th>
                            <th className="px-3 py-2 text-right font-medium">Read</th>
                            <th className="px-3 py-2 text-right font-medium">Clicked</th>
                            <th className="px-4 py-2 text-right font-medium">Held / stopped</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.byType.map((row) => (
                            <tr key={row.key} className="border-b border-border/60 last:border-0">
                              <td className="px-4 py-2.5">
                                <span className="font-mono text-xs text-foreground">{row.key}</span>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{row.created}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                {row.pushed}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {row.read}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  {row.readRate}%
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {row.clicked}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  {row.clickRate}%
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                                {row.deferred > 0 && <span>{row.deferred} held</span>}
                                {row.deferred > 0 && row.suppressed > 0 && " · "}
                                {row.suppressed > 0 && <span>{row.suppressed} stopped</span>}
                                {row.failed > 0 && (
                                  <span className="text-danger"> · {row.failed} failed</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* --- why pushes stopped -------------------------------------- */}
              <Card>
                <CardHeader
                  title="Why pushes stopped"
                  description="Most of these are the system protecting attention, not failing."
                />
                <CardBody>
                  {stats.suppression.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing was suppressed in this window.
                    </p>
                  ) : (
                    <ul className="space-y-2.5">
                      {stats.suppression.map((row) => (
                        <li key={row.reason}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="text-foreground">{ruleLabel(row.reason)}</span>
                            <span className="tabular-nums text-muted-foreground">{row.count}</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                row.reason === "no_device" ? "bg-warning" : "bg-primary"
                              )}
                              style={{
                                width: `${Math.round(
                                  (row.count / Math.max(1, stats.suppression[0].count)) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <dl className="mt-5 space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
                    <div className="flex justify-between gap-3">
                      <dt>Live connections</dt>
                      <dd className="tabular-nums text-foreground">
                        {stats.streams.connections} across {stats.streams.users}{" "}
                        {stats.streams.users === 1 ? "viewer" : "viewers"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Deferred drain</dt>
                      <dd className="tabular-nums text-foreground">
                        every {Math.round(stats.scheduler.intervals.deferred / 60000)}m
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Reminder sweep</dt>
                      <dd className="tabular-nums text-foreground">
                        every {Math.round(stats.scheduler.intervals.sweep / 60000)}m
                      </dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>
            </div>

            {/* --- daily volume --------------------------------------------- */}
            {stats.series.length > 1 && (
              <Card>
                <CardHeader title="Daily volume" description="Created, and of those, read." />
                <CardBody>
                  <Sparkbars series={stats.series} />
                </CardBody>
              </Card>
            )}

            {/* --- recent --------------------------------------------------- */}
            <Card>
              <CardHeader
                title="Most recent"
                description="The last 25 notifications across every viewer."
              />
              <CardBody className="p-0">
                {recent.length === 0 ? (
                  <EmptyState icon={<FaBell />} title="Nothing sent yet" />
                ) : (
                  <ul className="divide-y divide-border">
                    {recent.map((row) => (
                      <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{row.title}</span>
                            <DeliveryBadge row={row} />
                          </div>
                          {row.body && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {row.body}
                            </p>
                          )}
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                            <span className="font-mono">{row.type}</span>
                            <span aria-hidden>·</span>
                            <span>{row.user?.username || "unknown viewer"}</span>
                            {row.createdAt && (
                              <>
                                <span aria-hidden>·</span>
                                <span>{new Date(row.createdAt).toLocaleString()}</span>
                              </>
                            )}
                            {row.delivery.devices > 0 && (
                              <>
                                <span aria-hidden>·</span>
                                <span>
                                  {row.delivery.devices}{" "}
                                  {row.delivery.devices === 1 ? "device" : "devices"}
                                </span>
                              </>
                            )}
                          </p>
                          {row.delivery.error && (
                            <p className="mt-1 text-[11px] text-danger">{row.delivery.error}</p>
                          )}
                        </div>

                        <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                          {row.clickedAt ? "clicked" : row.read ? "read" : "unread"}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}

// --- pieces ------------------------------------------------------------------

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "good";
}) {
  return (
    <Card>
      <CardBody className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums",
            tone === "good" ? "text-success" : "text-foreground"
          )}
        >
          {value.toLocaleString()}
        </p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardBody>
    </Card>
  );
}

function DeliveryBadge({ row }: { row: RecentRow }) {
  const state = row.delivery.push;

  if (state === "sent") return <Badge tone="success">pushed</Badge>;
  if (state === "deferred") return <Badge tone="warning">held</Badge>;
  if (state === "failed") return <Badge tone="danger">failed</Badge>;
  if (state === "suppressed") {
    return (
      <Badge tone="neutral" title={ruleLabel(row.delivery.suppressedBy)}>
        {ruleLabel(row.delivery.suppressedBy).toLowerCase()}
      </Badge>
    );
  }
  return <Badge tone="neutral">inbox only</Badge>;
}

/**
 * A bar per day.
 *
 * Deliberately CSS rather than a chart library: this is one series with a second
 * overlaid on it, and recharts here would be a second rendering path to maintain
 * for something a flexbox does correctly at every width.
 */
function Sparkbars({
  series,
}: {
  series: { date: string; created: number; read: number }[];
}) {
  const peak = Math.max(1, ...series.map((row) => row.created));

  return (
    <div className="flex h-32 items-end gap-1" role="img" aria-label="Notifications created per day">
      {series.map((row) => (
        <div key={row.date} className="group relative flex h-full flex-1 flex-col justify-end">
          <div
            className="w-full rounded-t bg-surface-2"
            style={{ height: `${(row.created / peak) * 100}%` }}
          >
            {/* Read is a subset of created, so it is drawn inside the same bar
                rather than beside it — two adjacent bars would imply two
                independent quantities. */}
            <div
              className="w-full rounded-t bg-primary"
              style={{
                height: `${row.created > 0 ? (row.read / row.created) * 100 : 0}%`,
                marginTop: `${row.created > 0 ? 100 - (row.read / row.created) * 100 : 100}%`,
              }}
            />
          </div>
          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-surface-2 px-2 py-1 text-[11px] text-foreground shadow-card group-hover:block">
            {row.date}: {row.created} created, {row.read} read
          </span>
        </div>
      ))}
    </div>
  );
}
