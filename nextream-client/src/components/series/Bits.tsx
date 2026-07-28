"use client";

import { cn } from "@/lib/cn";

/**
 * One gutter for the whole section.
 *
 * Row headers, scrollers, the toolbar and the grid all have to start on the
 * same vertical line — when they drifted apart (px-4 here, container mx-auto
 * there) the page read as a stack of unrelated widgets rather than one shelf.
 */
export const GUTTER = "px-4 sm:px-6 md:px-12 2xl:px-16";

/** Small caps label used for maturity, status and quality flags. */
export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "outline" | "glass";
  className?: string;
}) {
  const tones = {
    neutral: "bg-white/10 text-nx-ink",
    accent: "bg-nx-accent text-white",
    outline: "border border-nx-line text-nx-muted",
    glass: "border border-white/20 bg-black/55 text-nx-ink backdrop-blur-sm",
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
      className={cn("h-1 w-full overflow-hidden bg-white/25", className)}
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

/** The green "% Match" streaming services lead their metadata with. */
export function MatchScore({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  return (
    <span className={cn("font-bold text-emerald-400", className)}>
      {score}% Match
    </span>
  );
}

/**
 * The oversized numeral behind a Top 10 poster.
 *
 * Drawn as SVG text rather than a styled <span> so it scales with the tile and
 * ignores the viewer's font settings — a rank glyph that reflows is the one
 * thing that breaks a row's alignment.
 *
 * Size comes entirely from the caller's box: `meet` keeps the glyph inside it,
 * so the numeral can never spill left into the neighbouring tile no matter how
 * the row is sized. Anchoring bottom-right (`xMaxYMax`) puts every rank flush
 * against the poster's left edge and seated on its baseline.
 *
 * One viewBox for every rank, with multi-digit ranks condensed into it via
 * `textLength`. Widening the box for "10" instead — which is what this did
 * before — makes `meet` scale it down to fit, so the last tile in the row ends
 * up with a visibly shorter numeral than the nine before it.
 */
export function RankNumeral({ rank }: { rank: number }) {
  const label = String(rank);

  return (
    <svg
      viewBox="0 0 100 104"
      className="h-full w-full"
      aria-hidden
      preserveAspectRatio="xMaxYMax meet"
    >
      <text
        x="50"
        y="99"
        textAnchor="middle"
        textLength={label.length > 1 ? 92 : undefined}
        lengthAdjust="spacingAndGlyphs"
        fontSize="132"
        fontWeight="900"
        fill="#15151d"
        stroke="#4e4e5e"
        strokeWidth="3"
        strokeLinejoin="round"
        style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}
      >
        {label}
      </text>
    </svg>
  );
}

/**
 * Page indicator for a horizontal row, in the top-right corner of its header.
 *
 * Cheap orientation on a rail that can be twenty tiles long: without it there
 * is nothing to say how much is left, because the scrollbar is hidden.
 */
export function ScrollDots({
  count,
  active,
  className,
}: {
  count: number;
  active: number;
  className?: string;
}) {
  if (count < 2) return null;

  return (
    <div className={cn("flex items-center gap-1", className)} aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "h-0.5 w-3 rounded-full transition-colors duration-300",
            index === active ? "bg-nx-ink" : "bg-white/25"
          )}
        />
      ))}
    </div>
  );
}
