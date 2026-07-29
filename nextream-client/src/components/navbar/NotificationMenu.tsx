"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaBell, FaCog } from "react-icons/fa";
import { useNotifications } from "@/context/NotificationsContext";
import { AppNotification } from "@/lib/notifications";
import { cn } from "@/lib/cn";
import { EmptyInbox, NotificationRow, RowSkeleton } from "@/components/notifications/Bits";
import Menu from "./Menu";

/**
 * The bell.
 *
 * State lives in NotificationsContext, not here, and that is the substantive
 * change from the previous version: this used to fetch its own list when the menu
 * opened and count the unread ones in it, so the badge was only ever as current
 * as the last time somebody had opened the dropdown — a notification could sit
 * unseen indefinitely because nothing told the navbar it existed.
 *
 * The panel shows the eight most recent and links out to the full inbox rather
 * than paging inside a dropdown. A scrollable list in a 21rem panel is a worse
 * version of the page that already exists.
 */

/** Enough to answer "what did I miss" without becoming a page. */
const PREVIEW = 8;

export default function NotificationMenu() {
  const { items, unread, loading, connected, refresh, markAllRead, archive, open } =
    useNotifications();
  const router = useRouter();

  const preview = items.slice(0, PREVIEW);

  const handleOpen = (notification: AppNotification, close: () => void) => {
    open(notification);
    close();
    router.push(notification.deepLink || "/");
  };

  return (
    <Menu
      label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      // Refetched on open even with the stream connected: it is the one moment the
      // viewer is definitely looking, and the cost of being wrong here is showing
      // them a list that is missing something.
      onOpen={refresh}
      panelClassName="w-[22rem] max-w-[calc(100vw-2rem)]"
      trigger={({ open: isOpen }) => (
        <span
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
            isOpen
              ? "border-white/25 bg-white/10 text-nx-ink"
              : "border-transparent hover:border-white/15 hover:bg-white/[0.06]"
          )}
        >
          <FaBell className="text-[15px]" aria-hidden />
          {unread > 0 && (
            // A count, not a dot. "You have notifications" is not information a
            // viewer can act on differently from "you have eleven".
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full",
                "bg-nx-accent px-1 text-[10px] font-bold leading-none text-white",
                "ring-2 ring-nx-bg"
              )}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
      )}
    >
      {({ close }) => (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2.5">
            <span className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-nx-dim">
                Notifications
              </span>
              {/* Only shown when it is *not* live. A green dot confirming that
                  things are working is noise; the absence of one when they are
                  not is the thing worth saying. */}
              {!connected && (
                <span
                  className="text-[10px] text-nx-dim"
                  title="Not connected — the list refreshes periodically"
                >
                  offline
                </span>
              )}
            </span>

            <span className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-nx-muted transition hover:bg-white/[0.06] hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
                >
                  Mark all read
                </button>
              )}
              <Link
                href="/settings/notifications"
                onClick={close}
                aria-label="Notification settings"
                className="rounded p-1.5 text-nx-dim transition hover:bg-white/[0.06] hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
              >
                <FaCog className="text-[11px]" aria-hidden />
              </Link>
            </span>
          </div>

          {loading && !preview.length ? (
            <RowSkeleton rows={3} />
          ) : preview.length === 0 ? (
            <EmptyInbox />
          ) : (
            <ul className="max-h-[24rem] divide-y divide-white/[0.06] overflow-y-auto">
              {preview.map((notification) => (
                <li key={notification.id}>
                  <NotificationRow
                    notification={notification}
                    compact
                    onOpen={(row) => handleOpen(row, close)}
                    onArchive={archive}
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-white/[0.07]">
            <Link
              href="/notifications"
              onClick={close}
              className="block px-4 py-2.5 text-center text-[12px] font-medium text-nx-muted transition hover:bg-white/[0.06] hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
            >
              See all notifications
            </Link>
          </div>
        </>
      )}
    </Menu>
  );
}
