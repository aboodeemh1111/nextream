import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "primary";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-muted-foreground border-border",
  success: "bg-success-soft text-success-soft-foreground border-success/25",
  warning: "bg-warning-soft text-warning-soft-foreground border-warning/25",
  danger: "bg-danger-soft text-danger-soft-foreground border-danger/25",
  info: "bg-info-soft text-info-soft-foreground border-info/25",
  primary: "bg-primary-soft text-primary-soft-foreground border-primary/25",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        "text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/** The one place the published/draft vocabulary is defined. */
export function PublishBadge({
  published,
  children,
}: {
  published?: boolean;
  children?: ReactNode;
}) {
  return (
    <Badge tone={published ? "success" : "warning"} dot>
      {children ?? (published ? "Published" : "Draft")}
    </Badge>
  );
}
