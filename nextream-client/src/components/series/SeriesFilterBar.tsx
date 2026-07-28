"use client";

import { FaSearch, FaTimes } from "react-icons/fa";
import { GenreFacet } from "@/lib/tv";
import { cn } from "@/lib/cn";

export interface SeriesFilters {
  q: string;
  genre: string;
  status: string;
  sort: string;
}

export const DEFAULT_FILTERS: SeriesFilters = {
  q: "",
  genre: "",
  status: "",
  sort: "trending",
};

export function hasActiveFilters(filters: SeriesFilters) {
  return Boolean(
    filters.q.trim() || filters.genre || filters.status || filters.sort !== DEFAULT_FILTERS.sort
  );
}

const SORTS = [
  { value: "trending", label: "Suggestions for you" },
  { value: "newest", label: "Recently added" },
  { value: "recent", label: "Latest episodes" },
  { value: "rating", label: "Highest rated" },
  { value: "year", label: "Newest releases" },
  { value: "az", label: "A–Z" },
  { value: "za", label: "Z–A" },
];

const STATUSES = [
  { value: "", label: "All" },
  { value: "ongoing", label: "Ongoing" },
  { value: "ended", label: "Complete" },
];

interface SeriesFilterBarProps {
  genres: GenreFacet[];
  filters: SeriesFilters;
  onChange: (next: SeriesFilters) => void;
  resultCount?: number | null;
}

/**
 * Browse controls for the series section.
 *
 * Replaces a bare <select> of thirteen genres hard-coded in the page. The chips
 * come from the catalogue itself (GET /tv/genres), so a genre with nothing
 * published in it can no longer be offered as a filter that returns an empty
 * page.
 */
export default function SeriesFilterBar({
  genres,
  filters,
  onChange,
  resultCount,
}: SeriesFilterBarProps) {
  const set = (patch: Partial<SeriesFilters>) => onChange({ ...filters, ...patch });
  const active = hasActiveFilters(filters);

  return (
    <div className="sticky top-0 z-30 border-b border-nx-line bg-nx-bg/85 backdrop-blur-xl">
      <div className="px-4 pb-3 pt-20 md:px-12 md:pt-24">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-2xl font-bold text-nx-ink md:text-3xl">
            Series
            {typeof resultCount === "number" && (
              <span className="ml-2 align-middle text-sm font-normal text-nx-dim">
                {resultCount} title{resultCount === 1 ? "" : "s"}
              </span>
            )}
          </h1>

          <div className="relative">
            <FaSearch
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-nx-dim"
              aria-hidden
            />
            <input
              type="search"
              value={filters.q}
              onChange={(event) => set({ q: event.target.value })}
              placeholder="Search series"
              aria-label="Search series"
              className="w-44 rounded-full border border-nx-line bg-white/5 py-1.5 pl-8 pr-3 text-sm text-nx-ink placeholder:text-nx-dim transition focus:w-56 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-nx-cyan/40"
            />
          </div>

          <label className="sr-only" htmlFor="series-sort">
            Sort series
          </label>
          <select
            id="series-sort"
            value={filters.sort}
            onChange={(event) => set({ sort: event.target.value })}
            className="rounded-md border border-nx-line bg-white/5 px-3 py-1.5 text-sm text-nx-ink focus:outline-none focus:ring-1 focus:ring-nx-cyan/40"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value} className="bg-nx-surface">
                {option.label}
              </option>
            ))}
          </select>

          <div
            className="flex overflow-hidden rounded-md border border-nx-line"
            role="group"
            aria-label="Filter by status"
          >
            {STATUSES.map((option) => (
              <button
                key={option.value || "all"}
                type="button"
                onClick={() => set({ status: option.value })}
                aria-pressed={filters.status === option.value}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition",
                  filters.status === option.value
                    ? "bg-nx-ink text-nx-black"
                    : "text-nx-muted hover:bg-white/10 hover:text-nx-ink"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {active && (
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_FILTERS })}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-nx-muted transition hover:text-nx-ink"
            >
              <FaTimes className="text-[10px]" /> Clear
            </button>
          )}
        </div>

        {genres.length > 0 && (
          <div className="nx-scroll-x -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            <GenreChip
              label="All genres"
              selected={!filters.genre}
              onClick={() => set({ genre: "" })}
            />
            {genres.map((genre) => (
              <GenreChip
                key={genre.value}
                label={genre.label}
                count={genre.count}
                selected={filters.genre === genre.value}
                onClick={() =>
                  set({ genre: filters.genre === genre.value ? "" : genre.value })
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GenreChip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
        selected
          ? "border-transparent bg-nx-ink text-nx-black"
          : "border-nx-line bg-white/5 text-nx-muted hover:border-white/30 hover:text-nx-ink"
      )}
    >
      {label}
      {typeof count === "number" && (
        <span className={cn("ml-1.5", selected ? "text-nx-black/55" : "text-nx-dim")}>
          {count}
        </span>
      )}
    </button>
  );
}
