"use client";

import type { IconType } from "react-icons";
import {
  FaBell,
  FaBullhorn,
  FaComment,
  FaEnvelopeOpenText,
  FaFilm,
  FaPlayCircle,
  FaShieldAlt,
  FaStar,
} from "react-icons/fa";
import { cn } from "@/lib/cn";
import { AppNotification, NotificationCategory, relativeTime } from "@/lib/notifications";

/**
 * The parts the bell, the inbox page and the toast all share.
 *
 * One row component rather than three, because the row is where every detail
 * that matters lives — the unread dot, the artwork fallback, the reason line,
 * the relative timestamp — and three copies of it would drift apart the first
 * time any one of them was adjusted.
 */

/**
 * A glyph per category.
 *
 * Colour is doing real work here rather than decoration: with seven categories in
 * one list, the icon is what lets someone find "the one about my comment" without
 * reading every title. Account is the only red one, so a security notice never
 * reads as another new release.
 */
const CATEGORY_STYLE: Record<NotificationCategory, { icon: IconType; className: string }> = {
  new_content: { icon: FaFilm, className: "bg-nx-accent/15 text-nx-accent-soft" },
  continue_watching: { icon: FaPlayCircle, className: "bg-nx-cyan/15 text-nx-cyan" },
  recommendations: { icon: FaStar, className: "bg-nx-violet/15 text-nx-violet" },
  social: { icon: FaComment, className: "bg-emerald-400/15 text-emerald-300" },
  digest: { icon: FaEnvelopeOpenText, className: "bg-amber-400/15 text-amber-300" },
  product: { icon: FaBullhorn, className: "bg-white/10 text-nx-muted" },
  account: { icon: FaShieldAlt, className: "bg-red-500/20 text-red-300" },
};

export function CategoryIcon({
  category,
  className,
}: {
  category: NotificationCategory;
  className?: string;
}) {
  const style = CATEGORY_STYLE[category] || { icon: FaBell, className: "bg-white/10 text-nx-muted" };
  const Icon = style.icon;

  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        style.className,
        className
      )}
      aria-hidden
    >
      <Icon className="text-[13px]" />
    </span>
  );
}

interface RowProps {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
  onArchive?: (id: string) => void;
  /** Compact drops the artwork and tightens the padding, for the dropdown. */
  compact?: boolean;
}

/**
 * One notification.
 *
 * A button rather than a link, even though it navigates: the click has to record
 * engagement before the route changes, and an anchor would have the navigation
 * race the beacon. The href is still announced through `aria-describedby`-free
 * plain text — the title and body say where it goes.
 */
export function NotificationRow({ notification, onOpen, onArchive, compact }: RowProps) {
  const unread = !notification.read;

  return (
    <div
      className={cn(
        "group relative flex w-full items-start gap-3 transition-colors",
        unread ? "bg-white/[0.03]" : "bg-transparent",
        "hover:bg-white/[0.06]"
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className={cn(
          "flex min-w-0 flex-1 items-start gap-3 text-left focus:outline-none focus-visible:nx-focus",
          compact ? "px-4 py-3" : "px-4 py-4 sm:px-5"
        )}
      >
        <CategoryIcon category={notification.category} />

        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 text-[13px] leading-snug",
                unread ? "font-semibold text-nx-ink" : "text-nx-muted"
              )}
            >
              {notification.title}
            </span>
            {unread && (
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-nx-accent"
                aria-label="Unread"
              />
            )}
          </span>

          {notification.body && (
            <span className="mt-1 line-clamp-2 block text-[12px] leading-relaxed text-nx-muted">
              {notification.body}
            </span>
          )}

          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-nx-dim">
            <span>{relativeTime(notification.createdAt)}</span>
            {/* The reason is the whole difference between an interruption and a
                suggestion: it tells the viewer which of their own behaviours
                produced this, which is also what makes it arguable. */}
            {notification.reason && (
              <>
                <span aria-hidden>·</span>
                <span className="text-nx-muted">{notification.reason}</span>
              </>
            )}
          </span>
        </span>

        {!compact && notification.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={notification.image}
            alt=""
            loading="lazy"
            className="hidden h-14 w-24 shrink-0 rounded-md object-cover sm:block"
          />
        )}
      </button>

      {onArchive && (
        <button
          type="button"
          onClick={() => onArchive(notification.id)}
          aria-label={`Dismiss: ${notification.title}`}
          className={cn(
            "absolute right-2 top-2 rounded-md p-1.5 text-nx-dim transition",
            // Revealed on hover and always available to the keyboard, so the
            // control is discoverable without adding a second glyph to every row.
            "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
            "hover:bg-white/10 hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
          )}
        >
          <span className="block h-3 w-3 text-[11px] leading-3" aria-hidden>
            ✕
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * The empty state.
 *
 * Says what will appear here rather than only that nothing has. "Nothing new"
 * leaves a viewer unsure whether the feature works; naming what arrives makes the
 * empty inbox read as up to date.
 */
export function EmptyInbox({ filtered }: { filtered?: boolean }) {
  return (
    <div className="px-6 py-12 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
        <FaBell className="text-[15px] text-nx-dim" aria-hidden />
      </span>
      <p className="mt-3 text-[13px] font-medium text-nx-ink">
        {filtered ? "Nothing here" : "You're all caught up"}
      </p>
      <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-nx-muted">
        {filtered
          ? "Try another category, or clear the filter."
          : "New episodes of shows you watch, replies to your comments, and titles picked for you will show up here."}
      </p>
    </div>
  );
}

/** Placeholder rows, sized to the real ones so the list does not jump on load. */
export function RowSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-white/[0.06]" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="flex items-start gap-3 px-4 py-4">
          <span className="h-8 w-8 shrink-0 rounded-lg bg-white/[0.07]" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block h-3 w-2/3 rounded bg-white/[0.07]" />
            <span className="block h-3 w-full rounded bg-white/[0.05]" />
            <span className="block h-2.5 w-20 rounded bg-white/[0.04]" />
          </span>
        </li>
      ))}
    </ul>
  );
}
