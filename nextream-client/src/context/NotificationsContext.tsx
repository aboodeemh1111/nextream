"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { syncPush } from "@/lib/fcm";
import { drainPendingClicks } from "@/lib/pendingClicks";
import {
  AppNotification,
  archive as archiveNotification,
  fetchInbox,
  fetchUnreadCount,
  markAllRead as apiMarkAllRead,
  markRead as apiMarkRead,
  openStream,
  recordClick,
} from "@/lib/notifications";

/**
 * One source of truth for the viewer's notifications.
 *
 * Everything that renders a notification — the navbar bell, the inbox page, the
 * toast — reads from here, so the badge cannot say three while the list shows
 * five. That sounds obvious and is exactly what the previous bell got wrong: it
 * fetched its own list on open and derived its own count from it, so the badge
 * was only ever as fresh as the last time the menu had been opened.
 *
 * Freshness comes from three layers, in order of preference:
 *
 *   1. **The stream.** A held connection, so a notification appears in the same
 *      moment it is written. This is the normal case.
 *   2. **Polling.** Started only while the stream is *not* connected. A minute of
 *      staleness during a deploy is acceptable; a bell that stops working until
 *      the tab is reloaded is not.
 *   3. **Refetch on focus.** Covers the case neither of the above can: a laptop
 *      that was asleep, where the connection died and no timer fired.
 *
 * Reads are optimistic throughout. Marking something read updates the badge
 * immediately and reconciles from the response, because the alternative is a
 * badge that lags a tap by a round trip — and the server's count is
 * authoritative whenever it disagrees.
 */

/** How often to poll while the stream is down. */
const POLL_MS = 45_000;

/** Notifications kept in memory for the bell. The inbox page pages properly. */
const PREVIEW_SIZE = 20;

/** Toasts on screen at once. More than three is a wall, not a notification. */
const MAX_TOASTS = 3;

export interface ToastEntry {
  key: number;
  notification: AppNotification;
}

interface NotificationsValue {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  /** True while a live connection is held. Surfaced so the UI can be honest. */
  connected: boolean;
  toasts: ToastEntry[];
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  archive: (id: string) => Promise<void>;
  /** Records the click and marks it read. Never throws. */
  open: (notification: AppNotification) => void;
  dismissToast: (key: number) => void;
}

