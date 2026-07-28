"use client";

import { cn } from "@/lib/cn";

/** Small caps label used for maturity, status and quality flags. */
export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "outline";
  className?: string;
}) {
  const tones = {
    neutral: "bg-white/10 text-nx-ink",
    accent: "bg-nx-accent text-white",
    outline: "border border-nx-line text-nx-muted",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Resume indicator. Rounded to a whole percent so it never renders a sliver. */
export function ProgressBar({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className={cn("h-[3px] w-full overflow-hidden bg-white/25", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full bg-nx-accent" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white",
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Separates metadata with a middot without leaving a trailing one. */
export function MetaLine({
  parts,
  className,
}: {
  parts: Array<string | null | undefined | false>;
  className?: string;
}) {
  const kept = parts.filter(Boolean) as string[];
  if (!kept.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {kept.map((part, index) => (
        <span key={`${part}-${index}`} className="flex items-center gap-2">
          {index > 0 && <span className="text-nx-dim" aria-hidden>&middot;</span>}
          <span>{part}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * The oversized numeral behind a Top 10 poster.
 *
 * Drawn as SVG text rather than a styled <span> so the outline sits at a fixed
 * size regardless of the viewer's font settings — a rank glyph that reflows is
 * the one thing that breaks the row's alignment.
 */
export function RankNumeral({ rank }: { rank: number }) {
  return (
    <svg
      viewBox="0 0 100 140"
      className="h-full w-full"
      aria-hidden
      preserveAspectRatio="xMidYMax meet"
    >
      <text
        x="50"
        y="132"
        textAnchor="middle"
        fontSize="150"
        fontWeight="800"
        fill="#0a0a0e"
        stroke="#6f6f7d"
        strokeWidth="2.5"
        style={{ fontFamily: "inherit" }}
      >
        {rank}
      </text>
    </svg>
  );
}
