"use client";

import { FaFilm, FaPlay, FaTv } from "react-icons/fa";
import Art from "@/components/series/Art";
import { cn } from "@/lib/cn";
import { highlightParts, SearchResult } from "@/lib/search";

/**
 * The query, marked up inside the result title.
 *
 * The ranges come from the API rather than being re-derived here: the server is
 * the only place that knows *why* a result matched, so it is the only place that
 * can underline the right characters when the match was an acronym ("kds") or a
 * typo ("totro").
 */
export function Highlight({
  text,
  ranges,
  className,
}: {
  text: string;
  ranges: Array<[number, number]>;
  className?: string;
}) {
  return (
    <span className={className}>
      {highlightParts(text, ranges).map((part, index) =>
        part.hit ? (
          <mark
            key={index}
            className="bg-transparent font-bold text-nx-cyan [text-shadow:0_0_18px_rgb(34_211_238/0.45)]"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  );
}

/** A keyboard key, drawn as one. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[1.35rem] items-center justify-center rounded border border-white/15 bg-white/[0.07] px-1.5 py-0.5 font-sans text-[10px] font-semibold leading-none text-nx-muted",
        className
      )}
    >
      {children}
    </kbd>
  );
}

export function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3 pb-1.5 pt-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-nx-dim">
        {children}
      </span>
      {action}
    </div>
  );
}

/**
 * Poster thumbnail for a result row.
 *
 * Episodes get a 16:9 still because that is the shape the artwork is authored
 * in; titles get a portrait poster. Using one aspect for both would letterbox
 * half the panel.
 */
export function Thumb({ result }: { result: SearchResult }) {
  const wide = result.kind === "episode";
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md bg-nx-surface ring-1 ring-white/10",
        wide ? "h-11 w-[4.6rem]" : "h-14 w-10"
      )}
    >
      <Art
        src={result.poster}
        alt=""
        fallbackLabel={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}

export function KindIcon({ kind, className }: { kind: SearchResult["kind"]; className?: string }) {
  if (kind === "movie") return <FaFilm className={className} aria-hidden />;
  if (kind === "episode") return <FaPlay className={className} aria-hidden />;
  return <FaTv className={className} aria-hidden />;
}

/** The green "% Match", shown only where the API had a taste profile to back it. */
export function Match({ score }: { score: number | null }) {
  if (!score) return null;
  return <span className="font-semibold text-emerald-400">{score}% match</span>;
}
