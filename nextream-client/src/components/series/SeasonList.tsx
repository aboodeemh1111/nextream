"use client";

import { FaChevronRight } from "react-icons/fa";
import { Season, formatAirDate, seasonLabel } from "@/lib/tv";
import { cn } from "@/lib/cn";
import Art from "./Art";

interface SeasonListProps {
  seasons: Season[];
  activeSeasonNumber?: number | null;
  onSelect: (seasonNumber: number) => void;
  fallbackArt?: string;
}

export default function SeasonList({
  seasons,
  activeSeasonNumber,
  onSelect,
  fallbackArt,
}: SeasonListProps) {
  if (!seasons.length) {
    return (
      <p className="py-12 text-center text-sm text-nx-muted">
        No seasons have been published for this series yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-nx-line">
      {seasons.map((season) => {
        const active = season.seasonNumber === activeSeasonNumber;
        const count = season.episodesCount ?? 0;
        const thumb = season.poster || season.backdrop || fallbackArt;

        return (
          <li key={season._id}>
            <button
              type="button"
              onClick={() => onSelect(season.seasonNumber)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-2 py-4 text-left transition hover:bg-white/5 focus:outline-none focus-visible:nx-focus sm:gap-4 sm:px-3",
                active && "bg-white/5"
              )}
            >
              <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-nx-surface sm:w-44">
                <Art
                  src={thumb}
                  alt={seasonLabel(season)}
                  sizes="176px"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <h3
                    className={cn(
                      "min-w-0 truncate text-sm font-semibold sm:text-base",
                      active ? "text-nx-accent" : "text-nx-ink"
                    )}
                  >
                    {seasonLabel(season)}
                  </h3>
                  <span className="shrink-0 text-xs text-nx-muted">
                    {count} episode{count === 1 ? "" : "s"}
                  </span>
                </div>

                {season.overview && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-nx-muted sm:text-sm">
                    {season.overview}
                  </p>
                )}

                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-nx-dim">
                  {season.airDate && <span>{formatAirDate(season.airDate)}</span>}
                  {active && <span className="text-nx-muted">Continue here</span>}
                </div>
              </div>

              <FaChevronRight
                className="shrink-0 text-xs text-nx-dim transition group-hover:text-nx-ink"
                aria-hidden
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