const NotificationsContext = createContext<NotificationsValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const token = user?.accessToken;

  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  // A monotonic key rather than the notification id: the same notification can
  // legitimately be toasted twice (a reconnect replaying it), and a duplicate
  // React key would collapse them into one that never dismisses.
  const toastKey = useRef(0);

  const reset = useCallback(() => {
    setItems([]);
    setUnread(0);
    setToasts([]);
    setConnected(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const page = await fetchInbox({ limit: PREVIEW_SIZE });
      setItems(page.items);
      setUnread(page.unread);
    } catch {
      // The API is regularly offline in local development; the shared axios
      // client already logs it, and an empty bell is the honest rendering.
    } finally {
      setLoading(false);
    }
  }, [token]);

  // --- initial load ----------------------------------------------------------

  useEffect(() => {
    if (!token) {
      reset();
      return;
    }
    refresh();

    // Keeps an already-granted push registration current. Never prompts — see
    // lib/fcm.ts for why asking on load is the one thing not to do.
    syncPush().catch(() => {});

    /**
     * Reports clicks the service worker could not.
     *
     * A notification tapped while the app was closed is attributed here, on the
     * load that tap caused, because the worker has no access to the bearer token
     * the API needs. Read before the refresh above lands, so the click and the
     * read state settle in the same paint.
     */
    drainPendingClicks()
      .then((ids) => {
        if (!ids.length) return;
        return Promise.all(ids.map((id) => recordClick(id))).then(() => refresh());
      })
      .catch(() => {});
  }, [token, refresh, reset]);

  // --- live stream -----------------------------------------------------------

  useEffect(() => {
    if (!token) return;

    return openStream(token, {
      onNotification: (notification, count) => {
        setUnread(count);
        setItems((current) => {
          // Guard against a duplicate arriving from a reconnect: the row is
          // already there, and prepending it again would show it twice.
          if (current.some((row) => row.id === notification.id)) return current;
          return [notification, ...current].slice(0, PREVIEW_SIZE);
        });

        // Toasted only when the viewer is actually looking. A background tab has
        // the service worker's system notification for this; doing both means the
        // same message twice.
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          toastKey.current += 1;
          const entry = { key: toastKey.current, notification };
          setToasts((current) => [...current, entry].slice(-MAX_TOASTS));
        }
      },
      onCount: setUnread,
      onStatus: setConnected,
    });
  }, [token]);

  // --- fallbacks -------------------------------------------------------------

  useEffect(() => {
    // Only while the stream is down. Polling alongside a working connection is
    // pure waste, and it is what the stream exists to remove.
    if (!token || connected) return;

    const timer = setInterval(() => {
      fetchUnreadCount()
        .then(setUnread)
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [token, connected]);

  useEffect(() => {
    if (!token) return;

    // A tab that comes back from sleep has a dead connection and no timer that
    // has fired; the stream's own retry will reconnect, but the count should be
    // right before it does.
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      fetchUnreadCount()
        .then(setUnread)
        .catch(() => {});
    };

    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [token]);

  /**
   * Messages from the service worker.
   *
   * The worker suppresses its own system notification when a visible tab exists,
   * and posts here instead — so a push that arrives while the viewer is reading
   * the site becomes an in-app toast rather than an OS banner over the page they
   * are already looking at.
   */
  useEffect(() => {
    if (!token || typeof navigator === "undefined" || !navigator.serviceWorker) return;

    const onMessage = (event: MessageEvent) => {
      const payload = event.data;
      if (!payload || payload.source !== "nextream-notifications") return;

      if (payload.type === "push" && payload.notification) {
        toastKey.current += 1;
        const entry = { key: toastKey.current, notification: payload.notification };
        setToasts((current) => [...current, entry].slice(-MAX_TOASTS));
        // The push carries no count, and the stream may not be connected in the
        // tab that received it.
        fetchUnreadCount()
          .then(setUnread)
          .catch(() => {});
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [token]);

  // --- actions ---------------------------------------------------------------

  const markRead = useCallback(async (id: string) => {
    // Optimistic: the badge has to move on the tap, not a round trip later.
    let wasUnread = false;
    setItems((current) =>
      current.map((row) => {
        if (row.id !== id || row.read) return row;
        wasUnread = true;
        return { ...row, read: true };
      })
    );
    if (wasUnread) setUnread((count) => Math.max(0, count - 1));

    try {
      setUnread(await apiMarkRead(id));
    } catch {
      // Keep the optimistic state. The count reconciles on the next stream
      // frame, poll or focus; reverting would make the row flicker back to
      // unread under the viewer's cursor.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((row) => ({ ...row, read: true })));
    setUnread(0);
    try {
      await apiMarkAllRead();
    } catch {
      refresh();
    }
  }, [refresh]);

  const archive = useCallback(async (id: string) => {
    let removed: AppNotification | undefined;
    setItems((current) => {
      removed = current.find((row) => row.id === id);
      return current.filter((row) => row.id !== id);
    });
    if (removed && !removed.read) setUnread((count) => Math.max(0, count - 1));

    try {
      setUnread(await archiveNotification(id));
    } catch {
      refresh();
    }
  }, [refresh]);

  /**
   * The viewer acted on a notification.
   *
   * Navigation is the caller's job — this only records. Both writes are
   * fire-and-forget: a click beacon must never sit between a tap and the page it
   * opens, and a failed one costs a data point, not a journey.
   */
  const open = useCallback(
    (notification: AppNotification) => {
      recordClick(notification.id);
      if (!notification.read) markRead(notification.id);
    },
    [markRead]
  );

  const dismissToast = useCallback((key: number) => {
    setToasts((current) => current.filter((entry) => entry.key !== key));
  }, []);

  const value = useMemo(
    () => ({
      items,
      unread,
      loading,
      connected,
      toasts,
      refresh,
      markRead,
      markAllRead,
      archive,
      open,
      dismissToast,
    }),
    [items, unread, loading, connected, toasts, refresh, markRead, markAllRead, archive, open, dismissToast]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
}
