import api from "@/lib/axios";

/**
 * The notification API, as the client sees it.
 *
 * One module for the wire contract so no component builds a URL or reshapes a
 * response of its own — the bell, the inbox page and the settings page all read
 * the same types, which is what stops the badge in the navbar and the count on
 * the inbox from ever disagreeing.
 *
 * `openStream` is the interesting one. It reads server-sent events with `fetch`
 * rather than `EventSource`, because the stream is authenticated with the same
 * `token` header as every other endpoint and `EventSource` cannot set headers.
 * The alternative — a token in the query string — would put a bearer credential
 * in every proxy log between here and the API. What it costs is reconnection,
 * which `EventSource` does for free and is reimplemented here.
 */

export type NotificationCategory =
  | "new_content"
  | "continue_watching"
  | "recommendations"
  | "social"
  | "digest"
  | "product"
  | "account";

export type NotificationPriority = "transactional" | "high" | "normal" | "low";

export interface AppNotification {
  id: string;
  type: string;
  category: NotificationCategory;
  categoryLabel: string;
  priority: NotificationPriority;
  title: string;
  body: string;
  image: string;
  icon: string;
  deepLink: string;
  entity: { kind: string; id: string; title: string };
  /** Why this arrived, in the viewer's terms. Empty when there isn't a reason. */
  reason: string;
  groupKey: string | null;
  read: boolean;
  readAt: string | null;
  clickedAt: string | null;
  archived: boolean;
  createdAt: string | null;
  pushed: boolean;
}

export interface InboxPage {
  items: AppNotification[];
  nextCursor: string | null;
  unread: number;
  total: number;
}

export interface CategoryMeta {
  key: NotificationCategory;
  label: string;
  description: string;
  default?: boolean;
  locked?: boolean;
}

export interface NotificationPreferences {
  push: boolean;
  categories: Record<NotificationCategory, boolean>;
  quietHours: { enabled: boolean; start: string; end: string };
  timezone: string;
  maxPushPerDay: number;
  minPushGapMinutes: number;
  digest: boolean;
}

export interface RegisteredDevice {
  id: string;
  platform: string;
  userAgent: string;
  createdAt: string | null;
}

export interface CategoryStat {
  created: number;
  pushed: number;
  opened: number;
  clicked: number;
  ignoredStreak: number;
  lastPushAt: string | null;
}

export interface PreferencesPayload {
  preferences: NotificationPreferences;
  categories: CategoryMeta[];
  devices: RegisteredDevice[];
  stats: {
    global: (CategoryStat & { pushesToday: number; pushDay: string }) | null;
    categories: Partial<Record<NotificationCategory, CategoryStat>>;
  };
  pushAvailable: boolean;
}

// --- reads -------------------------------------------------------------------

export async function fetchInbox(options: {
  cursor?: string | null;
  limit?: number;
  category?: NotificationCategory | null;
  unreadOnly?: boolean;
  archived?: boolean;
} = {}): Promise<InboxPage> {
  const params: Record<string, string> = {};
  if (options.cursor) params.cursor = options.cursor;
  if (options.limit) params.limit = String(options.limit);
  if (options.category) params.category = options.category;
  if (options.unreadOnly) params.unread = "true";
  if (options.archived) params.archived = "true";

  const { data } = await api.get<InboxPage>("/notifications", { params });
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    nextCursor: data?.nextCursor ?? null,
    unread: data?.unread ?? 0,
    total: data?.total ?? 0,
  };
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await api.get<{ unread: number }>("/notifications/unread-count");
  return data?.unread ?? 0;
}

export async function fetchPreferences(): Promise<PreferencesPayload> {
  const { data } = await api.get<PreferencesPayload>("/notifications/preferences");
  return data;
}

// --- writes ------------------------------------------------------------------

export async function markRead(id: string): Promise<number> {
  const { data } = await api.patch<{ unread: number }>(`/notifications/${id}/read`);
  return data?.unread ?? 0;
}

export async function markAllRead(): Promise<void> {
  await api.post("/notifications/read-all");
}

/**
 * Records that the viewer acted on a notification.
 *
 * Deliberately separate from `markRead`: a click is the only signal that says
 * the send was worth making, and it is what clears the server's ignored-streak
 * throttle. Failing silently is correct — a lost analytics beacon must never
 * stand between a tap and the page it was meant to open.
 */
export async function recordClick(id: string): Promise<void> {
  await api.post(`/notifications/${id}/click`).catch(() => {});
}

