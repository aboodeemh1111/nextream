"use client";

import { useState } from "react";
import Link from "next/link";
import { FaPlay, FaTimes, FaInfoCircle } from "react-icons/fa";
import { ContinueItem, removeFromContinue, timeLeftLabel } from "@/lib/home";
import { cn } from "@/lib/cn";
import Art from "@/components/series/Art";
import { ProgressBar, Spinner } from "@/components/series/Bits";

interface ContinueTileProps {
  entry: ContinueItem;
  /** Lets the row drop the tile once the viewer dismisses it. */
  onRemoved?: (uid: string) => void;
}

/**
 * A Continue Watching tile, for a half-finished film or a series mid-episode.
 *
 * Landscape rather than poster-shaped on purpose: the useful information is the
 * still and how far in you are, and a portrait poster has room for neither.
 *
 * The resume link is an overlay rather than a wrapper so the dismiss button and
 * the "about" link are siblings of it — an <a> and a <button> inside another
 * <a> is invalid markup, and assistive tech flattens the lot into one control.
 */
export default function ContinueTile({ entry, onRemoved }: ContinueTileProps) {
  const [removing, setRemoving] = useState(false);
  const { item, percent, reason } = entry;

  const remove = async () => {
    if (removing) return;

    setRemoving(true);
    try {
      await removeFromContinue(item);
      onRemoved?.(item.uid);
    } catch {
      setRemoving(false);
    }
  };

  const timeLeft = timeLeftLabel(entry);

  return (
    <article className="group/tile relative overflow-hidden rounded-xl bg-nx-surface shadow-lg shadow-black/40 ring-1 ring-white/10 transition duration-300 hover:shadow-2xl hover:shadow-black/70 hover:ring-white/25">
      <div className="relative aspect-video w-full overflow-hidden">
        <Art
          src={entry.still}
          alt={entry.subtitle ? `${item.title} — ${entry.subtitle}` : item.title}
          fallbackLabel={false}
          sizes="(max-width: 640px) 76vw, (max-width: 1024px) 38vw, 24vw"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/tile:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/20" />

        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="inline-flex h-12 w-12 scale-90 items-center justify-center rounded-full bg-white/95 text-black opacity-0 shadow-lg transition duration-300 group-hover/tile:scale-100 group-hover/tile:opacity-100">
            <FaPlay className="ml-0.5" />
          </span>
        </span>

        {reason === "next" && (
          <span className="pointer-events-none absolute left-2.5 top-2.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-nx-ink backdrop-blur-sm">
            Next up
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0">
          <ProgressBar percent={percent} />
        </div>
      </div>

      <div className="p-3">
        <p className="line-clamp-1 text-sm font-bold text-nx-ink">{item.title}</p>
        {entry.subtitle && (
          <p className="mt-1 line-clamp-1 text-xs text-nx-muted">
            {entry.episodeCode ? (
              <>
                <span className="font-semibold text-nx-ink/80">{entry.episodeCode}</span>
                {entry.subtitle.slice(entry.episodeCode.length)}
              </>
            ) : (
              entry.subtitle
            )}
          </p>
        )}
        {timeLeft && <p className="mt-1 text-[11px] text-nx-dim">{timeLeft}</p>}
      </div>

      <Link
        href={entry.watchHref}
        aria-label={`Resume ${item.title}`}
        className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:nx-focus"
      />

      <div className="absolute right-2 top-2 z-20 flex gap-1.5 opacity-0 transition focus-within:opacity-100 group-hover/tile:opacity-100">
        <Link
          href={item.href}
          title={`About ${item.title}`}
          aria-label={`About ${item.title}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-[11px] text-white ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black focus:outline-none focus-visible:nx-focus"
        >
          <FaInfoCircle />
        </Link>
        <button
          type="button"
          onClick={remove}
          title="Remove from Continue Watching"
          aria-label={`Remove ${item.title} from Continue Watching`}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-[11px] text-white ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black focus:outline-none focus-visible:nx-focus",
            removing && "cursor-wait"
          )}
        >
          {removing ? <Spinner className="h-3 w-3" /> : <FaTimes />}
        </button>
      </div>
    </article>
  );
}
