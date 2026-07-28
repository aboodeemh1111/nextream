import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Empty and error states share one shape so "nothing here yet" always offers
 * the action that fixes it, instead of the bare "No TV shows found." the list
 * used to render.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "rounded-card border border-dashed px-6 py-12",
        tone === "danger"
          ? "border-danger/40 bg-danger-soft/40"
          : "border-border bg-surface-2/40",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "mb-3 flex h-11 w-11 items-center justify-center rounded-full text-lg",
            tone === "danger"
              ? "bg-danger-soft text-danger"
              : "bg-surface-2 text-muted-foreground"
          )}
          aria-hidden
        >
          {icon}
        </div>
      )}
      <h3 className="font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4 flex items-center gap-2">{action}</div>}
    </div>
  );
}
