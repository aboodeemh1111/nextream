"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaArrowRight, FaClock, FaMagic, FaPlay, FaSearch, FaTimes } from "react-icons/fa";
import Art from "@/components/series/Art";
import useInstantSearch from "@/hooks/useInstantSearch";
import { cn } from "@/lib/cn";
import {
  clearRecentSearches,
  pushRecentSearch,
  readRecentSearches,
  removeRecentSearch,
  SearchResult,
  searchHref,
  SuggestResponse,
} from "@/lib/search";
import { Highlight, Kbd, KindIcon, Match, SectionLabel, Thumb } from "./Bits";

/**
 * The search palette.
 *
 * What it replaces: a 48px-wide input in the navbar whose dropdown listed up to
 * eight movie titles. It could not reach the TVShow catalogue or episodes, it
 * had no keyboard affordance, its "advanced search" was two <select>s behind a
 * funnel icon, and one typo emptied it.
 *
 * The shape here is a command palette rather than a dropdown, because search is
 * the fastest route to anything in a catalogue and it should be reachable from
 * anywhere without touching the mouse — ⌘K, or "/" from any page.
 *
 * Everything navigable, in every state, is flattened into one `entries` array.
 * That is the whole trick to the keyboard handling: a recent search, a genre
 * chip, a result and the "see all" footer are all one list as far as ↑/↓ are
 * concerned, so the arrow keys never dead-end on a section the renderer knows
 * about but the navigation does not.
 */

interface SearchCommandProps {
  open: boolean;
  onClose: () => void;
  /** Seeds the box — the results page opens it pre-filled with its own query. */
  initialQuery?: string;
}

type Entry =
  | { kind: "result"; id: string; result: SearchResult }
  | {
      kind: "term";
      id: string;
      term: string;
      label: string;
      icon: React.ReactNode;
      /** Recent searches can be forgotten; genre suggestions cannot. */
      removable?: boolean;
    }
  | { kind: "link"; id: string; href: string; label: string };

interface Section {
  key: string;
  label?: string;
  action?: React.ReactNode;
  entries: Entry[];
  /** The top result gets its own presentation rather than a list row. */
  variant?: "hero" | "rows" | "chips";
}

