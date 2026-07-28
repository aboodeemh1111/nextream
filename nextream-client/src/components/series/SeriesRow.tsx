"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { ContinueEntry, HubRow, TVShow } from "@/lib/tv";
import { cn } from "@/lib/cn";
import SeriesCard from "./SeriesCard";
import ContinueCard from "./ContinueCard";

interface SeriesRowProps {
  row: HubRow;
  onListChange?: (showId: string, inMyList: boolean) => void;
  onContinueRemoved?: (showId: string) => void;
}

/** Tile widths per row style. Poster rows fit more per screen than 16:9 ones. */
const WIDTHS = {
  poster: "w-[41vw] sm:w-[28vw] md:w-[21vw] lg:w-[16vw] xl:w-[13vw]",
  ranked: "w-[62vw] sm:w-[44vw] md:w-[33vw] lg:w-[25vw] xl:w-[21vw]",
  continue: "w-[74vw] sm:w-[46vw] md:w-[34vw] lg:w-[26vw] xl:w-[22vw]",
} as const;

/**
 * A horizontally scrolling row.
 *
 * Uses the browser's own scroller rather than a translateX carousel. The old
 * MovieList paged by transforming a flex track, which meant trackpad and touch
 * gestures fought the transform, keyboard users could not reach off-screen
 * cards at all, and the page count went stale whenever the breakpoint changed.
 * Native scrolling gets all of that for free; the arrows just call scrollBy.
 */
export default function SeriesRow({
  row,
  onListChange,
  onContinueRemoved,
}: SeriesRowProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const syncEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // 4px of slack: sub-pixel widths make an exact comparison flicker.
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    syncEdges();
    el.addEventListener("scroll", syncEdges, { passive: true });

    // Arrows must also re-evaluate when the row itself resizes — a window
    // resize alone misses cards arriving after a fetch.
    const observer = new ResizeObserver(syncEdges);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", syncEdges);
      observer.disconnect();
    };
  }, [syncEdges, row.items.length]);

  const page = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.92, behavior: "smooth" });
  };

  if (!row.items.length) return null;

  const variant = row.kind === "continue" ? "continue" : row.ranked ? "ranked" : "poster";
  const exploreHref = row.genre ? `/series?genre=${encodeURIComponent(row.genre)}` : null;

  return (
    <section className="group/row relative" aria-labelledby={`row-${row.key}`}>
      <div className="mb-1 flex items-end justify-between px-4 md:px-12">
        <h2
          id={`row-${row.key}`}
          className="text-base font-semibold text-nx-ink sm:text-lg md:text-xl"
        >
          {row.title}
        </h2>
        {exploreHref && (
          <Link
            href={exploreHref}
            className="text-xs text-nx-muted opacity-0 transition hover:text-nx-ink focus:opacity-100 group-hover/row:opacity-100"
          >
            Explore all &rarr;
          </Link>
        )}
      </div>

      <div className="relative">
        {(["left", "right"] as const).map((side) => {
          const enabled = edges[side];
          return (
            <button
              key={side}
              type="button"
              onClick={() => page(side === "left" ? -1 : 1)}
              aria-label={side === "left" ? "Scroll left" : "Scroll right"}
              tabIndex={enabled ? 0 : -1}
              className={cn(
                "absolute top-0 bottom-0 z-20 hidden w-10 items-center justify-center bg-nx-black/65 text-lg text-white transition md:flex",
                side === "left" ? "left-0" : "right-0",
                enabled
                  ? "opacity-0 hover:bg-nx-black/85 focus:opacity-100 group-hover/row:opacity-100"
                  : "pointer-events-none opacity-0"
              )}
            >
              {side === "left" ? <FaChevronLeft /> : <FaChevronRight />}
            </button>
          );
        })}

        <div
          ref={scrollerRef}
          // py-6 gives the hover scale somewhere to grow: overflow-x:auto forces
          // overflow-y to auto too, so anything past the box would be clipped.
          className="nx-scroll-x flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-4 py-6 md:gap-3 md:px-12"
        >
          {row.items.map((item, index) => (
            <div
              key={row.kind === "continue"
                ? (item as ContinueEntry).show._id
                : (item as TVShow)._id}
              className={cn("shrink-0 snap-start", WIDTHS[variant])}
            >
              {row.kind === "continue" ? (
                <ContinueCard
                  entry={item as ContinueEntry}
                  onRemoved={onContinueRemoved}
                />
              ) : (
                <SeriesCard
                  show={item as TVShow}
                  rank={row.ranked ? index + 1 : undefined}
                  onListChange={onListChange}
                  priority={index < 4}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
