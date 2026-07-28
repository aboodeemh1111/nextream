"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A real checkbox under a styled track: keyboard, form semantics and screen
 * reader behaviour come free, and the whole row is the hit target.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  id,
  // Required when there is no visible label — a bare switch in a row of
  // episodes announces as an unnamed checkbox otherwise.
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex items-start gap-3 cursor-pointer select-none",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
    >
      <span className="relative inline-flex shrink-0 mt-0.5">
        <input
          id={inputId}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            "h-5 w-9 rounded-full transition-colors duration-150",
            "bg-border-strong peer-checked:bg-primary",
            "peer-focus-visible:outline peer-focus-visible:outline-2",
            "peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-card",
            "transition-transform duration-150 peer-checked:translate-x-4"
          )}
        />
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && (
            <span className="block text-sm font-medium text-foreground">{label}</span>
          )}
          {description && (
            <span className="block text-xs text-muted-foreground mt-0.5">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
}
