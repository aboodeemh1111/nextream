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
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-nx-surface text-nx-dim",
          className
        )}
      >
        {fallback ?? (
          <span className="px-3 text-center text-[11px] font-medium leading-tight line-clamp-3">
            {alt}
          </span>
        )}
      </div>
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
