"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface MenuProps {
  /** Rendered inside the trigger button. */
  trigger: (state: { open: boolean }) => React.ReactNode;
  label: string;
  children: (state: { close: () => void }) => React.ReactNode;
  /** Fired the first time the panel opens, and on every open after. */
  onOpen?: () => void;
  align?: "right" | "left";
  className?: string;
  panelClassName?: string;
}

/**
 * Trigger plus dropdown panel, with the three behaviours every dropdown needs
 * and the old navbar implemented once per menu (and, for the profile menu, not
 * at all — it could only be dismissed by clicking the avatar again).
 *
 * Pointerdown rather than click for the outside-dismiss: a click that starts
 * inside the panel and finishes outside it — dragging to select text, or
 * releasing off a button — is not a request to close.
 */
export default function Menu({
  trigger,
  label,
  children,
  onOpen,
  align = "right",
  className,
  panelClassName,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Focus goes back to the trigger, not to wherever it happened to be —
      // otherwise dismissing with the keyboard strands the tab order.
      root.current?.querySelector("button")?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) onOpen?.();
        }}
        className="flex items-center rounded-full text-nx-muted transition-colors hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
      >
        {trigger({ open })}
      </button>

      {open && (
        <div
          id={panelId}
          role="menu"
          className={cn(
            "absolute top-[calc(100%+0.6rem)] z-50 overflow-hidden rounded-xl border border-white/10 bg-[#0d0d12]/95 shadow-[0_28px_70px_-18px_rgba(0,0,0,0.9)] backdrop-blur-2xl animate-nx-rise",
            align === "right" ? "right-0" : "left-0",
            panelClassName
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}
