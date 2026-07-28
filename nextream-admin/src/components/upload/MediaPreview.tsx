"use client";

import { useRef, useState } from "react";
import { FaFileAlt, FaImage, FaPlay, FaVideo } from "react-icons/fa";
import { cn } from "@/lib/cn";

export type MediaKind = "image" | "video" | "subtitle";
export type MediaAspect = "poster" | "wide" | "square";

export const ASPECT_CLASS: Record<MediaAspect, string> = {
  poster: "aspect-2/3",
  wide: "aspect-video",
  square: "aspect-square",
};

/**
 * Renders whatever a media field is holding.
 *
 * Video fields previously showed nothing but the word "Uploaded" in green, so
 * there was no way to tell from the admin whether the file that landed was the
 * right one — or playable at all.
 */
export function MediaPreview({
  url,
  kind,
  aspect = "wide",
  alt,
  className,
}: {
  url?: string;
  kind: MediaKind;
  aspect?: MediaAspect;
  alt?: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const frame = cn(
    "relative overflow-hidden rounded-control bg-surface-2 border border-border",
    ASPECT_CLASS[aspect],
    className
  );

  if (!url || failed) {
    return (
      <div className={cn(frame, "flex flex-col items-center justify-center gap-1.5")}>
        <span className="text-xl text-subtle-foreground" aria-hidden>
          {kind === "video" ? <FaVideo /> : kind === "subtitle" ? <FaFileAlt /> : <FaImage />}
        </span>
        <span className="text-xs text-subtle-foreground">
          {failed ? "Preview unavailable" : "No file yet"}
        </span>
      </div>
    );
  }

  if (kind === "subtitle") {
    return (
      <div className={cn(frame, "flex flex-col items-center justify-center gap-1.5")}>
        <span className="text-xl text-success" aria-hidden>
          <FaFileAlt />
        </span>
        <span className="text-xs text-muted-foreground">Subtitle track ready</span>
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className={cn(frame, "group")}>
        <video
          ref={videoRef}
          src={url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          onEnded={() => {
            setPlaying(false);
            if (videoRef.current) videoRef.current.controls = false;
          }}
          onLoadedMetadata={() => {
            // Seek slightly in so the poster frame is not a black leader.
            const video = videoRef.current;
            if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
            video.currentTime = Math.min(video.duration * 0.1, 3);
          }}
        />
        {!playing && (
          <button
            type="button"
            aria-label={alt ? `Play ${alt}` : "Play video"}
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              setPlaying(true);
              video.controls = true;
              video.muted = false;
              void video.play();
            }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/45" />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-raised transition-transform group-hover:scale-110">
              <FaPlay className="ml-0.5" />
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={frame}>
      {/* An unreachable image renders as a broken icon with alt text spilling
          out of it — the exact failure the show grid was showing. */}
      <img
        src={url}
        alt={alt ?? ""}
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
