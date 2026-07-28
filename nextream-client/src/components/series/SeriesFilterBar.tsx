"use client";

import { FaChevronDown, FaSearch, FaTimes } from "react-icons/fa";
import { GenreFacet } from "@/lib/tv";
import { cn } from "@/lib/cn";
import { GUTTER } from "./Bits";

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
  /**
   * `overlay` floats the controls over the billboard, the way a streaming
   * landing page seats its section heading. `bar` is the browse mode: no
   * billboard to sit on, so it pins under the navbar instead.
   */
  variant?: "overlay" | "bar";
}

/**
 * Browse controls for the series section.
 *
 * Two things this replaces. The genre list used to be thirteen values
 * hard-coded in the page; it now comes from the catalogue itself
 * (GET /tv/genres), so a genre with nothing published in it can no longer be
 * offered as a filter that returns an empty page.
 *
 * And the bar itself used to be `sticky top-0` while carrying its own 80px of
 * navbar clearance, which left a 140px slab pinned to the top of the viewport
 * with the first row of tiles sliced in half behind it. Clearance now belongs
 * to whatever the bar sits on, and the sticky offset is the navbar's height, so
 * the pinned bar is a single 56px strip.
 */
export default function SeriesFilterBar({
  genres,
  filters,
  onChange,
  resultCount,
  variant = "bar",
}: SeriesFilterBarProps) {
  const set = (patch: Partial<SeriesFilters>) => onChange({ ...filters, ...patch });
  const active = hasActiveFilters(filters);
  const overlay = variant === "overlay";

  const genreLabel =
    genres.find((genre) => genre.value === filters.genre)?.label || filters.genre;
  const sortLabel = SORTS.find((sort) => sort.value === filters.sort)?.label;

  return (
    <div
      className={cn(
        // `relative` in overlay mode, not `absolute`: it is a flex child of the
        // billboard, and the position only has to lift it above the artwork
        // layer. pt clears the fixed navbar.
        overlay
          ? "relative z-20 pt-[4.5rem]"
          : "sticky top-14 z-30 border-b border-white/[0.07] bg-nx-bg/85 backdrop-blur-xl"
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2.5",
          overlay ? "pb-2" : "py-3",
          GUTTER
        )}
      >
        <h1
          className={cn(
            "mr-auto flex items-baseline gap-2.5 font-extrabold tracking-tight text-nx-ink",
            overlay ? "nx-text-shadow text-2xl md:text-4xl" : "text-xl md:text-2xl"
          )}
        >
          Series
          {typeof resultCount === "number" && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-nx-muted">
              {resultCount} title{resultCount === 1 ? "" : "s"}
            </span>
          )}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <FaSearch
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] text-nx-dim"
              aria-hidden
            />
            <input
              type="search"
              value={filters.q}
              onChange={(event) => set({ q: event.target.value })}
              placeholder="Search series"
              aria-label="Search series"
              className={cn(
                "w-40 rounded-full border border-white/15 py-2 pl-9 pr-3 text-xs text-nx-ink backdrop-blur-sm transition-all duration-300 placeholder:text-nx-dim hover:border-white/30 focus:w-56 focus:border-white/50 focus:outline-none",
                overlay ? "bg-black/50" : "bg-white/[0.06]"
              )}
            />
          </div>

          {genres.length > 0 && (
            <Select
              id="series-genre"
              label="Filter by genre"
              value={filters.genre}
              onChange={(value) => set({ genre: value })}
              overlay={overlay}
              options={[
                { value: "", label: "All genres" },
                ...genres.map((genre) => ({
                  value: genre.value,
                  label: `${genre.label} (${genre.count})`,
                })),
              ]}
            />
          )}

          <Select
            id="series-sort"
            label="Sort series"
            value={filters.sort}
            onChange={(value) => set({ sort: value })}
            overlay={overlay}
            options={SORTS}
          />

          <div
            className={cn(
              "flex items-center rounded-full border border-white/15 p-0.5 backdrop-blur-sm",
              overlay ? "bg-black/50" : "bg-white/[0.06]"
            )}
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
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:nx-focus",
                  filters.status === option.value
                    ? "bg-nx-ink text-nx-black"
                    : "text-nx-muted hover:text-nx-ink"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* What is currently applied, and how to take it off again. Only in browse
          mode — an active filter is what puts the page there in the first
          place, so the strip can never appear over the billboard. */}
      {!overlay && active && (
        <div className={cn("flex flex-wrap items-center gap-2 pb-3", GUTTER)}>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-nx-dim">
            Filters
          </span>

          {filters.q.trim() && (
            <FilterChip label={`“${filters.q.trim()}”`} onClear={() => set({ q: "" })} />
          )}
          {filters.genre && (
            <FilterChip label={genreLabel} onClear={() => set({ genre: "" })} />
          )}
          {filters.status && (
            <FilterChip
              label={STATUSES.find((s) => s.value === filters.status)?.label || filters.status}
              onClear={() => set({ status: "" })}
            />
          )}
          {filters.sort !== DEFAULT_FILTERS.sort && sortLabel && (
            <FilterChip
              label={sortLabel}
              onClear={() => set({ sort: DEFAULT_FILTERS.sort })}
            />
          )}

          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTERS })}
            className="ml-1 text-xs font-semibold text-nx-muted underline-offset-4 transition hover:text-nx-ink hover:underline focus:outline-none focus-visible:nx-focus"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

/** Native <select> with the platform chrome swapped for the app's own. */
function Select({
  id,
  label,
  value,
  onChange,
  options,
  overlay,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  overlay: boolean;
}) {
  return (
    <div className="relative">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "cursor-pointer appearance-none rounded-full border border-white/15 py-2 pl-3.5 pr-8 text-xs font-semibold text-nx-ink backdrop-blur-sm transition hover:border-white/30 focus:border-white/50 focus:outline-none focus-visible:nx-focus",
          overlay ? "bg-black/50" : "bg-white/[0.06]"
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-nx-surface text-nx-ink">
            {option.label}
          </option>
        ))}
      </select>
      <FaChevronDown
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-nx-muted"
        aria-hidden
      />
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="group inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 py-1 pl-3 pr-2 text-xs font-medium text-nx-ink transition hover:border-white/40 hover:bg-white/15 focus:outline-none focus-visible:nx-focus"
    >
      {label}
      <FaTimes
        className="text-[9px] text-nx-muted transition group-hover:text-nx-ink"
        aria-hidden
      />
      <span className="sr-only">Remove filter</span>
    </button>
  );
}
