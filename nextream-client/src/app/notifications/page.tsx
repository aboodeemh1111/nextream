"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaCog } from "react-icons/fa";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import {
  AppNotification,
  CategoryMeta,
  NotificationCategory,
  archiveRead,
  fetchInbox,
  fetchPreferences,
} from "@/lib/notifications";
import { cn } from "@/lib/cn";
import { EmptyInbox, NotificationRow, RowSkeleton } from "@/components/notifications/Bits";

/**
 * The full inbox.
 *
 * Paged with a cursor rather than a page number, because notifications arrive
 * while the list is open: offset paging would show a row twice or skip one every
 * time something new landed above the boundary.
 *
 * The list here is its own state, not the context's. The context holds a short
 * preview for the bell; this page holds an arbitrarily long history, and pushing
 * that into a shared provider would keep every page in the app holding a hundred
 * notifications for the sake of one. What is shared is the *actions* — marking
 * read here has to move the badge in the navbar — so those still come from the
 * context and are mirrored into local state.
 */

type Filter = "all" | "unread" | NotificationCategory;

function matchesFilter(notification: AppNotification, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "unread") return !notification.read;
  return notification.category === filter;
}

function newestFirst(a: AppNotification, b: AppNotification): number {
  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const {
    markRead,
    archive,
    markAllRead,
    open,
    unread,
    items: liveItems,
  } = useNotifications();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // The category rail is built from the API's own list, so a category added
  // server-side appears here without a client release.
  useEffect(() => {
    if (!user) return;
    fetchPreferences()
      .then((payload) => setCategories(payload.categories || []))
      .catch(() => {});
  }, [user]);

  const load = useCallback(
    async (nextFilter: Filter) => {
      setLoading(true);
      setError(null);
      try {
        const page = await fetchInbox({
          limit: 25,
          unreadOnly: nextFilter === "unread",
          category: nextFilter === "all" || nextFilter === "unread" ? null : nextFilter,
        });
        setItems(page.items);
        setCursor(page.nextCursor);
      } catch {
        setError("Couldn't load your notifications. Try again in a moment.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!user) return;
    load(filter);
  }, [user, filter, load]);

  /**
   * Folds in what the live stream has delivered since this page fetched.
   *
   * Without this the page is stale the moment a notification arrives: the header
   * count comes from the shared provider and updates instantly, while the list
   * came from a fetch that has already returned — so the page would say "2 unread"
   * above an empty list, which is precisely the disagreement between badge and
   * list that having one provider was meant to make impossible.
   *
   * Merged rather than refetched, so an open list keeps the older pages the viewer
   * has already loaded. Read state is taken from the provider too, so marking
   * something read in the navbar bell is reflected here without a reload.
   */
  useEffect(() => {
    if (!liveItems.length) return;

    setItems((current) => {
      const byId = new Map(liveItems.map((row) => [row.id, row]));
      let changed = false;

      const merged = current.map((row) => {
        const live = byId.get(row.id);
        if (live && live.read !== row.read) {
          changed = true;
          return { ...row, read: live.read };
        }
        return row;
      });

      const known = new Set(current.map((row) => row.id));
      const fresh = liveItems.filter((row) => !known.has(row.id) && matchesFilter(row, filter));
      if (!fresh.length) return changed ? merged : current;

      return [...fresh, ...merged].sort(newestFirst);
    });
  }, [liveItems, filter]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchInbox({
        cursor,
        limit: 25,
        unreadOnly: filter === "unread",
        category: filter === "all" || filter === "unread" ? null : filter,
      });
      // Deduped on append: a notification that arrived since the first page was
      // fetched shifts the window, and the cursor's tiebreak makes an overlap
      // unlikely rather than impossible.
      setItems((current) => {
        const seen = new Set(current.map((row) => row.id));
        return [...current, ...page.items.filter((row) => !seen.has(row.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setError("Couldn't load more.");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpen = (notification: AppNotification) => {
    open(notification);
    setItems((current) =>
      current.map((row) => (row.id === notification.id ? { ...row, read: true } : row))
    );
    router.push(notification.deepLink || "/");
  };

  const handleArchive = (id: string) => {
    setItems((current) => current.filter((row) => row.id !== id));
    archive(id);
  };

  const handleRowRead = (notification: AppNotification) => {
    if (notification.read) return;
    setItems((current) =>
      current.map((row) => (row.id === notification.id ? { ...row, read: true } : row))
    );
    markRead(notification.id);
  };

  const handleClearRead = async () => {
    setItems((current) => current.filter((row) => !row.read));
    await archiveRead().catch(() => {});
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-nx-bg">
        <Navbar />
        <div className="h-14" />
      </div>
    );
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: unread ? `Unread (${unread})` : "Unread" },
    ...categories.map((category) => ({ key: category.key as Filter, label: category.label })),
  ];

  return (
    <div className="min-h-screen bg-nx-bg text-nx-ink">
      <Navbar />
      <div className="h-14" />

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            <p className="mt-1 text-[13px] text-nx-muted">
              {unread > 0
                ? `${unread} unread`
                : "Everything here has been read."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] font-medium text-nx-muted transition hover:border-white/25 hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={handleClearRead}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] font-medium text-nx-muted transition hover:border-white/25 hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
            >
              Clear read
            </button>
            <Link
              href="/settings/notifications"
              className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[12px] font-medium text-nx-muted transition hover:border-white/25 hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
            >
              <FaCog className="text-[11px]" aria-hidden />
              Settings
            </Link>
          </div>
        </header>

        {/* Horizontally scrollable rather than wrapped: nine chips on a phone
            would take three lines and push the list below the fold. */}
        <nav
          aria-label="Filter notifications"
          className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
        >
          {filters.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setFilter(entry.key)}
              aria-pressed={filter === entry.key}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition focus:outline-none focus-visible:nx-focus",
                filter === entry.key
                  ? "border-white/25 bg-white/10 text-nx-ink"
                  : "border-white/10 text-nx-muted hover:border-white/20 hover:text-nx-ink"
              )}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        <section className="mt-4 overflow-hidden rounded-xl border border-white/[0.07] bg-nx-surface/60">
          {error && (
            <p className="border-b border-white/[0.07] bg-red-500/10 px-4 py-3 text-[12px] text-red-300">
              {error}
            </p>
          )}

          {loading ? (
            <RowSkeleton rows={5} />
          ) : items.length === 0 ? (
            <EmptyInbox filtered={filter !== "all"} />
          ) : (
            <>
              <ul className="divide-y divide-white/[0.06]">
                {items.map((notification) => (
                  <li key={notification.id} className="relative">
                    <NotificationRow
                      notification={notification}
                      onOpen={handleOpen}
                      onArchive={handleArchive}
                    />
                    {!notification.read && (
                      // A way to clear the badge without opening the thing. The
                      // dropdown has no room for this; a full page does.
                      <button
                        type="button"
                        onClick={() => handleRowRead(notification)}
                        className="absolute bottom-2 right-2 rounded px-2 py-1 text-[11px] text-nx-dim opacity-0 transition hover:bg-white/10 hover:text-nx-ink focus:opacity-100 focus:outline-none focus-visible:nx-focus group-hover:opacity-100 sm:opacity-0"
                      >
                        Mark read
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {cursor && (
                <div className="border-t border-white/[0.07] p-3 text-center">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-full border border-white/10 px-4 py-1.5 text-[12px] font-medium text-nx-muted transition hover:border-white/25 hover:text-nx-ink disabled:opacity-50 focus:outline-none focus-visible:nx-focus"
                  >
                    {loadingMore ? "Loading…" : "Load older"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
