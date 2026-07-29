"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaChevronDown, FaSearch, FaSlidersH, FaTimes } from "react-icons/fa";
import Navbar from "@/components/Navbar";
import ResultCard from "@/components/search/ResultCard";
import { GUTTER } from "@/components/series/Bits";
import { useSearchPalette } from "@/components/search/SearchProvider";
import { cn } from "@/lib/cn";
import {
  Facet,
  isAbort,
  search,
  SearchResponse,
  searchHref,
  SORT_OPTIONS,
} from "@/lib/search";

/**
 * Search results.
 *
 * What this replaces: a grid built from `/api/movies/search`, a raw axios call
 * that required a token (so signed-out visitors got nothing), returned movies
 * only, and rendered "Search Results for X" over whatever Mongo produced. The
 * only refinement was whichever two <select>s the navbar had been holding when
 * you pressed enter, and they were unreadable from the page itself.
 *
 * Refinements live in the URL now. That is what makes them shareable, reachable
 * from the back button, and — the reason they are here at all — visible: a
 * filter you cannot see applied is a filter you cannot argue with when the
 * results look wrong.
 */

function Results() {
  const params = useSearchParams();
  const router = useRouter();
  const { openSearch } = useSearchPalette();

  const query = params.get("q") || "";
  const kind = params.get("kind") || "";
  const genre = params.get("genre") || "";
  const decade = params.get("decade") || "";
  const sort = params.get("sort") || "relevance";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();

    setLoading(true);
    setError(null);

    search
      .results(
        {
          q: query,
          kind: kind || undefined,
          genre: genre || undefined,
          decade: decade ? Number(decade) : undefined,
          sort: sort !== "relevance" ? sort : undefined,
          page,
          pageSize: 24,
        },
        abort.signal
      )
      .then((response) => {
        setData(response);
        setLoading(false);
      })
      .catch((err) => {
        if (isAbort(err)) return;
        setError("We couldn't reach search just now. Try again in a moment.");
        setLoading(false);
      });

    return () => abort.abort();
  }, [query, kind, genre, decade, sort, page]);

  /** Every refinement is a navigation, so back always undoes exactly one. */
  const refine = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      // Any refinement invalidates the page number: page 3 of the old result
      // set is rarely a page at all in the new one.
      if (!("page" in patch)) next.delete("page");
      router.push(`/search?${next.toString()}`);
    },
    [params, router]
  );

  const active = [
    kind && { key: "kind", label: labelFor(data?.facets.kinds, kind) },
    genre && { key: "genre", label: labelFor(data?.facets.genres, genre) },
    decade && { key: "decade", label: `${decade}s` },
    sort !== "relevance" && {
      key: "sort",
      label: SORT_OPTIONS.find((option) => option.value === sort)?.label || sort,
    },
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  const results = data?.results ?? [];

  return (
    <div className={cn("pb-16 pt-20", GUTTER)}>
      {/* --- heading -------------------------------------------------------- */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => openSearch(query)}
          className="group mb-4 flex w-full max-w-2xl items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:border-white/25 hover:bg-white/[0.07] focus:outline-none focus-visible:nx-focus"
        >
          <FaSearch className="shrink-0 text-sm text-nx-dim" aria-hidden />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[15px]",
              query ? "text-nx-ink" : "text-nx-dim"
            )}
          >
            {query || "Search titles, genres, episodes…"}
          </span>
          <span className="shrink-0 text-[11px] font-semibold text-nx-dim group-hover:text-nx-muted">
            Edit
          </span>
        </button>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-nx-ink md:text-3xl">
            {query ? <>Results for “{query}”</> : "Browse everything"}
          </h1>
          {data && !loading && (
            <span className="text-sm text-nx-muted">
              {data.total} {data.total === 1 ? "title" : "titles"}
            </span>
          )}
        </div>

        {data?.understood && data.understood.length > 0 && (
          <p className="mt-1.5 text-[13px] text-nx-muted">
            Read as{" "}
            {data.understood.map((filter, index) => (
              <span key={`${filter.type}:${filter.value}`}>
                {index > 0 && " · "}
                <span className="font-semibold text-nx-ink">{filter.label}</span>
              </span>
            ))}
            {data.relaxed && (
              <span className="text-amber-300/90">
                {" "}
                — nothing matched all of it, so the closest results are shown
              </span>
            )}
          </p>
        )}

        {data?.didYouMean && (
          <p className="mt-2 text-[13px] text-nx-muted">
            Did you mean{" "}
            <a
              href={searchHref({ q: data.didYouMean })}
              className="font-semibold text-amber-300 underline-offset-4 hover:underline"
            >
              {data.didYouMean}
            </a>
            ?
          </p>
        )}
      </div>

      {/* --- refinements ---------------------------------------------------- */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-y border-white/[0.07] py-3">
        <FaSlidersH className="mr-1 text-[11px] text-nx-dim" aria-hidden />

        <FacetSelect
          id="search-kind"
          label="Type"
          value={kind}
          onChange={(value) => refine({ kind: value })}
          options={[
            { value: "", label: "All types" },
            ...(data?.facets.kinds || []).map((facet) => ({
              value: String(facet.value),
              label: `${facet.label} (${facet.count})`,
            })),
          ]}
        />

        <FacetSelect
          id="search-genre"
          label="Genre"
          value={genre}
          onChange={(value) => refine({ genre: value })}
          options={[
            { value: "", label: "All genres" },
            ...(data?.facets.genres || []).slice(0, 20).map((facet) => ({
              value: String(facet.value),
              label: `${facet.label} (${facet.count})`,
            })),
          ]}
        />

        <FacetSelect
          id="search-decade"
          label="Decade"
          value={decade}
          onChange={(value) => refine({ decade: value })}
          options={[
            { value: "", label: "Any year" },
            ...(data?.facets.decades || []).map((facet) => ({
              value: String(facet.value),
              label: `${facet.label} (${facet.count})`,
            })),
          ]}
        />

        <FacetSelect
          id="search-sort"
          label="Sort"
          value={sort}
          onChange={(value) => refine({ sort: value === "relevance" ? undefined : value })}
          options={SORT_OPTIONS}
        />

        {active.length > 0 && (
          <>
            <span className="mx-1 hidden h-4 w-px bg-white/10 sm:block" aria-hidden />
            {active.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => refine({ [filter.key]: undefined })}
                className="group inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 py-1 pl-3 pr-2 text-xs font-medium text-nx-ink transition hover:border-white/40 focus:outline-none focus-visible:nx-focus"
              >
                {filter.label}
                <FaTimes className="text-[9px] text-nx-muted group-hover:text-nx-ink" aria-hidden />
                <span className="sr-only">Remove filter</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => router.push(searchHref({ q: query }))}
              className="ml-1 text-xs font-semibold text-nx-muted underline-offset-4 transition hover:text-nx-ink hover:underline focus:outline-none focus-visible:nx-focus"
            >
              Clear all
            </button>
          </>
        )}
      </div>

      {/* --- grid ----------------------------------------------------------- */}
      {loading && !data ? (
        <Grid>
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index}>
              <div className="nx-skeleton aspect-[2/3] rounded-xl" />
              <div className="nx-skeleton mt-2 h-3 w-3/4 rounded" />
            </div>
          ))}
        </Grid>
      ) : error ? (
        <p className="py-20 text-center text-sm text-nx-muted">{error}</p>
      ) : results.length === 0 ? (
        <Empty query={query} genres={data?.facets.genres || []} onPick={(value) => refine({ genre: value, kind: undefined, decade: undefined })} />
      ) : (
        <>
          <Grid className={loading ? "opacity-60 transition-opacity" : undefined}>
            {results.map((result) => (
              <ResultCard key={result.uid} result={result} />
            ))}
          </Grid>

          {(page > 1 || data?.hasMore) && (
            <div className="mt-10 flex items-center justify-center gap-3">
              <PageButton disabled={page <= 1} onClick={() => refine({ page: page - 1 })}>
                Previous
              </PageButton>
              <span className="text-xs text-nx-muted tabular-nums">
                Page {page} of {Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || 24)))}
              </span>
              <PageButton disabled={!data?.hasMore} onClick={() => refine({ page: page + 1 })}>
                Next
              </PageButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- pieces ------------------------------------------------------------------

