import { cn } from "@/lib/cn";

export type ProgressTone = "primary" | "success" | "danger" | "muted";

const TONES: Record<ProgressTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  danger: "bg-danger",
  muted: "bg-border-strong",
};

export function Progress({
  value,
  tone = "primary",
  className,
  label,
  indeterminate = false,
}: {
  /** 0-100. Clamped, so a rounding error cannot overflow the track. */
  value: number;
  tone?: ProgressTone;
  className?: string;
  label?: string;
  indeterminate?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out",
          TONES[tone],
          indeterminate && "w-1/3 animate-pulse"
        )}
        style={indeterminate ? undefined : { width: `${clamped}%` }}
      />
    </div>
  );
}
