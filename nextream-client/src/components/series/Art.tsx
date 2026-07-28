"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface ArtProps {
  src?: string | null;
  alt: string;
  className?: string;
  /** Above-the-fold art (billboard) should not wait for the lazy observer. */
  priority?: boolean;
  sizes?: string;
  /** Shown when there is no src, or the fetch fails. */
  fallback?: React.ReactNode;
  /**
   * Caption printed on the generated placeholder. Defaults to `alt`; pass
   * `false` where the surrounding layout already prints the title (billboard,
   * episode still) so the placeholder does not say it twice.
   */
  fallbackLabel?: string | false;
}

/**
 * Catalogue artwork.
 *
 * Deliberately a plain <img> rather than next/image. Media URLs are S3
 * pre-signed and carry a rotating SigV4 query string, so the optimizer would
 * cache under a key that expires and re-fetch the original every TTL — and the
 * bucket host is env-configured (S3_PUBLIC_ENDPOINT), so it cannot be pinned in
 * next.config.js remotePatterns without a deploy-time guess. A miss there is a
 * hard 400 on every image, which is a far worse failure than skipping
 * optimization on files the pipeline already sized.
 *
 * Handles its own skeleton and error state so no caller has to.
 *
 * Remounts when `src` changes (`key`) so recycled cards never keep a previous
 * "ready"/"error" status. Cached loads are handled via `img.complete` in
 * layout — otherwise onLoad can fire before effects run and a late "loading"
 * reset leaves the image stuck at opacity-0 (common after watch → back).
 */
export default function Art(props: ArtProps) {
  return <ArtInner key={props.src || ""} {...props} />;
}

function ArtInner({
  src,
  alt,
  className,
  priority = false,
  sizes,
  fallback,
  fallbackLabel,
}: ArtProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    src ? "loading" : "error"
  );

  useLayoutEffect(() => {
    if (!src) {
      setStatus("error");
      return;
    }
    const img = imgRef.current;
    if (img?.complete) {
      setStatus(img.naturalWidth > 0 ? "ready" : "error");
    }
  }, [src]);

  if (!src || status === "error") {
    if (fallback) {
      return (
        <div
          className={cn(
            "flex items-center justify-center bg-nx-surface text-nx-dim",
            className
          )}
        >
          {fallback}
        </div>
      );
    }

    return (
      <ArtPlaceholder
        seed={alt}
        label={fallbackLabel === false ? null : fallbackLabel || alt}
        className={className}
      />
    );
  }

  return (
    <>
      {status === "loading" && (
        <div className={cn("nx-skeleton absolute inset-0", className)} aria-hidden />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
        className={cn(
          "transition-opacity duration-500",
          status === "ready" ? "opacity-100" : "opacity-0",
          className
        )}
      />
    </>
  );
}

/**
 * Generated artwork for a title with no poster.
 *
 * Most of the catalogue is published without art, and the old fallback — 11px
 * of centred grey text on a flat surface — turned every one of those into an
 * indistinguishable black rectangle. A tinted gradient plus an oversized
 * monogram gives each show a stable identity you can scan a row by, and the
 * caption keeps it readable at tile size.
 *
 * The hue is derived from the title so a show looks the same in every row it
 * appears in, and the monogram is SVG so it scales with the tile instead of
 * needing a size prop from each caller.
 */
function ArtPlaceholder({
  seed,
  label,
  className,
}: {
  seed: string;
  label: string | null;
  className?: string;
}) {
  const hue = hueFor(seed);
  const initials = initialsFor(seed);

  return (
    <div
      className={cn("relative flex items-end overflow-hidden bg-nx-surface", className)}
      style={{
        backgroundImage: [
          `radial-gradient(115% 85% at 12% 0%, hsl(${hue} 58% 30% / 0.9), transparent 62%)`,
          `radial-gradient(90% 70% at 100% 100%, hsl(${(hue + 46) % 360} 62% 26% / 0.75), transparent 60%)`,
          "linear-gradient(155deg, #16161d 0%, #0b0b10 78%)",
        ].join(","),
      }}
      aria-hidden={label ? undefined : true}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="46"
          fontWeight="800"
          letterSpacing="-2"
          fill="#ffffff"
          fillOpacity="0.14"
          style={{ fontFamily: "inherit" }}
        >
          {initials}
        </text>
      </svg>

      {label && (
        <div className="relative w-full bg-gradient-to-t from-black/75 via-black/35 to-transparent px-2.5 pb-2.5 pt-6">
          <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-white/85">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

/** Stable hue per title, so the same show keeps its colour across every row. */
function hueFor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % 360;
}

/** First letter of the first and last word — "Tom and Jerry" reads as "TJ". */
function initialsFor(label: string) {
  const words = label
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : words[0][1] || "";
  return (first + last).toUpperCase();
}
