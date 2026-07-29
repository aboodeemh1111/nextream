import api from "@/lib/axios";

/**
 * Typed client for catalogue search.
 *
 * The search box used to call `/movies/suggestions`, a title regex over the
 * Movie collection behind a token — so it could not find a show, could not find
 * an episode, returned nothing to a signed-out visitor, and returned nothing at
 * all if you mistyped. `/search` replaces it: both collections plus episodes,
 * ranked, typo-tolerant, and it reads intent out of the query ("horror series
 * from 2019") instead of matching those words against titles.
 *
 * Two endpoints, one engine:
 *   /search/suggest  the instant panel — grouped and capped
 *   /search          the results page — paginated, with facets
 */

export type SearchKind = "movie" | "show" | "episode";

/** A filter the API read out of the query. Rendered as a removable chip. */
export interface UnderstoodFilter {
  type: "kind" | "genre" | "year" | "decade" | "status" | "sort" | "season" | "episode";
  value: string | number;
  label: string;
}

export interface SearchResult {
  uid: string;
  id: string;
  kind: SearchKind;
  /** Which collection a viewer would say this belongs to; see filterKindOf. */
  filterKind: SearchKind;
  badge: string;
  title: string;
  /** Episodes only: "The Wire · S2:E5". */
  subtitle: string;
  overview: string;
  poster: string;
  backdrop: string;
  year: number | null;
  genreLabels: string[];
  /** Pre-joined display metadata: year, seasons, runtime. */
  meta: string[];
  runtime: string;
  seasonsCount: number | null;
  episodesCount: number | null;
  status: string | null;
  rating10: number | null;
  maturity: number | null;
  views: number;
  href: string;
  playHref: string | null;
  inMyList: boolean;
  watched: boolean;
  started: boolean;
  episodeCode: string | null;
  showTitle: string | null;
  /** 0-100, or null when there is no taste profile to match against. */
  match: number | null;
  /** [start, end) character ranges in `title` that the query matched. */
  highlight: Array<[number, number]>;
  matchedOn: string;
  /** One line on why this result is here. */
  reason: string | null;
}

export interface Facet {
  value: string | number;
  label: string;
  count: number;
}

export interface SuggestGroup {
  key: SearchKind;
  title: string;
  items: SearchResult[];
}

export interface SuggestResponse {
  query: string;
  text: string;
  understood: UnderstoodFilter[];
  didYouMean: string | null;
  /** True when no result satisfied every filter and they had to be relaxed. */
  relaxed: boolean;
  sort?: string;
  top: SearchResult | null;
  groups: SuggestGroup[];
  genres: Facet[];
  total: number;
  /** Zero state only: what to offer before anything has been typed. */
  trending: SearchResult[];
  degraded?: string;
}

export interface SearchResponse {
  query: string;
  text: string;
  understood: UnderstoodFilter[];
  filters: Record<string, unknown>;
  sort: string;
  didYouMean: string | null;
  relaxed: boolean;
  facets: { kinds: Facet[]; genres: Facet[]; decades: Facet[] };
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  results: SearchResult[];
  profile?: { personalised: boolean };
  degraded?: string;
}

export interface SearchQuery {
  q?: string;
  kind?: string;
  genre?: string;
  year?: number;
  decade?: number;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export const search = {
  /**
   * The instant panel. Takes an AbortSignal because it fires per keystroke and
   * responses can arrive out of order — a stale one repainting over a fresh one
   * is the classic search-box bug.
   */
  suggest: async (query: string, signal?: AbortSignal): Promise<SuggestResponse> =>
    (await api.get("/search/suggest", { params: { q: query }, signal })).data,

  results: async (query: SearchQuery, signal?: AbortSignal): Promise<SearchResponse> =>
    (await api.get("/search", { params: query, signal })).data,
};

/** Axios reports an aborted request as an error; it is not one worth showing. */
export function isAbort(error: unknown): boolean {
  const code = (error as { code?: string; name?: string })?.code;
  const name = (error as { name?: string })?.name;
  return code === "ERR_CANCELED" || name === "CanceledError" || name === "AbortError";
}

// --- recent searches ---------------------------------------------------------

const RECENT_KEY = "nx.recentSearches";
const RECENT_LIMIT = 8;

export function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecentSearch(term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed || typeof window === "undefined") return readRecentSearches();

  const next = [
    trimmed,
    ...readRecentSearches().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, RECENT_LIMIT);

  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function removeRecentSearch(term: string): string[] {
  if (typeof window === "undefined") return [];
  const next = readRecentSearches().filter((entry) => entry !== term);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function clearRecentSearches(): string[] {
  if (typeof window !== "undefined") localStorage.removeItem(RECENT_KEY);
  return [];
}

// --- presentation ------------------------------------------------------------

/** Builds the /search URL for a query plus any refinements. */
export function searchHref(query: SearchQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.kind) params.set("kind", query.kind);
  if (query.genre) params.set("genre", String(query.genre));
  if (query.year) params.set("year", String(query.year));
  if (query.decade) params.set("decade", String(query.decade));
  if (query.sort && query.sort !== "relevance") params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return `/search?${params.toString()}`;
}

/**
 * Splits a title into matched and unmatched runs, from the ranges the API
 * returned.
 *
 * Highlighting is computed server-side because the server is the only place
 * that knows *why* a result matched — re-deriving it in the client from the raw
 * query would underline the wrong thing for an acronym or a typo, which is
 * exactly where the highlight earns its keep.
 */
export function highlightParts(
  title: string,
  ranges: Array<[number, number]>
): Array<{ text: string; hit: boolean }> {
  if (!ranges?.length) return [{ text: title, hit: false }];

  const parts: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;

  for (const [start, end] of ranges) {
    const from = Math.max(cursor, Math.min(start, title.length));
    const to = Math.max(from, Math.min(end, title.length));
    if (from > cursor) parts.push({ text: title.slice(cursor, from), hit: false });
    if (to > from) parts.push({ text: title.slice(from, to), hit: true });
    cursor = to;
  }

  if (cursor < title.length) parts.push({ text: title.slice(cursor), hit: false });
  return parts;
}

export const SORT_OPTIONS = [
  { value: "relevance", label: "Best match" },
  { value: "popular", label: "Most watched" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Recently added" },
  { value: "year", label: "Newest releases" },
  { value: "az", label: "A–Z" },
];
