"use client";

import Link from "next/link";
import { FaPlay, FaStar } from "react-icons/fa";
import Art from "@/components/series/Art";
import { Pill } from "@/components/series/Bits";
import Reveal from "./Reveal";

export interface SimilarMovie {
  _id: string;
  title: string;
  desc?: string;
  img?: string;
  imgSm?: string;
  year?: string;
  limit?: number;
  duration?: string;
  genre?: string;
  avgRating?: number;
}

/**
 * The "More Like This" grid.
 *
 * Landscape tiles rather than posters, because the catalogue only reliably has
 * a backdrop for every title — `imgSm` is optional and a poster frame cropped
 * from a 16:9 still looks like a mistake.
 *
 * Staggered by index so the grid assembles in a diagonal instead of all at
 * once, capped at 240ms so the last tile never feels like it is lagging.
 */
export default function SimilarGrid({ movies }: { movies: SimilarMovie[] }) {
  if (!movies.length) {
    return (
      <p className="py-16 text-center text-sm text-nx-muted">
        Nothing comparable in the catalogue yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {movies.map((movie, index) => (
        <Reveal key={movie._id} delay={Math.min(index * 40, 240)}>
          <Link
            href={`/details/${movie._id}`}
            className="group block overflow-hidden rounded-xl border border-nx-line bg-nx-surface transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-nx-elevated hover:shadow-2xl hover:shadow-black/60 focus:outline-none focus-visible:nx-focus"
          >
            <div className="relative aspect-video overflow-hidden bg-nx-black">
              <Art
                src={movie.img || movie.imgSm}
                alt={movie.title}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="inline-flex h-12 w-12 scale-75 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform duration-300 group-hover:scale-100">
                  <FaPlay className="ml-0.5" />
                </span>
              </span>

              {movie.avgRating ? (
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-yellow-400 backdrop-blur">
                  <FaStar className="text-[9px]" />
                  {movie.avgRating.toFixed(1)}
                </span>
              ) : null}
            </div>

            <div className="p-3">
              <p className="truncate text-sm font-semibold text-nx-ink">{movie.title}</p>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-nx-muted">
                {movie.year && <span>{movie.year}</span>}
                {movie.limit ? <Pill tone="outline">{movie.limit}+</Pill> : null}
                {movie.duration && <span>{movie.duration}</span>}
              </div>

              {movie.desc && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-nx-dim">
                  {movie.desc}
                </p>
              )}
            </div>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}
