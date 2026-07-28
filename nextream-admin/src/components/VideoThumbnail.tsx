"use client";

import { useRef, useState } from "react";
import { FaPlay } from "react-icons/fa";

interface VideoThumbnailProps {
  src: string;
  title: string;
}

/** Shows a paused frame from the video as a YouTube-style thumbnail preview. */
export default function VideoThumbnail({ src, title }: VideoThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [frameReady, setFrameReady] = useState(false);

  const seekToPreviewFrame = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;

    // Grab a frame ~10% in (or 1s), avoiding pure black opening frames
    const seekTo = Math.min(
      Math.max(video.duration * 0.1, Math.min(1, video.duration / 2)),
      Math.max(video.duration - 0.1, 0)
    );
    video.currentTime = seekTo;
  };

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    setPlaying(true);
    video.controls = true;
    video.muted = false;
    void video.play();
  };

  const handleEnded = () => {
    const video = videoRef.current;
    if (!video) return;
    setPlaying(false);
    video.controls = false;
    video.muted = true;
    seekToPreviewFrame();
  };

  return (
    <div className="aspect-video bg-background rounded-md overflow-hidden relative group">
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
        onLoadedMetadata={seekToPreviewFrame}
        onSeeked={() => setFrameReady(true)}
        onEnded={handleEnded}
      />

      {!frameReady && !playing && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}

      {!playing && (
        <button
          type="button"
          onClick={handlePlay}
          aria-label={`Play ${title}`}
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
        >
          <span className="absolute inset-0 bg-black/35 group-hover:bg-black/45 transition-colors" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg group-hover:scale-110 transition-transform">
            <FaPlay className="ml-1 text-xl" />
          </span>
        </button>
      )}
    </div>
  );
}
