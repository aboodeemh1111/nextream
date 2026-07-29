"use client";

import { useState } from "react";
import Link from "next/link";
import { FaChartBar, FaFilm, FaTv } from "react-icons/fa";
import Art from "@/components/series/Art";
import { Pill } from "@/components/series/Bits";
import { cn } from "@/lib/cn";
import { useTracking } from "@/lib/ml/observe";
import type { Candidate, Surface } from "@/lib/ml/types";

/**
 * A card for a locally ranked title.
 *
 * Deliberately not `MediaCard`. That one renders a `MediaItem` — a server
 * envelope with a resolved href, a play target and My List state — and none of
 * that exists in the catalogue snapshot the browser indexes. Forcing the two
 * together would mean either faking the server's fields or widening its type to
 * carry a score breakdown it has no notion of.
 *
 * What this adds is the part that makes an on-device recommender worth having:
 * it shows its working. Every card states why it is here, and every card can be
 * opened to the actual numbers that put it there — not a rationalisation
 * generated alongside the ranking, but the same breakdown the ranker summed.
 */

/** Where a title lives, derived rather than served — see the note above. */
export function hrefFor(candidate: Candidate): string {
  const { item } = candidate;
  return item.kind === "show" ? `/series/${item.id}` : `/details/${item.id}`;
}

interface NeuralCardProps {
  candidate: Candidate;
  position: number;
  surface: Surface;
  slate?: string;
  query?: string;
  /** Renders the score breakdown control. Off in dense grids. */
  explainable?: boolean;
  className?: string;
}

export default function NeuralCard({
  candidate,
  position,
  surface,
  slate,
  query,
  explainable = true,
  className,
}: NeuralCardProps) {
  const [open, setOpen] = useState(false);
  const { item } = candidate;

  const { ref, onPointerEnter, onPointerLeave, onSelect } = useTracking({
    uid: item.uid,
    surface,
    position,
    slate,
    query,
  });

  const meta = [
    item.year ? String(item.year) : null,
    item.kind === "show"
      ? item.seasons
        ? `${item.seasons} Season${item.seasons === 1 ? "" : "s"}`
        : null
      : item.runtimeMin
        ? `${Math.floor(item.runtimeMin / 60)}h ${item.runtimeMin % 60}m`
        : null,
    item.rating10 ? `★ ${item.rating10.toFixed(1)}` : null,
  ].filter(Boolean) as string[];

  return (
    <article
      ref={ref as (node: HTMLElement | null) => void}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      className={cn("group/nc relative", className)}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-nx-surface shadow-lg shadow-black/40 ring-1 ring-white/10 transition duration-300 group-hover/nc:ring-white/30">
        <Art
          src={item.poster || item.backdrop}
          alt={item.title}
          sizes="(max-width: 640px) 42vw, (max-width: 1024px) 22vw, 15vw"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />

        <Link
          href={hrefFor(candidate)}
          onClick={onSelect}
          aria-label={item.title}
          className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:nx-focus"
        />

        <div className="pointer-events-none absolute left-2 top-2 z-20">
          <Pill tone="glass" className="gap-1">
            {item.kind === "show" ? (
              <FaTv className="text-[8px]" aria-hidden />
            ) : (
              <FaFilm className="text-[8px]" aria-hidden />
            )}
            {item.badge}
          </Pill>
        </div>

        {explainable && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={`Why ${item.title} is here`}
            className={cn(
              "absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] transition focus:outline-none focus-visible:nx-focus",
              open
                ? "border-nx-cyan/70 bg-nx-cyan/20 text-nx-ink"
                : "border-white/25 bg-black/55 text-nx-muted opacity-0 backdrop-blur-sm group-hover/nc:opacity-100 focus-visible:opacity-100"
            )}
          >
            <FaChartBar aria-hidden />
          </button>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2.5">
          <h3 className="line-clamp-2 text-[13px] font-bold leading-tight text-nx-ink">
            {highlighted(item.title, candidate.highlight)}
          </h3>
          {meta.length > 0 && (
            <p className="mt-0.5 truncate text-[10px] text-nx-muted">{meta.join(" · ")}</p>
          )}
        </div>

        {open && <Breakdown candidate={candidate} onClose={() => setOpen(false)} />}
      </div>

      {candidate.reason && (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-nx-dim">
          {candidate.reason}
        </p>
      )}
    </article>
  );
}

/** Query matches, underlined in the title. */
function highlighted(title: string, ranges: Array<[number, number]>): React.ReactNode {
  if (!ranges?.length) return title;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  ranges.forEach(([start, end], index) => {
    const from = Math.max(cursor, Math.min(start, title.length));
    const to = Math.max(from, Math.min(end, title.length));
    if (from > cursor) parts.push(title.slice(cursor, from));
    if (to > from) {
      parts.push(
        <mark key={index} className="bg-transparent text-nx-cyan">
          {title.slice(from, to)}
        </mark>
      );
    }
    cursor = to;
  });

  if (cursor < title.length) parts.push(title.slice(cursor));
  return parts;
}

/**
 * The score, taken apart.
 *
 * Only the signals that actually contributed are listed. A breakdown padded out
 * with nine zeroes reads as a debug dump; four bars that add up to the ranking
 * reads as an explanation.
 */
function Breakdown({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const rows: Array<[string, number]> = [
    ["Query match", candidate.breakdown.lexical],
    ["Meaning", candidate.breakdown.semantic],
    ["Your taste", candidate.breakdown.affinity],
    ["Neural pick", candidate.breakdown.neural],
    ["What follows", candidate.breakdown.sequential],
    ["Rating", candidate.breakdown.quality],
    ["Popularity", candidate.breakdown.popularity],
    ["New here", candidate.breakdown.freshness],
    ["Unseen", candidate.breakdown.exploration],
  ];

  const shown = rows.filter(([, value]) => value > 0.04).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black/92 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-nx-cyan">
          Why this
        </span>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 rounded px-1.5 text-[10px] text-nx-dim transition hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
        >
          Close
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {shown.length === 0 && (
          <p className="text-[11px] leading-relaxed text-nx-muted">
            Nothing scored strongly — this is filling out the row.
          </p>
        )}
        {shown.map(([label, value]) => (
          <div key={label}>
            <div className="flex items-baseline justify-between text-[10px]">
              <span className="text-nx-muted">{label}</span>
              <span className="tabular-nums text-nx-dim">{Math.round(value * 100)}</span>
            </div>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-nx-cyan to-nx-violet"
                style={{ width: `${Math.min(100, Math.round(value * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {candidate.becauseOf && (
        <p className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-snug text-nx-dim">
          Closest to{" "}
          <span className="font-semibold text-nx-muted">{candidate.becauseOf.title}</span> in
          your history ({Math.round(candidate.becauseOf.similarity * 100)}% alike)
        </p>
      )}
    </div>
  );
}
