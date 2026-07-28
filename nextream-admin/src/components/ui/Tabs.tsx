"use client";

import { useCallback, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  /** Rendered as a small count pill after the label. */
  count?: number;
}

/**
 * Roving-tabindex tablist: one tab stop for the whole group, arrow keys move
 * between tabs, Home/End jump to the ends.
 */
export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const index = items.findIndex((item) => item.id === value);
      if (index === -1) return;

      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % items.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;
      else return;

      event.preventDefault();
      onChange(items[next].id);
      listRef.current
        ?.querySelectorAll<HTMLButtonElement>("[role='tab']")
        [next]?.focus();
    },
    [items, value, onChange]
  );

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        "flex items-center gap-1 border-b border-border overflow-x-auto scroll-x",
        className
      )}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            id={`${baseId}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap",
              "border-b-2 -mb-px transition-colors duration-150",
              selected
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border-strong"
            )}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                  selected
                    ? "bg-primary-soft text-primary-soft-foreground"
                    : "bg-surface-2 text-muted-foreground"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  active,
  children,
  className,
}: {
  id: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div role="tabpanel" aria-labelledby={`tab-${id}`} className={cn("animate-in", className)}>
      {children}
    </div>
  );
}
