import api from "@/lib/axios";

/**
 * The admin half of the notification API.
 *
 * Separate from the viewer-facing client on purpose: these endpoints return the
 * delivery machinery — which policy rule suppressed a push, how many devices took
 * it, per-campaign open rates — and keeping them in their own module means the
 * two surfaces cannot be confused for one another.
 */

export interface TypeSummary {
  key: string;
  label: string;
  created: number;
  pushed: number;
  deferred: number;
  suppressed: number;
  failed: number;
  read: number;
  clicked: number;
  readRate: number;
  clickRate: number;
  pushRate: number;
}

export interface StatsPayload {
  window: { days: number; since: string };
  totals: TypeSummary & { recipients: number };
  byType: TypeSummary[];
  byCategory: TypeSummary[];
  series: { date: string; created: number; pushed: number; read: number; clicked: number }[];
  suppression: { reason: string; count: number }[];
  push: { configured: boolean; env: { projectId: boolean; clientEmail: boolean; privateKey: boolean } };
  streams: { users: number; connections: number };
  scheduler: { intervals: { deferred: number; sweep: number } };
}

export interface CatalogEntry {
  type: string;
  category: string;
  priority: string;
  channels: string[];
  ttlDays: number | null;
  minScore: number | null;
}

export interface CatalogPayload {
  categories: { key: string; label: string; description: string; default?: boolean; locked?: boolean }[];
  types: CatalogEntry[];
  byCategory: Record<string, string[]>;
}

export interface RecentRow {
  id: string;
  userId: string;
  type: string;
  category: string;
  categoryLabel: string;
  priority: string;
  title: string;
  body: string;
  deepLink: string;
  read: boolean;
  clickedAt: string | null;
  createdAt: string | null;
  score: number | null;
  campaignId: string | null;
  channels: string[];
  delivery: {
    push: string;
    deferUntil: string | null;
    sentAt: string | null;
    suppressedBy: string;
    error: string;
    attempts: number;
    devices: number;
  };
  user: { id: string; username: string; email: string } | null;
}

/** Everything the composer can narrow an audience by. */
export interface Segment {
  activeWithinDays?: number | null;
  inactiveForDays?: number | null;
  genres?: string[];
  plan?: string | null;
  hasPush?: boolean | null;
  isAdmin?: boolean | null;
}

export interface PreviewResult {
  total: number;
  reachable?: number;
  truncated: boolean;
  description: string;
  withPush: number;
  invalid?: number;
}

export interface DispatchSummary {
  type: string;
  requested: number;
  truncated: boolean;
  created: number;
  pushed: number;
  failed: number;
  deferred: number;
  duplicates: number;
  skipped: number;
  rules: Record<string, number>;
}

export interface JobsResult {
  deferred: { considered: number; sent: number; dropped: number; redeferred: number } | null;
  reminders: { episodes: number; movies: number; finishes: number } | null;
  digests: { sent: number; due: number } | null;
}

export async function fetchStats(days = 30): Promise<StatsPayload> {
  const { data } = await api.get<StatsPayload>("/notifications/admin/stats", { params: { days } });
  return data;
}

export async function fetchCatalog(): Promise<CatalogPayload> {
  const { data } = await api.get<CatalogPayload>("/notifications/admin/catalog");
  return data;
}

export async function fetchRecent(params: { limit?: number; type?: string; campaignId?: string } = {}) {
  const { data } = await api.get<RecentRow[]>("/notifications/admin/recent", { params });
  return Array.isArray(data) ? data : [];
}

export async function previewAudience(body: {
  mode: "segment" | "users";
  userIds?: string[];
  segment?: Segment;
}): Promise<PreviewResult> {
  const { data } = await api.post<PreviewResult>("/notifications/admin/preview", body);
  return data;
}

export async function broadcast(body: {
  title: string;
  body?: string;
  deepLink?: string;
  image?: string;
  mode: "segment" | "users";
  userIds?: string[];
  segment?: Segment;
}): Promise<{ ok: boolean; campaignId: string | null; summary: DispatchSummary }> {
  const { data } = await api.post("/notifications/admin/broadcast", body);
  return data;
}

export async function sendTest(body: {
  title: string;
  body?: string;
  deepLink?: string;
  image?: string;
}): Promise<{ ok: boolean; summary: DispatchSummary }> {
  const { data } = await api.post("/notifications/admin/test", body);
  return data;
}

export async function runJobs(): Promise<JobsResult> {
  const { data } = await api.post<JobsResult>("/notifications/admin/run-jobs");
  return data;
}

/**
 * Why a push was not sent, in words.
 *
 * The API reports a machine-readable rule name; without this map the console
 * shows `ignored_streak` to a human, which reads like an error rather than like
 * the system deliberately protecting someone's attention.
 */
export const SUPPRESSION_LABELS: Record<string, string> = {
  category_off: "Category switched off",
  push_off: "Push switched off",
  no_device: "No registered device",
  digest_mode: "Rolled into their weekly summary",
  ignored_streak: "Paused — recent ones went unopened",
  cap_reached: "Daily limit reached",
  stale: "Held too long to still be news",
  no_user: "Account no longer exists",
};

export const RULE_LABELS: Record<string, string> = {
  ...SUPPRESSION_LABELS,
  send: "Sent",
  quiet_hours: "Held for quiet hours",
  min_gap: "Spaced out",
  transactional: "Sent (security)",
  inapp_only: "Inbox only",
  not_rendered: "Skipped — nothing to say",
};

export function ruleLabel(rule: string): string {
  return RULE_LABELS[rule] || rule.replace(/_/g, " ");
}
