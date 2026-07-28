"use client";

import Link from "next/link";
import { FaPlay, FaCheck } from "react-icons/fa";
import { Episode, formatAirDate, formatRuntime } from "@/lib/tv";
import { cn } from "@/lib/cn";
import Art from "./Art";
import { ProgressBar } from "./Bits";
import { EpisodeListSkeleton } from "./Skeletons";

interface EpisodeListProps {
  episodes: Episode[];
  loading?: boolean;
  /** Highlights the episode the viewer is currently on. */
  activeEpisodeId?: string;
  fallbackStill?: string;
}

export default function EpisodeList({
  episodes,
  loading,
  activeEpisodeId,
  fallbackStill,
}: EpisodeListProps) {
  if (loading) return <EpisodeListSkeleton />;

  if (!episodes.length) {
    return (
      <p className="py-12 text-center text-sm text-nx-muted">
        No episodes have been published for this season yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-nx-line">
      {episodes.map((episode) => (
        <EpisodeRow
          key={episode._id}
          episode={episode}
          active={episode._id === activeEpisodeId}
          fallbackStill={fallbackStill}
        />
      ))}
    </ul>
  );
}

function EpisodeRow({
  episode,
  active,
  fallbackStill,
}: {
  episode: Episode;
  active?: boolean;
  fallbackStill?: string;
}) {
  const progress = episode.progress;
  const watched = Boolean(progress?.completed);
  const partial = Boolean(progress && !progress.completed && progress.percent > 0);

  // Resuming mid-episode is the common case, so the position rides in the URL
  // and the player does not need to wait on a progress round trip to seek.
  const href = partial
    ? `/watch/episode/${episode._id}?t=${Math.floor(progress!.positionSec)}`
    : `/watch/episode/${episode._id}`;

  return (
    <li>
      <Link
        href={href}
        className={cn(
          "group flex gap-3 rounded-lg px-2 py-4 transition hover:bg-white/5 focus:outline-none focus-visible:nx-focus sm:gap-4 sm:px-3",
          active && "bg-white/5"
        )}
      >
        <span
          className={cn(
            "hidden w-8 shrink-0 self-center text-center text-xl font-semibold sm:block",
            active ? "text-nx-accent" : "text-nx-dim"
          )}
          aria-hidden
        >
          {episode.episodeNumber}
        </span>

        <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-nx-surface sm:w-44">
          <Art
            src={episode.stillPath || fallbackStill}
            alt={episode.title}
            sizes="176px"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs text-white">
              <FaPlay className="ml-0.5" />
            </span>
          </span>

          {watched && (
            <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-[9px] text-nx-cyan">
              <FaCheck />
            </span>
          )}

          {partial && (
            <div className="absolute inset-x-0 bottom-0">
              <ProgressBar percent={progress!.percent} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="min-w-0 truncate text-sm font-semibold text-nx-ink sm:text-base">
              <span className="mr-1.5 text-nx-dim sm:hidden">{episode.episodeNumber}.</span>
              {episode.title}
            </h3>
            <span className="shrink-0 text-xs text-nx-muted">
              {formatRuntime(episode.duration)}
            </span>
          </div>

          {episode.overview && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-nx-muted sm:text-sm">
              {episode.overview}
            </p>
          )}

          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-nx-dim">
            {episode.airDate && <span>{formatAirDate(episode.airDate)}</span>}
            {partial && (
              <span className="text-nx-muted">
                {Math.round(progress!.percent)}% watched
              </span>
            )}
            {watched && <span className="text-nx-cyan">Watched</span>}
          </div>
        </div>
      </Link>
    </li>
  );
}
