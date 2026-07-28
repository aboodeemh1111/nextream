"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  FaPlay,
  FaInfoCircle,
  FaVolumeMute,
  FaVolumeUp,
  FaRedo,
  FaFilm,
  FaTv,
} from "react-icons/fa";
import {
  HeroItem,
  isPlayableVideo,
  maturityLabel,
  mediaMeta,
  playLabel,
} from "@/lib/home";
import { cn } from "@/lib/cn";
import Art from "@/components/series/Art";
import { GUTTER, MatchScore, MetaLine, Pill, ProgressBar } from "@/components/series/Bits";
import ListButton from "./ListButton";

interface HomeBillboardProps {
  hero: HeroItem;
  onListChange?: (uid: string, inMyList: boolean) => void;
}

/** How long the artwork holds before the trailer takes over. */
const TRAILER_DELAY_MS = 2500;

/**
 * The landing billboard.
 *
 * Carries the reason it was chosen — "Pick up where you left off", "Because you
 * watch Horror" — rather than presenting one title as though it were editorial.
 * A ranked page that cannot say why it ranked something is indistinguishable
 * from a random one, and the viewer has no way to tell that it is working.
 */
export default function HomeBillboard({ hero, onListChange }: HomeBillboardProps) {
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true);
  const [ended, setEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const canPreview = isPlayableVideo(hero.trailer);
  const maturity = maturityLabel(hero);

  useEffect(() => {
    if (!canPreview) return;
    // Respect the OS setting rather than autoplaying motion at anyone.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setTimeout(() => setPlaying(true), TRAILER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [canPreview, hero.uid]);

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

  return (
    // min-height, not height: the copy block grows with a long title, and a
    // fixed height would push it up under the navbar instead of growing.
    <section className="relative flex min-h-[600px] w-full flex-col sm:min-h-[82vh]">
      <div className="absolute inset-0 overflow-hidden bg-nx-black">
        {/* The drift is on a wrapper, not on <Art>, so it survives the swap to
            the generated placeholder when a title has no backdrop. */}
        <div className="absolute inset-0 animate-nx-kenburns">
          <Art
            src={hero.backdrop}
            alt={hero.title}
            priority
            sizes="100vw"
            fallbackLabel={false}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              playing && ready ? "opacity-0" : "opacity-100"
            )}
          />
        </div>

        {canPreview && (
          <video
            ref={videoRef}
            src={hero.trailer}
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

        {/* Three scrims: the vertical fade seats the first row, the horizontal
            one keeps the copy legible over busy artwork, and the short top one
            carries the navbar floating over it. */}
        <div className="absolute inset-0 bg-gradient-to-t from-nx-bg via-nx-bg/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-nx-bg/95 via-nx-bg/45 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/75 via-black/30 to-transparent" />
      </div>

      <div
        className={cn(
          // Deep enough that the first row, pulled up over the fade, clears the
          // call to action instead of butting against it.
          "relative mt-auto flex flex-col pb-20 sm:pb-24 md:pb-36",
          GUTTER
        )}
      >
        <div className="max-w-xl animate-nx-rise">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Pill tone="accent" className="gap-1">
              {hero.kind === "show" ? (
                <FaTv className="text-[8px]" aria-hidden />
              ) : (
                <FaFilm className="text-[8px]" aria-hidden />
              )}
              {hero.badge}
            </Pill>
            {hero.genreLabels.slice(0, 2).map((genre) => (
              <Pill key={genre} tone="glass" className="px-2 py-1 tracking-[0.18em]">
                {genre}
              </Pill>
            ))}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-nx-cyan">
            {hero.reason}
          </p>

          <h1 className="nx-text-shadow text-3xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
            {hero.title}
          </h1>

          <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-nx-ink/90">
            {hero.match !== null && <MatchScore score={hero.match} />}
            <MetaLine
              parts={[
                ...mediaMeta(hero),
                maturity,
                hero.rating10 ? `★ ${hero.rating10.toFixed(1)}` : null,
              ]}
            />
          </div>

          {hero.overview && (
            <p className="nx-text-shadow mt-3.5 line-clamp-3 max-w-lg text-sm leading-relaxed text-nx-ink/80 sm:text-base">
              {hero.overview}
            </p>
          )}

          {hero.resume ? (
            <div className="mt-4 max-w-xs">
              <ProgressBar percent={hero.resume.percent} className="rounded-full" />
              <p className="mt-1.5 text-xs font-semibold text-nx-muted">
                {hero.resume.subtitle || `${hero.resume.percent}% watched`}
              </p>
            </div>
          ) : (
            hero.nextUp &&
            hero.nextUp.reason !== "start" && (
              <p className="mt-3.5 text-xs font-semibold text-nx-muted">
                Next: <span className="text-nx-ink">{hero.nextUp.code}</span> &middot;{" "}
                {hero.nextUp.title}
              </p>
            )
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {hero.watchHref ? (
              <Link
                href={hero.watchHref}
                className="nx-sheen inline-flex items-center gap-2.5 rounded-lg bg-white px-7 py-3 text-sm font-bold text-black shadow-lg shadow-black/40 transition hover:bg-white/85 focus:outline-none focus-visible:nx-focus"
              >
                <FaPlay /> {playLabel(hero, hero.resume?.percent)}
              </Link>
            ) : (
              // Nothing published behind the title yet. A Play button that
              // opens an empty player is worse than none.
              <span className="inline-flex items-center gap-2.5 rounded-lg bg-white/15 px-7 py-3 text-sm font-bold text-nx-muted">
                <FaPlay /> Coming soon
              </span>
            )}

            <Link
              href={hero.href}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-nx-ink backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:nx-focus"
            >
              <FaInfoCircle /> More Info
            </Link>

            <ListButton item={hero} onChange={onListChange} variant="full" />
          </div>
        </div>
      </div>

      {canPreview && (
        <button
          type="button"
          onClick={() => (ended ? replay() : setMuted((value) => !value))}
          aria-label={ended ? "Replay trailer" : muted ? "Unmute trailer" : "Mute trailer"}
          className="absolute bottom-20 right-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white backdrop-blur transition hover:bg-black/70 focus:outline-none focus-visible:nx-focus sm:right-6 md:bottom-28 md:right-12 2xl:right-16"
        >
          {ended ? <FaRedo /> : muted ? <FaVolumeMute /> : <FaVolumeUp />}
        </button>
      )}
    </section>
  );
}
