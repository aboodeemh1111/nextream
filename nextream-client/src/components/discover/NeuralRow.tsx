"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaSyncAlt } from "react-icons/fa";
import { GUTTER } from "@/components/series/Bits";
import { useNeuralSlate } from "@/hooks/useNeuralSlate";
import { cn } from "@/lib/cn";
import type { RecommendOptions } from "@/lib/ml/types";
import NeuralCard from "./NeuralCard";

/**
 * A row the browser ranked.
 *
 * The header carries something a normal row cannot: the strategy the bandit
 * chose and how well the result matches the viewer's genre mix. That is not
 * decoration. A recommender that quietly switches between "more of the same"
 * and "try this" is unreadable from the outside — the same row heading appears
 * over completely different logic on different days, and nobody can tell
 * whether it got better. Naming the choice makes the system legible, and makes
 * the exploration it does feel deliberate rather than random.
 */

interface NeuralRowProps {
  title: string;
  subtitle?: string;
  options?: RecommendOptions;
  /** Shows the chosen strategy and calibration in the header. */
  diagnostics?: boolean;
  refreshable?: boolean;
  /** Reports what this row placed, so rows below it can exclude the same titles. */
  onPlaced?: (uids: string[]) => void;
}

export default function NeuralRow({
  title,
  subtitle,
  options = {},
  diagnostics = false,
  refreshable = false,
  onPlaced,
}: NeuralRowProps) {
  const { candidates, arm, calibration, slate, loading, refresh } = useNeuralSlate(options);
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  // Keyed on the slate rather than on `candidates`: the array is a new
  // reference on every render of the hook, and reporting on identity would put
  // the page into a render loop through whatever state the callback sets.
  useEffect(() => {
    if (!slate || !candidates.length) return;
    onPlaced?.(candidates.map((candidate) => candidate.item.uid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slate]);

  const measure = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    setEdges({
      start: node.scrollLeft < 8,
      // A row that fits entirely has no end to reach; without the tolerance the
      // right arrow shows on a row of three cards and scrolls nowhere.
      end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 8,
    });
  }, []);

  const nudge = (direction: 1 | -1) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth * 0.85, behavior: "smooth" });
  };

  if (!loading && !candidates.length) return null;

  return (
    <section className="relative">
      <div className={cn("mb-2.5 flex items-end justify-between gap-4", GUTTER)}>
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight text-nx-ink md:text-lg">{title}</h2>
          {(subtitle || (diagnostics && arm)) && (
            <p className="mt-0.5 truncate text-[11px] text-nx-dim">
              {subtitle || (arm ? arm.label : "")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {diagnostics && arm && (
            <span className="hidden items-center gap-2 text-[10px] text-nx-dim sm:flex">
              <span className="rounded-full border border-nx-violet/35 bg-nx-violet/10 px-2 py-0.5 font-semibold text-nx-muted">
                {arm.key}
              </span>
              <span className="tabular-nums" title="How closely this row's genre mix matches yours">
                mix {Math.round(calibration * 100)}%
              </span>
            </span>
          )}

          {refreshable && (
            <button
              type="button"
              onClick={refresh}
              aria-label="Rank this row again"
              className="rounded-full border border-white/15 p-1.5 text-[10px] text-nx-muted transition hover:border-white/35 hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
            >
              <FaSyncAlt className={loading ? "animate-spin" : ""} aria-hidden />
            </button>
          )}

          <div className="hidden items-center gap-1 md:flex">
            <Arrow direction={-1} disabled={edges.start} onClick={() => nudge(-1)} />
            <Arrow direction={1} disabled={edges.end} onClick={() => nudge(1)} />
          </div>
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={measure}
        className={cn(
          "nx-scroll-x flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2",
          GUTTER
        )}
      >
        {loading && !candidates.length
          ? Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="w-[38vw] shrink-0 snap-start sm:w-[22vw] lg:w-[15vw]">
                <div className="nx-skeleton aspect-[2/3] rounded-xl" />
              </div>
            ))
          : candidates.map((candidate, index) => (
              <NeuralCard
                key={candidate.item.uid}
                candidate={candidate}
                position={index}
                surface={options.surface || "discover"}
                slate={slate}
                className="w-[38vw] shrink-0 snap-start sm:w-[22vw] lg:w-[15vw]"
              />
            ))}
      </div>
    </section>
  );
}

function Arrow({
  direction,
  disabled,
  onClick,
}: {
  direction: 1 | -1;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 1 ? "Scroll right" : "Scroll left"}
      className="rounded-full border border-white/15 p-1.5 text-[10px] text-nx-muted transition hover:border-white/35 hover:text-nx-ink disabled:cursor-not-allowed disabled:opacity-25 focus:outline-none focus-visible:nx-focus"
    >
      {direction === 1 ? <FaChevronRight aria-hidden /> : <FaChevronLeft aria-hidden />}
    </button>
  );
}
