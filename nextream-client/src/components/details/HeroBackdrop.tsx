"use client";

import { useEffect, useRef, useState } from "react";
import { FaVolumeMute, FaVolumeUp } from "react-icons/fa";
import Art from "@/components/series/Art";
import { isPlayableVideo } from "@/lib/tv";

/** How long the artwork holds before the trailer takes over, unprompted. */
const AUTOPLAY_DELAY_MS = 2800;

interface HeroBackdropProps {
  img?: string | null;
  trailer?: string | null;
  title: string;
  /**
   * Bump to start the trailer immediately, with sound. Every increment is a
   * fresh press of the caller's Trailer button, so it also restarts a preview
   * that is already running.
   */
  trigger?: number;
}

/**
 * The billboard behind the title block: artwork that drifts, then a muted
 * trailer that fades in over it.
 *
 * Two rules keep the preview from being obnoxious. It starts muted — an
 * autoplay with sound is both a browser policy violation and a hostile way to
 * open a page — and it plays through once rather than looping, dropping back
 * to the artwork at the end. Sound only ever arrives through a click, either
 * the speaker toggle here or the caller's Trailer button.
 *
 * Anything that is not a direct video file (a YouTube or Vimeo page, the usual
 * contents of the admin's free-text trailer field) is left alone: it would
 * autoplay into a black rectangle.
 */
export default function HeroBackdrop({
  img,
  trailer,
  title,
  trigger = 0,
}: HeroBackdropProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"art" | "video">("art");
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true);
  const [calm, setCalm] = useState(false);

  const canPreview = isPlayableVideo(trailer) && !calm;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setCalm(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Unprompted start. Deliberately after a beat: the artwork is what the
  // viewer clicked through to see, and swapping it at first paint hides it.
  //
  // Spent once per visit. Without the latch, the drop back to artwork at the
  // end of the trailer re-arms this timer and the preview restarts every few
  // seconds for as long as the page is open.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!canPreview || phase === "video" || autoStarted.current) return;
    const timer = setTimeout(() => {
      autoStarted.current = true;
      setPhase("video");
    }, AUTOPLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [canPreview, phase]);

  // Trailer button. Skips the initial render so mounting is not a press.
  const firstTrigger = useRef(true);
  useEffect(() => {
    if (firstTrigger.current) {
      firstTrigger.current = false;
      return;
    }
    if (!isPlayableVideo(trailer)) return;

    setPhase("video");
    setMuted(false);
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      void video.play().catch(() => undefined);
    }
  }, [trigger, trailer]);

  // Nobody wants a trailer still talking three sections down the page.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const video = videoRef.current;
        if (!video) return;
        if (entry.isIntersecting) {
          if (phase === "video") void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [phase]);

  const showVideo = phase === "video" && ready;

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-nx-black">
      {/* The crossfade lives on a wrapper, not on <Art>: Art drives its own
          opacity as the image decodes, and two opacity utilities on one node
          resolve by stylesheet order rather than by which one we meant. */}
      <div
        className={
          "absolute inset-0 transition-opacity duration-1000 " +
          (showVideo ? "opacity-0" : "opacity-100")
        }
      >
        <Art
          src={img}
          alt={title}
          priority
          sizes="100vw"
          className="absolute inset-0 h-full w-full origin-center animate-nx-kenburns object-cover"
        />
      </div>

      {phase === "video" && trailer && (
        <video
          ref={videoRef}
          src={trailer}
          autoPlay
          muted={muted}
          playsInline
          preload="metadata"
          onCanPlay={(event) => {
            setReady(true);
            // Sound only ever follows a click, but a click elsewhere on the
            // page is not always enough activation for an unmuted autoplay.
            // A silent trailer is a better answer than a frozen first frame.
            const element = event.currentTarget;
            void element.play().catch(() => {
              element.muted = true;
              setMuted(true);
              void element.play().catch(() => undefined);
            });
          }}
          onEnded={() => {
            setPhase("art");
            setReady(false);
            setMuted(true);
          }}
          onError={() => {
            setPhase("art");
            setReady(false);
          }}
          className={
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 " +
            (showVideo ? "opacity-100" : "opacity-0")
          }
        />
      )}

      {/* Scrims. Bottom for the title block, left for the copy, top so the
          fixed navbar stays legible over a bright frame. */}
      <div className="absolute inset-0 bg-gradient-to-t from-nx-bg via-nx-bg/55 to-nx-bg/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-nx-bg/95 via-nx-bg/35 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />

      {showVideo && (
        <button
          type="button"
          onClick={() => {
            const video = videoRef.current;
            const next = !muted;
            setMuted(next);
            if (video) video.muted = next;
          }}
          aria-label={muted ? "Unmute trailer" : "Mute trailer"}
          className="absolute bottom-6 right-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/50 text-nx-ink backdrop-blur transition hover:scale-110 hover:bg-black/70 focus:outline-none focus-visible:nx-focus md:right-12"
        >
          {muted ? <FaVolumeMute /> : <FaVolumeUp />}
        </button>
      )}
    </div>
  );
}