export default function SearchCommand({ open, onClose, initialQuery = "" }: SearchCommandProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const { data, loading, stale, error } = useInstantSearch(query, open);
  const trimmed = query.trim();

  // --- lifecycle -------------------------------------------------------------

  useEffect(() => {
    if (!open) return;

    restoreFocus.current = document.activeElement as HTMLElement | null;
    setQuery(initialQuery);
    setActive(0);
    setRecent(readRecentSearches());

    // The page behind the overlay must not scroll under it — on iOS especially,
    // a scrollable body swallows the drag that should be scrolling the results.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Not requestAnimationFrame: rAF is tied to painting, and a browser that is
    // not compositing (a background tab, a hidden pane) never runs the callback
    // — which leaves the palette open with focus still on the page behind it.
    // The timeout is a retry for the case where the element is not yet
    // focusable on the same tick, not a replacement for the direct call.
    inputRef.current?.focus();
    const retry = setTimeout(() => inputRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = overflow;
      clearTimeout(retry);
      restoreFocus.current?.focus?.();
    };
    // initialQuery is read once per opening, deliberately: re-seeding mid-session
    // would fight the viewer's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const go = useCallback(
    (href: string, term?: string) => {
      if (term) setRecent(pushRecentSearch(term));
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  // --- what is on screen, and in what order ---------------------------------

  const sections = useMemo<Section[]>(() => {
    if (!trimmed) {
      return zeroState(data, recent, () => setRecent(clearRecentSearches()));
    }
    return resultState(data, trimmed);
  }, [data, recent, trimmed]);

  const entries = useMemo(() => sections.flatMap((section) => section.entries), [sections]);

  // A repaint can shorten the list under the cursor; clamping rather than
  // resetting keeps the selection near where the viewer left it.
  useEffect(() => {
    setActive((index) => (entries.length ? Math.min(index, entries.length - 1) : 0));
  }, [entries.length]);

  useEffect(() => {
    setActive(0);
  }, [trimmed]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-entry="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, sections]);

  const select = useCallback(
    (entry: Entry | undefined, play = false) => {
      if (!entry) {
        if (trimmed) go(searchHref({ q: trimmed }), trimmed);
        return;
      }

      if (entry.kind === "term") {
        setQuery(entry.term);
        inputRef.current?.focus();
        return;
      }

      if (entry.kind === "link") {
        go(entry.href, trimmed);
        return;
      }

      const target = play ? entry.result.playHref || entry.result.href : entry.result.href;
      go(target, trimmed);
    },
    [go, trimmed]
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!entries.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      // Wraps, so "See all results" at the bottom is one ↑ away from the top.
      setActive((index) => (index + step + entries.length) % entries.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActive(Math.max(0, entries.length - 1));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      select(entries[active], event.altKey || event.metaKey || event.ctrlKey);
    }
  };

  if (!open) return null;

  const understood = data?.understood ?? [];
  const showEmpty = Boolean(trimmed) && !loading && !stale && data && data.total === 0;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" role="presentation">
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/75 backdrop-blur-sm animate-nx-fade"
        tabIndex={-1}
      />

      <div className="relative mx-auto flex h-full w-full max-w-2xl flex-col sm:h-auto sm:px-4 sm:pt-[7vh]">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search Nextream"
          onKeyDown={onKeyDown}
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden border-white/10 bg-[#0b0b10]/95 shadow-[0_40px_120px_-24px_rgba(0,0,0,0.95)] backdrop-blur-2xl",
            "sm:flex-none sm:rounded-2xl sm:border animate-nx-rise"
          )}
        >
          {/* --- input ------------------------------------------------------ */}
          <div className="relative flex items-center gap-3 px-4 py-3.5 sm:px-5">
            <FaSearch className="shrink-0 text-sm text-nx-dim" aria-hidden />

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, genres, episodes…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              role="combobox"
              aria-expanded
              aria-controls="nx-search-results"
              aria-activedescendant={entries.length ? `nx-search-entry-${active}` : undefined}
              className="min-w-0 flex-1 bg-transparent text-base text-nx-ink outline-none placeholder:text-nx-dim sm:text-[15px]"
            />

            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="rounded-full p-1.5 text-nx-dim transition hover:bg-white/10 hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
              >
                <FaTimes className="text-xs" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="hidden rounded-md border border-white/15 px-2 py-1 text-[10px] font-semibold text-nx-muted transition hover:border-white/30 hover:text-nx-ink focus:outline-none focus-visible:nx-focus sm:block"
            >
              ESC
            </button>

            {/* Progress rather than a spinner: it sits on the seam between the
                input and the results, so a refresh reads as the list updating
                rather than as the panel reloading. */}
            <span
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden bg-white/10",
                loading ? "opacity-100" : "opacity-0"
              )}
              aria-hidden
            >
              <span className="absolute inset-y-0 w-1/3 animate-nx-slide bg-gradient-to-r from-transparent via-nx-cyan to-transparent" />
            </span>
          </div>

          {/* --- what the query was understood to mean ---------------------- */}
          {understood.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] px-4 py-2.5 sm:px-5">
              <FaMagic className="mr-0.5 text-[10px] text-nx-violet" aria-hidden />
              <span className="mr-1 text-[11px] text-nx-dim">Reading this as</span>
              {understood.map((filter) => (
                <span
                  key={`${filter.type}:${filter.value}`}
                  className="rounded-full border border-nx-violet/30 bg-nx-violet/10 px-2.5 py-0.5 text-[11px] font-semibold text-nx-ink"
                >
                  {filter.label}
                </span>
              ))}
              {data?.relaxed && (
                <span className="text-[11px] text-amber-300/90">
                  · nothing matched all of it, showing the closest
                </span>
              )}
            </div>
          )}

          {/* --- results ---------------------------------------------------- */}
          <div
            ref={listRef}
            id="nx-search-results"
            role="listbox"
            aria-label="Search results"
            className="nx-scroll-x min-h-0 flex-1 overflow-y-auto border-t border-white/[0.06] pb-2 sm:max-h-[58vh] sm:flex-none"
          >
            {data?.didYouMean && (
              <button
                type="button"
                onClick={() => setQuery(data.didYouMean as string)}
                className="mx-3 mt-3 flex w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-left text-[13px] text-nx-muted transition hover:border-amber-400/50 focus:outline-none focus-visible:nx-focus"
              >
                Did you mean{" "}
                <span className="font-semibold text-amber-300">{data.didYouMean}</span>?
              </button>
            )}

            {showEmpty && <EmptyState query={trimmed} />}

            {error && !data && (
              <p className="px-4 py-10 text-center text-sm text-nx-muted">{error}</p>
            )}

            {sections.map((section) => (
              <SectionView
                key={section.key}
                section={section}
                entries={entries}
                active={active}
                onHover={setActive}
                onSelect={select}
                onForget={(term) => setRecent(removeRecentSearch(term))}
              />
            ))}
          </div>

          {/* --- legend ----------------------------------------------------- */}
          <div className="hidden items-center gap-4 border-t border-white/[0.06] px-5 py-2.5 text-[11px] text-nx-dim sm:flex">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd> open
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>alt</Kbd>
              <Kbd>↵</Kbd> play
            </span>
            {data && data.total > 0 && (
              <span className="ml-auto tabular-nums">
                {data.total} result{data.total === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- state builders ----------------------------------------------------------

/**
 * Before anything is typed.
 *
 * An empty panel is a dead end, and "recent searches" alone is one for anybody
 * who has never searched. The catalogue's own most-watched titles and its real
 * genre list give a first-time viewer somewhere to go.
 */
function zeroState(
  data: SuggestResponse | null,
  recent: string[],
  onClearRecent: () => void
): Section[] {
  const sections: Section[] = [];

  if (recent.length) {
    sections.push({
      key: "recent",
      label: "Recent",
      variant: "rows",
      action: (
        <button
          type="button"
          onClick={onClearRecent}
          className="text-[11px] font-semibold text-nx-dim transition hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
        >
          Clear
        </button>
      ),
      entries: recent.map((term) => ({
        kind: "term" as const,
        id: `recent:${term}`,
        term,
        label: term,
        removable: true,
        icon: <FaClock className="text-[11px] text-nx-dim" aria-hidden />,
      })),
    });
  }

  if (data?.trending?.length) {
    sections.push({
      key: "trending",
      label: "Trending now",
      variant: "rows",
      entries: data.trending.slice(0, 6).map((result) => ({
        kind: "result" as const,
        id: result.uid,
        result,
      })),
    });
  }

  if (data?.genres?.length) {
    sections.push({
      key: "genres",
      label: "Browse by genre",
      variant: "chips",
      entries: data.genres.map((genre) => ({
        kind: "term" as const,
        id: `genre:${genre.value}`,
        term: String(genre.label),
        label: String(genre.label),
        icon: null,
      })),
    });
  }

  return sections;
}

function resultState(data: SuggestResponse | null, query: string): Section[] {
  if (!data || !data.total) return [];

  const sections: Section[] = [];

  if (data.top) {
    sections.push({
      key: "top",
      label: "Top result",
      variant: "hero",
      entries: [{ kind: "result", id: data.top.uid, result: data.top }],
    });
  }

  for (const group of data.groups) {
    sections.push({
      key: group.key,
      label: group.title,
      variant: "rows",
      entries: group.items.map((result) => ({
        kind: "result" as const,
        id: result.uid,
        result,
      })),
    });
  }

  sections.push({
    key: "all",
    variant: "rows",
    entries: [
      {
        kind: "link",
        id: "see-all",
        href: searchHref({ q: query }),
        label: `See all ${data.total} result${data.total === 1 ? "" : "s"} for “${query}”`,
      },
    ],
  });

  return sections;
}

// --- rendering ---------------------------------------------------------------

function SectionView({
  section,
  entries,
  active,
  onHover,
  onSelect,
  onForget,
}: {
  section: Section;
  entries: Entry[];
  active: number;
  onHover: (index: number) => void;
  onSelect: (entry: Entry, play?: boolean) => void;
  onForget?: (term: string) => void;
}) {
  if (!section.entries.length) return null;

  const indexOf = (entry: Entry) => entries.indexOf(entry);

  if (section.variant === "chips") {
    return (
      <div>
        {section.label && (
        <SectionLabel action={section.action}>{section.label}</SectionLabel>
      )}
        <div className="flex flex-wrap gap-1.5 px-3 pb-1">
          {section.entries.map((entry) => {
            const index = indexOf(entry);
            return (
              <button
                key={entry.id}
                id={`nx-search-entry-${index}`}
                data-entry={index}
                role="option"
                aria-selected={index === active}
                type="button"
                onMouseMove={() => onHover(index)}
                onClick={() => onSelect(entry)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition focus:outline-none",
                  index === active
                    ? "border-white/40 bg-white/15 text-nx-ink"
                    : "border-white/10 bg-white/[0.05] text-nx-muted hover:text-nx-ink"
                )}
              >
                {entry.kind === "term" ? entry.label : ""}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {section.label && (
        <SectionLabel action={section.action}>{section.label}</SectionLabel>
      )}
      <div className={section.variant === "hero" ? "px-3" : "px-1.5"}>
        {section.entries.map((entry) => {
          const index = indexOf(entry);
          const selected = index === active;

          if (entry.kind === "result" && section.variant === "hero") {
            return (
              <HeroRow
                key={entry.id}
                index={index}
                selected={selected}
                result={entry.result}
                onHover={onHover}
                onSelect={(play) => onSelect(entry, play)}
              />
            );
          }

          return (
            <Row
              key={entry.id}
              index={index}
              selected={selected}
              entry={entry}
              onHover={onHover}
              onSelect={(play) => onSelect(entry, play)}
              onForget={onForget}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * The top result, given the space to be recognised rather than read.
 *
 * When someone types most of a title they have already decided; showing that one
 * as artwork with a Play button turns the search box into a two-keystroke route
 * to playback instead of a list to scan.
 */
function HeroRow({
  index,
  selected,
  result,
  onHover,
  onSelect,
}: {
  index: number;
  selected: boolean;
  result: SearchResult;
  onHover: (index: number) => void;
  onSelect: (play?: boolean) => void;
}) {
  return (
    <div
      id={`nx-search-entry-${index}`}
      data-entry={index}
      role="option"
      aria-selected={selected}
      onMouseMove={() => onHover(index)}
      onClick={() => onSelect()}
      className={cn(
        "group relative mb-1 flex cursor-pointer items-stretch gap-3 overflow-hidden rounded-xl border p-2.5 transition",
        selected ? "border-white/25 bg-white/[0.09]" : "border-white/[0.07] bg-white/[0.03]"
      )}
    >
      <div className="relative h-[4.5rem] w-32 shrink-0 overflow-hidden rounded-lg bg-nx-surface ring-1 ring-white/10">
        <Art
          src={result.backdrop || result.poster}
          alt=""
          fallbackLabel={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-nx-ink">
            <KindIcon kind={result.kind} className="text-[8px]" />
            {result.badge}
          </span>
          {result.reason && (
            <span className="truncate text-[11px] text-nx-muted">{result.reason}</span>
          )}
        </div>

        <h3 className="mt-1 truncate text-[15px] font-bold text-nx-ink">
          <Highlight text={result.title} ranges={result.highlight} />
        </h3>

        <div className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-nx-muted">
          <Match score={result.match} />
          {result.subtitle && <span className="truncate">{result.subtitle}</span>}
          {result.meta.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-center pr-1">
        {result.playHref && (
          <button
            type="button"
            aria-label={`Play ${result.title}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(true);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[11px] text-black transition hover:bg-white/85 focus:outline-none focus-visible:nx-focus"
          >
            <FaPlay className="ml-0.5" aria-hidden />
          </button>
        )}
        <FaArrowRight
          className={cn(
            "text-xs transition",
            selected ? "text-nx-ink" : "text-nx-dim opacity-0 group-hover:opacity-100"
          )}
          aria-hidden
        />
      </div>
    </div>
  );
}

function Row({
  index,
  selected,
  entry,
  onHover,
  onSelect,
  onForget,
}: {
  index: number;
  selected: boolean;
  entry: Entry;
  onHover: (index: number) => void;
  onSelect: (play?: boolean) => void;
  onForget?: (term: string) => void;
}) {
  const base = cn(
    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition focus:outline-none",
    selected ? "bg-white/[0.09]" : "hover:bg-white/[0.05]"
  );

  const shared = {
    id: `nx-search-entry-${index}`,
    "data-entry": index,
    role: "option" as const,
    "aria-selected": selected,
    onMouseMove: () => onHover(index),
    onClick: () => onSelect(),
  };

  if (entry.kind === "term") {
    return (
      <div {...shared} className={base}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.06]">
          {entry.icon ?? <FaSearch className="text-[11px] text-nx-dim" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-nx-ink">{entry.label}</span>
        {entry.removable && (
          <button
            type="button"
            aria-label={`Forget the search “${entry.label}”`}
            onClick={(event) => {
              event.stopPropagation();
              onForget?.(entry.term);
            }}
            className={cn(
              "rounded p-1 text-nx-dim transition hover:text-nx-ink focus:outline-none focus-visible:nx-focus",
              selected ? "opacity-100" : "opacity-0"
            )}
          >
            <FaTimes className="text-[10px]" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  if (entry.kind === "link") {
    return (
      <div {...shared} className={cn(base, "mt-1 border-t border-white/[0.06] pt-3")}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-nx-accent/15">
          <FaSearch className="text-[11px] text-nx-accent-soft" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-nx-ink">
          {entry.label}
        </span>
        <FaArrowRight className="text-[11px] text-nx-dim" aria-hidden />
      </div>
    );
  }

  const { result } = entry;

  return (
    <div {...shared} className={base}>
      <Thumb result={result} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-nx-ink">
          <Highlight text={result.title} ranges={result.highlight} />
        </div>
        <div className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-nx-muted">
          {result.subtitle ? (
            <span className="truncate">{result.subtitle}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-nx-dim">
              <KindIcon kind={result.kind} className="text-[8px]" />
              {result.badge}
            </span>
          )}
          {result.meta.slice(0, 2).map((part) => (
            <span key={part} className="shrink-0">
              {part}
            </span>
          ))}
          <Match score={result.match} />
        </div>
      </div>

      {result.reason && (
        <span className="hidden shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-nx-muted sm:block">
          {result.reason}
        </span>
      )}

      <FaArrowRight
        className={cn("shrink-0 text-[11px]", selected ? "text-nx-ink" : "text-transparent")}
        aria-hidden
      />
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <FaSearch className="mx-auto mb-3 text-2xl text-nx-dim" aria-hidden />
      <p className="text-sm font-semibold text-nx-ink">No results for “{query}”</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-nx-muted">
        Try a shorter query, a genre like <em className="not-italic text-nx-ink">horror series</em>,
        or a year like <em className="not-italic text-nx-ink">comedy 2019</em>.
      </p>
    </div>
  );
}
