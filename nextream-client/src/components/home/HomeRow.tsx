"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { ContinueItem, HomeRowData, MediaItem } from "@/lib/home";
import { cn } from "@/lib/cn";
import { GUTTER, ScrollDots } from "@/components/series/Bits";
import MediaCard from "./MediaCard";
import ContinueTile from "./ContinueTile";

interface HomeRowProps {
  row: HomeRowData;
  onListChange?: (uid: string, inMyList: boolean) => void;
  onContinueRemoved?: (uid: string) => void;
}

/** Tile widths per row style. Poster rows fit more per screen than 16:9 ones. */
const WIDTHS = {
  poster: "w-[40vw] sm:w-[27vw] md:w-[20vw] lg:w-[15.5vw] xl:w-[13vw] 2xl:w-[11.5vw]",
  ranked: "w-[62vw] sm:w-[43vw] md:w-[32vw] lg:w-[25vw] xl:w-[20.5vw] 2xl:w-[18vw]",
  continue: "w-[76vw] sm:w-[47vw] md:w-[35vw] lg:w-[27vw] xl:w-[22vw] 2xl:w-[19vw]",
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
export default function HomeRow({ row, onListChange, onContinueRemoved }: HomeRowProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [pages, setPages] = useState({ count: 1, active: 0 });

  const syncEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // 4px of slack: sub-pixel widths make an exact comparison flicker.
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
    const count = Math.max(1, Math.ceil(el.scrollWidth / Math.max(1, el.clientWidth)));
    setPages({
      count,
      active: Math.min(count - 1, Math.round(el.scrollLeft / Math.max(1, el.clientWidth))),
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

  const ranked = row.kind === "media" && row.ranked;
  const variant = row.kind === "continue" ? "continue" : ranked ? "ranked" : "poster";
  // Only My List has a page that shows the same thing this row is a slice of.
  // A genre row spans both collections and there is nowhere that browses both,
  // so it gets no link rather than one that drops half its titles.
  const exploreHref = row.key === "myList" ? "/mylist" : null;

  return (
    <section className="group/row relative" aria-labelledby={`row-${row.key}`}>
      <div className={cn("flex items-end justify-between gap-4 pb-1", GUTTER)}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-3">
            <h2
              id={`row-${row.key}`}
              className="truncate text-[15px] font-bold tracking-tight text-nx-ink sm:text-lg md:text-xl"
            >
              {row.title}
            </h2>

            {exploreHref && (
              <Link
                href={exploreHref}
                className="group/explore hidden shrink-0 -translate-x-1 items-center gap-1 text-xs font-semibold text-nx-cyan opacity-0 transition-all duration-300 hover:text-nx-ink focus:outline-none focus-visible:translate-x-0 focus-visible:opacity-100 group-hover/row:translate-x-0 group-hover/row:opacity-100 md:inline-flex"
              >
                Explore all
                <FaChevronRight className="text-[9px] transition-transform duration-300 group-hover/explore:translate-x-0.5" />
              </Link>
            )}
          </div>

          {/* Why this row exists. The whole point of ranking per viewer is lost
              if the page cannot say what it ranked on. */}
          {row.kind === "media" && row.subtitle && (
            <p className="mt-0.5 truncate text-[11px] text-nx-dim sm:text-xs">{row.subtitle}</p>
          )}
        </div>

        <ScrollDots
          count={pages.count}
          active={pages.active}
          className="hidden shrink-0 pb-1 opacity-0 transition-opacity duration-300 group-hover/row:opacity-100 md:flex"
        />
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
              aria-hidden={!enabled}
              className={cn(
                "absolute bottom-0 top-0 z-30 hidden w-10 items-center justify-center transition-opacity duration-300 md:flex lg:w-12",
                side === "left"
                  ? "left-0 bg-gradient-to-r from-nx-bg via-nx-bg/80 to-transparent"
                  : "right-0 bg-gradient-to-l from-nx-bg via-nx-bg/80 to-transparent",
                enabled
                  ? "opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100"
                  : "pointer-events-none opacity-0"
              )}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-sm text-white shadow-lg ring-1 ring-white/15 backdrop-blur-sm transition duration-200 hover:scale-110 hover:bg-black/85">
                {side === "left" ? <FaChevronLeft /> : <FaChevronRight />}
              </span>
            </button>
          );
        })}

        <div
          ref={scrollerRef}
          // py-5 gives the hover scale somewhere to grow: overflow-x:auto forces
          // overflow-y to auto too, so anything past the box would be clipped.
          // scroll-p* keeps a snapped tile on the gutter instead of flush with
          // the viewport edge.
          className={cn(
            "nx-scroll-x flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth py-5 scroll-px-4 sm:scroll-px-6 md:gap-3 md:scroll-px-12 2xl:scroll-px-16",
            GUTTER
          )}
        >
          {row.kind === "continue"
            ? (row.items as ContinueItem[]).map((entry) => (
                <div
                  key={entry.item.uid}
                  className={cn("shrink-0 snap-start", WIDTHS.continue)}
                >
                  <ContinueTile entry={entry} onRemoved={onContinueRemoved} />
                </div>
              ))
            : (row.items as MediaItem[]).map((item, index) => (
                <div key={item.uid} className={cn("shrink-0 snap-start", WIDTHS[variant])}>
                  <MediaCard
                    item={item}
                    rank={ranked ? index + 1 : undefined}
                    onListChange={onListChange}
                    priority={index < 4}
                  />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
