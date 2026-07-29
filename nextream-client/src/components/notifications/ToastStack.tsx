"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/context/NotificationsContext";
import { AppNotification } from "@/lib/notifications";
import { cn } from "@/lib/cn";
import { CategoryIcon } from "./Bits";

/**
 * In-app toasts for notifications that arrive while the viewer is here.
 *
 * The alternative — letting the browser show its own banner — is worse in the one
 * case this handles: the viewer is looking at the page, and an OS notification
 * over the top of it is an interruption to tell them about something they are
 * already in front of. The service worker suppresses its banner when a visible
 * tab exists (see firebase-messaging-sw.js) and this renders it instead.
 *
 * Deliberately not a general toast system. It renders exactly what
 * NotificationsContext queues, has no imperative API to call from elsewhere, and
 * therefore cannot become the place unrelated success messages accumulate.
 */

/** Long enough to read two lines, short enough not to sit over the page. */
const DISMISS_MS = 7_000;

export default function ToastStack() {
  const { toasts, dismissToast, open } = useNotifications();
  const router = useRouter();

  if (!toasts.length) return null;

  return (
    <div
      // `pointer-events-none` on the stack and `auto` on each card, so the gaps
      // between toasts do not swallow clicks meant for the page behind them.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-4 sm:inset-x-auto sm:right-4 sm:items-end"
      role="region"
      aria-label="New notifications"
    >
      {toasts.map((entry) => (
        <Toast
          key={entry.key}
          notification={entry.notification}
          onDismiss={() => dismissToast(entry.key)}
          onOpen={() => {
            open(entry.notification);
            dismissToast(entry.key);
            router.push(entry.notification.deepLink || "/");
          }}
        />
      ))}
    </div>
  );
}

function Toast({
  notification,
  onOpen,
  onDismiss,
}: {
  notification: AppNotification;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const hovered = useRef(false);

  useEffect(() => {
    // Restarted rather than paused on hover: someone reading a toast should not
    // have it vanish mid-sentence, and tracking elapsed time to resume from is
    // more machinery than the behaviour is worth.
    const timer = setInterval(() => {
      if (!hovered.current) onDismiss();
    }, DISMISS_MS);
    return () => clearInterval(timer);
  }, [onDismiss]);

  return (
    <div
      onMouseEnter={() => {
        hovered.current = true;
      }}
      onMouseLeave={() => {
        hovered.current = false;
      }}
      // `polite`, not `assertive`: a new episode is not worth interrupting a
      // screen reader mid-sentence for.
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-white/10",
        "bg-[#0d0d12]/95 p-3 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.9)] backdrop-blur-2xl animate-nx-rise"
      )}
    >
      <CategoryIcon category={notification.category} />

      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left focus:outline-none focus-visible:nx-focus"
      >
        <span className="block truncate text-[13px] font-semibold text-nx-ink">
          {notification.title}
        </span>
        {notification.body && (
          <span className="mt-0.5 line-clamp-2 block text-[12px] leading-relaxed text-nx-muted">
            {notification.body}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-nx-dim transition hover:bg-white/10 hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
      >
        <span className="block text-[11px] leading-3" aria-hidden>
          ✕
        </span>
      </button>
    </div>
  );
}
