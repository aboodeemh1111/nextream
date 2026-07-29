"use client";

import Link from "next/link";
import { FaPlay } from "react-icons/fa";
import Art from "@/components/series/Art";
import { MatchScore, MetaLine, Pill } from "@/components/series/Bits";
import { cn } from "@/lib/cn";
import { SearchResult } from "@/lib/search";
import { Highlight, KindIcon } from "./Bits";

/**
 * One result on the results page.
 *
 * Deliberately not MediaCard. That card is built for a row: it hides its title
 * until hover, because in a row the artwork is the identifier and the viewer is
 * browsing. On a results page the viewer has already named what they want, so
 * the title is the thing that has to be visible — with the matched characters
 * marked, so a fuzzy or acronym hit explains itself instead of looking like a
 * mistake.
 */
export default function ResultCard({ result }: { result: SearchResult }) {
  const wide = result.kind === "episode";

  return (
    <article className="group relative">
      <Link
        href={result.href}
        className="block focus:outline-none focus-visible:nx-focus"
        aria-label={result.title}
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-xl bg-nx-surface ring-1 ring-white/10 transition duration-300 group-hover:ring-white/30",
            wide ? "aspect-video" : "aspect-[2/3]"
          )}
        >
          <Art
            src={result.poster}
            alt={result.title}
            fallbackLabel={false}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 16vw"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />

          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20"
            aria-hidden
          />

          <Pill tone="glass" className="absolute left-2 top-2 gap-1">
            <KindIcon kind={result.kind} className="text-[8px]" />
            {result.badge}
          </Pill>

          {result.maturity ? (
            <span className="absolute right-2 top-2 rounded border border-white/25 bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-nx-ink backdrop-blur-sm">
              {result.maturity}+
            </span>
          ) : null}

          {result.playHref && (
            <span
              className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100"
              aria-hidden
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-sm text-black shadow-lg">
                <FaPlay className="ml-0.5" />
              </span>
            </span>
          )}
        </div>
      </Link>

      <div className="mt-2">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-nx-ink">
          <Link href={result.href} className="hover:underline focus:outline-none focus-visible:nx-focus">
            <Highlight text={result.title} ranges={result.highlight} />
          </Link>
        </h3>

        {result.subtitle && (
          <p className="mt-0.5 truncate text-[11px] text-nx-muted">{result.subtitle}</p>
        )}

        <MetaLine parts={result.meta.slice(0, 2)} className="mt-1 text-[11px] text-nx-dim" />

        {result.match !== null && (
          <MatchScore score={result.match} className="mt-1 block text-[11px]" />
        )}

        {result.reason && (
          <p className="mt-1 truncate text-[11px] text-nx-dim">{result.reason}</p>
        )}
      </div>
    </article>
  );
}
