"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface CircleActionProps {
  /** Rendered when the title is not in the list. */
  icon: React.ReactNode;
  /** Rendered when it is. Falls back to `icon`. */
  activeIcon?: React.ReactNode;
  /** Tooltip and accessible name for each state. */
  label: string;
  activeLabel: string;
  active: boolean;
  busy?: boolean;
  /** Ring/glow colour once active. */
  tone?: "white" | "accent" | "cyan";
  onClick: () => void;
}

const TONES = {
  white: "border-white bg-white/15 text-white",
  accent: "border-nx-accent bg-nx-accent/20 text-nx-accent-soft",
  cyan: "border-nx-cyan bg-nx-cyan/15 text-nx-cyan",
} as const;

/**
 * The round icon toggle from a streaming detail header.
 *
 * State is owned by the caller — the page already tracks list membership for
 * three lists and a local copy would drift from it the moment a request fails.
 *
 * The confirmation pop is replayed by remounting the glyph on a click counter.
 * Restarting a CSS animation otherwise means removing the class, forcing a
 * reflow and re-adding it; a key bump does the same work declaratively, and
 * it fires on every press rather than only on the first.
 */
export default function CircleAction({
  icon,
  activeIcon,
  label,
  activeLabel,
  active,
  busy = false,
  tone = "white",
  onClick,
}: CircleActionProps) {
  const [pulse, setPulse] = useState(0);
  const text = active ? activeLabel : label;

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={() => {
          setPulse((n) => n + 1);
          onClick();
        }}
        disabled={busy}
        aria-pressed={active}
        aria-label={text}
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-full border-2 backdrop-blur",
          "transition duration-200 hover:scale-110 focus:outline-none focus-visible:nx-focus",
          "disabled:cursor-not-allowed disabled:opacity-60",
          active
            ? TONES[tone]
            : "border-white/40 bg-black/40 text-nx-ink hover:border-white hover:bg-black/60"
        )}
      >
        {busy ? (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white"
            role="status"
            aria-label="Saving"
          />
        ) : (
          <span key={pulse} className="animate-nx-pop text-base">
            {active ? activeIcon ?? icon : icon}
          </span>
        )}
      </button>

      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap",
          "rounded bg-nx-elevated px-2.5 py-1 text-xs font-semibold text-nx-ink opacity-0 shadow-lg",
          "transition duration-150 group-hover:translate-y-0 group-hover:opacity-100",
          "group-focus-within:translate-y-0 group-focus-within:opacity-100"
        )}
      >
        {text}
      </span>
    </span>
  );
}
