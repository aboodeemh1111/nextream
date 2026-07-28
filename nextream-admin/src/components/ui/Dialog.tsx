"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export type DialogSize = "sm" | "md" | "lg" | "xl" | "full";

const SIZES: Record<DialogSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-[min(92rem,95vw)]",
};

/**
 * The previous modals were bare divs: no focus management, no Escape on most of
 * them, no aria-modal, and the page behind kept scrolling. Focus moves in on
 * open, is trapped while open, and returns to the trigger on close.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  /** Set false for destructive flows that should not close by accident. */
  dismissOnBackdrop = true,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  dismissOnBackdrop?: boolean;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Focus the first control rather than the panel itself, so typing starts
    // where the user expects.
    const focusTimer = window.setTimeout(() => {
      const target =
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current;
      target?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = overflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-overlay animate-in"
        onClick={dismissOnBackdrop ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "relative w-full bg-popover text-popover-foreground",
          "border border-border shadow-overlay animate-in-up",
          "rounded-t-card sm:rounded-card",
          "max-h-[92vh] flex flex-col",
          SIZES[size],
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close dialog" variant="ghost" onClick={onClose}>
            <FaTimes />
          </IconButton>
        </div>

        <div className="px-5 py-4 overflow-y-auto scroll-y flex-1">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/**
 * Same machinery, docked to the right edge. Used for editing one record without
 * losing the list behind it — the old app navigated to a separate route for
 * every episode edit and came back to a page that had forgotten its state.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      const target =
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current;
      target?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = overflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      ).filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-overlay animate-in" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "relative h-full w-full max-w-2xl bg-popover text-popover-foreground",
          "border-l border-border shadow-overlay flex flex-col animate-in",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-foreground truncate">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <IconButton label="Close panel" variant="ghost" onClick={onClose}>
            <FaTimes />
          </IconButton>
        </div>

        <div className="px-5 py-4 overflow-y-auto scroll-y flex-1">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
