"use client";

import { useState } from "react";
import Link from "next/link";
import { FaPlay, FaTimes, FaInfoCircle } from "react-icons/fa";
import {
  ContinueEntry,
  episodeCode,
  formatRuntime,
  showBackdrop,
  tv,
} from "@/lib/tv";
import { cn } from "@/lib/cn";
import Art from "./Art";
import { ProgressBar, Spinner } from "./Bits";

interface ContinueCardProps {
  entry: ContinueEntry;
  /** Lets the row drop the card once the viewer dismisses it. */
  onRemoved?: (showId: string) => void;
}

/**
 * A Continue Watching tile.
 *
 * Landscape rather than poster-shaped on purpose: the useful information is the
 * episode still and how far in you are, and a 2:3 poster has room for neither.
 */
export default function ContinueCard({ entry, onRemoved }: ContinueCardProps) {
  const [removing, setRemoving] = useState(false);
  const { show, episode, resumeSec, percent, reason } = entry;

  const remove = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (removing) return;

    setRemoving(true);
    try {
      await tv.removeFromContinue(show._id);
      onRemoved?.(show._id);
    } catch {
      setRemoving(false);
    }
  };

  // "next" means the last episode finished, so there is nothing to resume into.
  const watchHref =
    reason === "resume" && resumeSec > 0
      ? `/watch/episode/${episode._id}?t=${Math.floor(resumeSec)}`
      : `/watch/episode/${episode._id}`;

  return (
    <div className="group/tile relative">
      <Link
        href={watchHref}
        className="block overflow-hidden rounded-lg bg-nx-surface ring-1 ring-white/5 transition duration-300 hover:ring-white/25 focus:outline-none focus-visible:nx-focus"
      >
        <div className="relative aspect-video w-full">
          <Art
            src={episode.stillPath || showBackdrop(show)}
            alt={`${show.title} — ${episode.title}`}
            sizes="(max-width: 640px) 74vw, (max-width: 1024px) 38vw, 24vw"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover/tile:opacity-100">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-black shadow-lg">
              <FaPlay className="ml-0.5" />
            </span>
          </span>

          <div className="absolute inset-x-0 bottom-0">
            <ProgressBar percent={percent} />
          </div>
        </div>

        <div className="p-3">
          <p className="line-clamp-1 text-sm font-semibold text-nx-ink">{show.title}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-nx-muted">
            {reason === "next" ? "Next up: " : ""}
            {episodeCode(episode)} &middot; {episode.title}
          </p>
          {episode.duration ? (
            <p className="mt-1 text-[11px] text-nx-dim">
              {reason === "resume"
                ? `${Math.max(
                    1,
                    Math.round(episode.duration - resumeSec / 60)
                  )}m left`
                : formatRuntime(episode.duration)}
            </p>
          ) : null}
        </div>
      </Link>

      <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition group-hover/tile:opacity-100 focus-within:opacity-100">
        <Link
          href={`/series/${show._id}`}
          onClick={(event) => event.stopPropagation()}
          title={`About ${show.title}`}
          aria-label={`About ${show.title}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-[11px] text-white transition hover:bg-black"
        >
          <FaInfoCircle />
        </Link>
        <button
          type="button"
          onClick={remove}
          title="Remove from Continue Watching"
          aria-label={`Remove ${show.title} from Continue Watching`}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-[11px] text-white transition hover:bg-black",
            removing && "cursor-wait"
          )}
        >
          {removing ? <Spinner className="h-3 w-3" /> : <FaTimes />}
        </button>
      </div>
    </div>
  );
}
