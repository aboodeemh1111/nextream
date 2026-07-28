"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FaPlay, FaChevronDown } from "react-icons/fa";
import {
  TVShow,
  isPlayableVideo,
  matchScore,
  showPoster,
  showMeta,
} from "@/lib/tv";
import { cn } from "@/lib/cn";
import Art from "./Art";
import { MetaLine, Pill, RankNumeral } from "./Bits";
import MyListButton from "./MyListButton";

interface SeriesCardProps {
  show: TVShow;
  /** 1-based position; renders the Top 10 numeral alongside the poster. */
  rank?: number;
  onListChange?: (showId: string, inMyList: boolean) => void;
  priority?: boolean;
  className?: string;
}

/** An episode added in the last two weeks earns the badge. */
const NEW_EPISODE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function hasNewEpisode(show: TVShow) {
  const stamp = show.latestEpisode?.createdAt || show.latestEpisode?.airDate;
  if (!stamp) return false;
  const date = new Date(stamp).getTime();
  return Number.isFinite(date) && Date.now() - date < NEW_EPISODE_WINDOW_MS;
}

/**
 * Poster card for a show.
 *
 * The detail overlay is drawn *inside* the card rather than as a floating panel
 * that grows past its bounds. A row is a native horizontal scroller, and CSS
 * forces overflow-y to `auto` once overflow-x is, so anything escaping the card
 * box gets clipped or adds a stray scrollbar. Containing it keeps the preview
 * working identically in a row, a grid and a "More Like This" strip.
 */
export default function SeriesCard({
  show,
  rank,
  onListChange,
  priority = false,
  className,
}: SeriesCardProps) {
  const [active, setActive] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canPreview = isPlayableVideo(show.trailerUrl);
  const match = matchScore(show.rating);

  // Hover previews are a desktop affordance; on touch the first tap should open
  // the show, not arm a preview the viewer never asked for.
  const open = () => {
    if (window.matchMedia("(hover: none)").matches) return;
    timerRef.current = setTimeout(() => setActive(true), 400);
  };

  const close = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActive(false);
    setPreviewReady(false);
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) {
      video.pause();
      return;
    }
    video.currentTime = 0;
    // Autoplay is blocked often enough (policy, codec, expired URL) that a
    // rejection here is normal, not an error worth surfacing.
    video.play().catch(() => setPreviewReady(false));
  }, [active]);

  return (
    <div
      className={cn(
        "group/card relative",
        rank !== undefined && "flex items-stretch",
        className
      )}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={() => setActive(true)}
      onBlur={close}
    >
      {rank !== undefined && (
        // Stretches to the poster's height rather than taking a percentage of
        // one: the row sets no height, so a % here would resolve against an
        // indefinite parent and collapse to the SVG's intrinsic size.
        <div className="w-[42%] shrink-0 select-none self-stretch pr-1" aria-hidden>
          <RankNumeral rank={rank} />
        </div>
      )}

      <Link
        href={`/series/${show._id}`}
        aria-label={show.title}
        className={cn(
          "relative block aspect-[2/3] w-full overflow-hidden rounded-lg bg-nx-surface ring-1 ring-white/5 transition-all duration-300 focus:outline-none focus-visible:nx-focus",
          active && "scale-[1.04] shadow-2xl shadow-black/70 ring-white/25",
          rank !== undefined && "min-w-0 flex-1"
        )}
      >
        <Art
          src={showPoster(show)}
          alt={show.title}
          priority={priority}
          sizes="(max-width: 640px) 42vw, (max-width: 1024px) 24vw, 16vw"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Persistent flags — readable without hovering. */}
        <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
          {hasNewEpisode(show) && <Pill tone="accent">New Episode</Pill>}
          {show.status === "ended" && !hasNewEpisode(show) && (
            <Pill className="bg-black/70">Complete</Pill>
          )}
        </div>

        {canPreview && (
          <video
            ref={videoRef}
            src={show.trailerUrl}
            muted
            loop
            playsInline
            preload="none"
            onCanPlay={() => setPreviewReady(true)}
            onError={() => setPreviewReady(false)}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
              active && previewReady ? "opacity-100" : "opacity-0"
            )}
          />
        )}

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/80 to-transparent p-3 transition-all duration-300",
            active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          )}
        >
          <h3 className="mb-1 line-clamp-1 text-sm font-semibold text-nx-ink">
            {show.title}
          </h3>

          <MetaLine
            parts={[match ? `${match}% Match` : null, ...showMeta(show).slice(0, 2)]}
            className="mb-2 text-[11px] text-nx-muted"
          />

          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[11px] text-black"
              aria-hidden
            >
              <FaPlay className="ml-0.5" />
            </span>
            <MyListButton
              showId={show._id}
              inMyList={show.inMyList}
              onChange={onListChange}
            />
            <span
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 text-[11px] text-white"
              aria-hidden
            >
              <FaChevronDown />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