export async function archive(id: string): Promise<number> {
  const { data } = await api.delete<{ unread: number }>(`/notifications/${id}`);
  return data?.unread ?? 0;
}

export async function archiveRead(): Promise<void> {
  await api.post("/notifications/archive-read");
}

export async function savePreferences(
  patch: Partial<NotificationPreferences>
): Promise<PreferencesPayload["preferences"]> {
  const { data } = await api.put<{ preferences: NotificationPreferences }>(
    "/notifications/preferences",
    patch
  );
  return data.preferences;
}

export async function registerDevice(token: string): Promise<void> {
  await api.post("/notifications/devices", {
    token,
    platform: "web",
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
  });
}

export async function unregisterDevice(token: string): Promise<void> {
  await api.delete(`/notifications/devices/${encodeURIComponent(token)}`);
}

// --- realtime ----------------------------------------------------------------

export interface StreamHandlers {
  onNotification: (notification: AppNotification, unread: number) => void;
  onCount: (unread: number) => void;
  onStatus: (connected: boolean) => void;
}

/** Anything the API has said about a stored notification, as one frame. */
type Frame =
  | { event: "hello"; data: { unread: number } }
  | { event: "notification"; data: { notification: AppNotification; unread: number } }
  | { event: "read"; data: { id: string | null; unread: number } }
  | { event: "archived"; data: { id: string; unread: number } };

function parseFrame(raw: string): Frame | null {
  const event = /^event: (.+)$/m.exec(raw)?.[1];
  const payload = /^data: (.+)$/m.exec(raw)?.[1];
  if (!event || !payload) return null;
  try {
    return { event, data: JSON.parse(payload) } as Frame;
  } catch {
    return null;
  }
}

/**
 * Holds a live connection to the viewer's notifications.
 *
 * Returns a `close()` that is safe to call at any point, including while the
 * initial request is still in flight — which is the case that matters, because a
 * React effect in development mounts, unmounts and remounts before the first
 * response arrives.
 *
 * Backoff is capped and jittered. Without the cap a server restart turns every
 * open tab into a retry loop; without the jitter every tab in every browser
 * retries on the same tick and the restart is met with a thundering herd.
 */
export function openStream(token: string, handlers: StreamHandlers): () => void {
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let closed = false;

  const scheduleRetry = () => {
    if (closed) return;
    attempt += 1;
    const backoff = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
    retryTimer = setTimeout(connect, backoff * (0.7 + Math.random() * 0.6));
  };

  const connect = async () => {
    if (closed) return;
    controller = new AbortController();

    try {
      const response = await fetch("/api/notifications/stream", {
        headers: { token: `Bearer ${token}`, Accept: "text/event-stream" },
        signal: controller.signal,
        // The connection is held open for the life of the tab; a cached response
        // would be a response that never updates.
        cache: "no-store",
      });

      if (!response.ok || !response.body) {
        handlers.onStatus(false);
        scheduleRetry();
        return;
      }

      attempt = 0;
      handlers.onStatus(true);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Frames are separated by a blank line; anything after the last one is a
        // partial frame and stays in the buffer until the rest of it arrives.
        let split: number;
        while ((split = buffer.indexOf("\n\n")) !== -1) {
          const frame = parseFrame(buffer.slice(0, split));
          buffer = buffer.slice(split + 2);
          if (!frame) continue;

          if (frame.event === "notification") {
            handlers.onNotification(frame.data.notification, frame.data.unread);
          } else {
            // hello / read / archived all carry an authoritative count, so the
            // badge follows the server rather than being re-derived here.
            handlers.onCount(frame.data.unread);
          }
        }
      }

      handlers.onStatus(false);
      scheduleRetry();
    } catch {
      // An abort is this function being torn down, not a failure.
      if (closed) return;
      handlers.onStatus(false);
      scheduleRetry();
    }
  };

  connect();

  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    controller?.abort();
  };
}

// --- presentation helpers ----------------------------------------------------

/**
 * "3m ago", "yesterday".
 *
 * Relative rather than absolute, because every one of these is read as "how
 * stale is this" and nobody converts a timestamp in their head to answer that.
 * Falls back to a date past a week, where relative stops being informative.
 */
export function relativeTime(value: string | null | undefined): string {
  if (!value) return "";
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return "";

  const seconds = Math.round((Date.now() - at) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 90) return "1m ago";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "yesterday";

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
