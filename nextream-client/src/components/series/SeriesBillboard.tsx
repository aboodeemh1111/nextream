"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  FaPlay,
  FaInfoCircle,
  FaVolumeMute,
  FaVolumeUp,
  FaRedo,
} from "react-icons/fa";
import {
  NextUp,
  TVShow,
  episodeCode,
  isPlayableVideo,
  matchScore,
  playLabel,
  showBackdrop,
  showMeta,
} from "@/lib/tv";
import { cn } from "@/lib/cn";
import Art from "./Art";
import { MetaLine, Pill } from "./Bits";
import MyListButton from "./MyListButton";

interface SeriesBillboardProps {
  show: TVShow;
  nextUp?: NextUp | null;
  onListChange?: (showId: string, inMyList: boolean) => void;
}

/** How long the artwork holds before the trailer takes over. */
const TRAILER_DELAY_MS = 2500;

export default function SeriesBillboard({
  show,
  nextUp,
  onListChange,
}: SeriesBillboardProps) {
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true);
  const [ended, setEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const canPreview = isPlayableVideo(show.trailerUrl);
  const match = matchScore(show.rating);

  useEffect(() => {
    if (!canPreview) return;
    // Respect the OS setting rather than autoplaying motion at anyone.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setTimeout(() => setPlaying(true), TRAILER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [canPreview, show._id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playing) return;
    video.play().catch(() => setPlaying(false));
  }, [playing]);

  const replay = () => {
    setEnded(false);
    setPlaying(true);
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => setPlaying(false));
    }
  };

  // No nextUp means the show has no published episode yet. Linking "Play" to
  // the detail page would promise playback the catalogue cannot deliver.
  const watchHref = nextUp
    ? nextUp.resumeSec > 0
      ? `/watch/episode/${nextUp.episode._id}?t=${Math.floor(nextUp.resumeSec)}`
      : `/watch/episode/${nextUp.episode._id}`
    : null;

  return (
    <section className="relative h-[62vh] min-h-[420px] w-full sm:h-[72vh]">
      <div className="absolute inset-0 overflow-hidden bg-nx-black">
        <Art
          src={showBackdrop(show)}
          alt={show.title}
          priority
          sizes="100vw"
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
            playing && ready ? "opacity-0" : "opacity-100"
          )}
        />

        {canPreview && (
          <video
            ref={videoRef}
            src={show.trailerUrl}
            muted={muted}
            playsInline
            preload="none"
            onCanPlay={() => setReady(true)}
            onEnded={() => {
              setEnded(true);
              setPlaying(false);
            }}
            onError={() => {
              setPlaying(false);
              setReady(false);
            }}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              playing && ready ? "opacity-100" : "opacity-0"
            )}
          />
        )}

        {/* Two scrims, not one: the vertical fade seats the row below, the
            horizontal one keeps the copy legible over a busy left edge. */}
        <div className="absolute inset-0 bg-gradient-to-t from-nx-bg via-nx-bg/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-nx-bg/95 via-nx-bg/40 to-transparent" />
      </div>

      <div className="relative flex h-full flex-col justify-end px-4 pb-12 md:px-12 md:pb-20">
        <div className="max-w-xl animate-nx-rise">
          <Pill tone="outline" className="mb-3 border-white/30 bg-black/30 backdrop-blur">
            Series
          </Pill>

          <h1 className="nx-text-shadow text-3xl font-extrabold leading-tight text-white sm:text-5xl md:text-6xl">
            {show.title}
          </h1>

          <MetaLine
            parts={[
              match ? `${match}% Match` : null,
              ...showMeta(show),
              show.status === "ended" ? "Complete series" : "Ongoing",
            ]}
            className="mt-3 text-sm font-medium text-nx-ink/90"
          />

          {show.overview && (
            <p className="nx-text-shadow mt-3 line-clamp-3 max-w-lg text-sm text-nx-ink/85 sm:text-base">
              {show.overview}
            </p>
          )}

          {nextUp && nextUp.reason !== "start" && (
            <p className="mt-3 text-xs font-medium text-nx-muted">
              {nextUp.reason === "resume" ? "Resume" : "Next"}: {episodeCode(nextUp.episode)}{" "}
              &middot; {nextUp.episode.title}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {watchHref ? (
              <Link
                href={watchHref}
                className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-2.5 text-sm font-bold text-black transition hover:bg-white/85"
              >
                <FaPlay /> {playLabel(nextUp)}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-md bg-white/20 px-6 py-2.5 text-sm font-bold text-nx-muted">
                <FaPlay /> Coming soon
              </span>
            )}

            <Link
              href={`/series/${show._id}`}
              className="inline-flex items-center gap-2 rounded-md border border-nx-line bg-white/10 px-5 py-2.5 text-sm font-semibold text-nx-ink backdrop-blur transition hover:bg-white/20"
            >
              <FaInfoCircle /> More Info
            </Link>

            <MyListButton
              showId={show._id}
              inMyList={show.inMyList}
              onChange={onListChange}
              variant="full"
            />
          </div>
        </div>
      </div>

      {canPreview && (
        <button
          type="button"
          onClick={() => (ended ? replay() : setMuted((value) => !value))}
          aria-label={ended ? "Replay trailer" : muted ? "Unmute trailer" : "Mute trailer"}
          className="absolute bottom-12 right-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white backdrop-blur transition hover:bg-black/70 md:bottom-20 md:right-12"
        >
          {ended ? <FaRedo /> : muted ? <FaVolumeMute /> : <FaVolumeUp />}
        </button>
      )}
    </section>
  );
}