function Grid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Native <select> with the platform chrome swapped for the app's own. */
function FacetSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="relative">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer appearance-none rounded-full border border-white/15 bg-white/[0.06] py-2 pl-3.5 pr-8 text-xs font-semibold text-nx-ink transition hover:border-white/30 focus:border-white/50 focus:outline-none focus-visible:nx-focus"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-nx-surface text-nx-ink">
            {option.label}
          </option>
        ))}
      </select>
      <FaChevronDown
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-nx-muted"
        aria-hidden
      />
    </div>
  );
}

function PageButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-nx-ink transition hover:border-white/35 disabled:cursor-not-allowed disabled:opacity-35 focus:outline-none focus-visible:nx-focus"
    >
      {children}
    </button>
  );
}

/**
 * Nothing found — but the facets are computed from the *unfiltered* match set,
 * so when a refinement is what emptied the page there is still something real
 * to offer instead of a dead end.
 */
function Empty({
  query,
  genres,
  onPick,
}: {
  query: string;
  genres: Facet[];
  onPick: (value: string) => void;
}) {
  return (
    <div className="py-20 text-center">
      <FaSearch className="mx-auto mb-4 text-3xl text-nx-dim" aria-hidden />
      <h2 className="text-lg font-bold text-nx-ink">
        {query ? <>Nothing matched “{query}”</> : "Nothing to show yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-nx-muted">
        Search understands genres, years and kinds — try{" "}
        <em className="not-italic text-nx-ink">horror series</em>,{" "}
        <em className="not-italic text-nx-ink">comedy 2019</em> or{" "}
        <em className="not-italic text-nx-ink">top rated animation</em>.
      </p>

      {genres.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {genres.slice(0, 8).map((facet) => (
            <button
              key={String(facet.value)}
              type="button"
              onClick={() => onPick(String(facet.value))}
              className="rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-nx-muted transition hover:border-white/30 hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
            >
              {facet.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function labelFor(facets: Facet[] | undefined, value: string): string {
  const match = facets?.find((facet) => String(facet.value) === value);
  return match?.label || value.charAt(0).toUpperCase() + value.slice(1);
}

export default function SearchPage() {
  return (
    <main className="min-h-screen bg-nx-bg">
      <Navbar />
      <Suspense
        fallback={
          <div className={cn("pb-16 pt-24", GUTTER)}>
            <div className="nx-skeleton h-8 w-64 rounded" />
          </div>
        }
      >
        <Results />
      </Suspense>
    </main>
  );
}
