"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FaPlay, FaChevronDown, FaFilm, FaTv } from "react-icons/fa";
import {
  MediaItem,
  isPlayableVideo,
  maturityLabel,
  mediaMeta,
} from "@/lib/home";
import { cn } from "@/lib/cn";
import Art from "@/components/series/Art";
import { MatchScore, MetaLine, Pill, RankNumeral } from "@/components/series/Bits";
import ListButton from "./ListButton";

interface MediaCardProps {
  item: MediaItem;
  /** 1-based position; renders the Top 10 numeral alongside the poster. */
  rank?: number;
  onListChange?: (uid: string, inMyList: boolean) => void;
  priority?: boolean;
  className?: string;
}

/**
 * One card for both collections.
 *
 * The home page previously had two card components that could never appear in
 * the same row, which is exactly the constraint that kept shows off the landing
 * page. This one takes the normalised `MediaItem`, so a row can hold a film and
 * a series side by side and only the badge and the link differ.
 *
 * The detail overlay is drawn *inside* the card rather than as a floating panel
 * that grows past its bounds: a row is a native horizontal scroller, and CSS
 * forces overflow-y to `auto` once overflow-x is, so anything escaping the card
 * box gets clipped or adds a stray scrollbar.
 *
 * The whole tile is one link laid over the artwork rather than wrapped around
 * it — My List is a real <button> and Play is a real <a>, and neither can be
 * nested inside an anchor without producing markup screen readers announce as
 * a single unlabelled control.
 */
export default function MediaCard({
  item,
  rank,
  onListChange,
  priority = false,
  className,
}: MediaCardProps) {
  const [active, setActive] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canPreview = isPlayableVideo(item.trailer);
  const ranked = rank !== undefined;
  const maturity = maturityLabel(item);

  // Hover previews are a desktop affordance; on touch the first tap should open
  // the title, not arm a preview nobody asked for.
  const open = () => {
    if (window.matchMedia("(hover: none)").matches) return;
    timerRef.current = setTimeout(() => setActive(true), 400);
  };

  const close = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActive(false);
    setPreviewReady(false);
  };

  // focusout bubbles, so tabbing from the poster link to My List would read as
  // a blur and collapse the panel the viewer is trying to reach.
  const handleBlur = (event: React.FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    close();
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

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
    <article
      className={cn(
        "group/card relative transition-[z-index]",
        active ? "z-20" : "z-0",
        ranked && "flex items-end",
        className
      )}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={() => setActive(true)}
      onBlur={handleBlur}
    >
      {ranked && (
        <>
          {/* Numeral sits behind the poster and is overlapped by it, the way
              every Top 10 rail draws it. Bounded to the bottom-left corner
              rather than the whole tile so a wide breakpoint cannot strand it
              between two cards. */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 h-[48%] w-[40%] select-none"
            aria-hidden
          >
            <RankNumeral rank={rank} />
          </div>
          <div className="w-[34%] shrink-0" aria-hidden />
        </>
      )}

      <div
        className={cn(
          "relative aspect-[4/5] overflow-hidden rounded-xl bg-nx-surface shadow-lg shadow-black/40 ring-1 ring-white/10 transition-all duration-300 ease-out",
          active && "scale-[1.05] shadow-2xl shadow-black/70 ring-white/30",
          ranked ? "min-w-0 flex-1" : "w-full"
        )}
      >
        <Art
          src={item.poster}
          alt={item.title}
          priority={priority}
          sizes="(max-width: 640px) 40vw, (max-width: 1024px) 24vw, 16vw"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {canPreview && (
          <video
            ref={videoRef}
            src={item.trailer}
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

        {/* Resting scrim: enough separation for the badges without dimming the
            art, and it clears as the panel comes up. */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25 transition-opacity duration-300",
            active ? "opacity-0" : "opacity-100"
          )}
        />

        <Link
          href={item.href}
          aria-label={item.title}
          className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:nx-focus"
        />

        {/* Kind is the one flag that has to be readable without hovering: this
            is the row where a film and a series sit next to each other, and
            "Play" means something different for each. */}
        <div className="pointer-events-none absolute left-2 top-2 z-20 flex flex-col items-start gap-1">
          <Pill tone="glass" className="gap-1">
            {item.kind === "show" ? (
              <FaTv className="text-[8px]" aria-hidden />
            ) : (
              <FaFilm className="text-[8px]" aria-hidden />
            )}
            {item.badge}
          </Pill>
        </div>

        {maturity && (
          <span className="pointer-events-none absolute right-2 top-2 z-20 rounded border border-white/25 bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-nx-ink backdrop-blur-sm">
            {maturity}
          </span>
        )}

        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/85 to-transparent p-3 pt-8 transition-all duration-300",
            active ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}
        >
          <h3 className="mb-1 line-clamp-2 text-sm font-bold leading-tight text-nx-ink">
            {item.title}
          </h3>

          <MetaLine
            parts={mediaMeta(item).slice(0, 2)}
            className="mb-2.5 text-[11px] text-nx-muted"
          />
          {item.match !== null && (
            <MatchScore score={item.match} className="mb-2.5 block text-[11px]" />
          )}

          <div className="pointer-events-auto flex items-center gap-2">
            <Link
              href={item.playHref || item.href}
              tabIndex={active ? 0 : -1}
              aria-label={`Play ${item.title}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[11px] text-black transition hover:bg-white/85 focus:outline-none focus-visible:nx-focus"
            >
              <FaPlay className="ml-0.5" />
            </Link>
            <ListButton
              item={item}
              onChange={onListChange}
              tabIndex={active ? 0 : -1}
            />
            <Link
              href={item.href}
              tabIndex={active ? 0 : -1}
              aria-label={`More about ${item.title}`}
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-black/50 text-[11px] text-white transition hover:border-white focus:outline-none focus-visible:nx-focus"
            >
              <FaChevronDown />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
