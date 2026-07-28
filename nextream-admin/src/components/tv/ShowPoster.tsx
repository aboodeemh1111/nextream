"use client";

import { useState } from "react";
import { FaTv } from "react-icons/fa";
import { cn } from "@/lib/cn";
import { isUrlLike } from "@/lib/media";

/**
 * Poster with a real fallback.
 *
 * The grid used to render `<img src={show.poster}>` unguarded. Media is stored
 * as a storage key and signed into a URL on read, but legacy values (dead
 * Firebase links, URLs saved back into Mongo before write-normalisation, keys
 * the signer could not resolve) come through as-is — so the card showed a
 * broken-image icon with the show's title spilling out of it as alt text.
 */
export function ShowPoster({
  src,
  title,
  className,
  rounded = "rounded-card",
}: {
  src?: string;
  title: string;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const usable = isUrlLike(src) && !failed;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-surface-2 border border-border",
        rounded,
        className
      )}
    >
      {usable ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
          <FaTv className="text-xl text-subtle-foreground" aria-hidden />
          <span className="line-clamp-2 text-xs text-subtle-foreground">
            {src ? "Artwork unavailable" : "No artwork"}
          </span>
        </div>
      )}
      <span className="sr-only">{title}</span>
    </div>
  );
}
