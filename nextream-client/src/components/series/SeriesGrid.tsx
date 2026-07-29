"use client";

import { useEffect, useRef } from "react";
import { FaSearch } from "react-icons/fa";
import { TVShow } from "@/lib/tv";
import { cn } from "@/lib/cn";
import SeriesCard from "./SeriesCard";
import { GridSkeleton } from "./Skeletons";
import { GUTTER, Spinner } from "./Bits";

interface SeriesGridProps {
  shows: TVShow[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onListChange?: (showId: string, inMyList: boolean) => void;
  emptyHint?: string;
}

/**
 * Filter results.
 *
 * Pages in as the viewer scrolls rather than behind a "load more" button: with
 * pageSize 24 and a six-column grid, a button lands after four rows, which is
 * the wrong place for a browse surface.
 */
export default function SeriesGrid({
  shows,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onListChange,
  emptyHint,
}: SeriesGridProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Read inside the observer callback so the effect does not resubscribe on
  // every state change — re-registering mid-scroll drops the intersection.
  const stateRef = useRef({ hasMore, loadingMore, onLoadMore });
  useEffect(() => {
    stateRef.current = { hasMore, loadingMore, onLoadMore };
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const { hasMore: more, loadingMore: busy, onLoadMore: load } = stateRef.current;
        if (entries[0]?.isIntersecting && more && !busy) load();
      },
      // Start fetching a screenful early so the grid rarely shows its spinner.
      { rootMargin: "600px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (loading) {
    return (
      <div className={cn("py-8", GUTTER)}>
        <GridSkeleton />
      </div>
    );
  }

  if (!shows.length) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-28 text-center">
        <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-nx-surface text-lg text-nx-dim ring-1 ring-white/10">
          <FaSearch />
        </span>
        <p className="text-lg font-bold text-nx-ink">No series match those filters</p>
        <p className="mt-1.5 max-w-sm text-sm text-nx-muted">
          {emptyHint || "Try a different genre, or clear the filters to see everything."}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("py-8", GUTTER)}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {shows.map((show, index) => (
          <SeriesCard
            key={show._id}
            show={show}
            onListChange={onListChange}
            priority={index < 6}
          />
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      {loadingMore && (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      {!hasMore && shows.length > 12 && (
        <p className="py-12 text-center text-sm text-nx-dim">
          That&apos;s every series in the catalogue.
        </p>
      )}
    </div>
  );
}
