import { kvGet, kvSet } from "./store";
import type { CorpusItem, CorpusSnapshot } from "./types";

/**
 * The catalogue, on the device.
 *
 * Everything downstream — the index, the embeddings, the models — is a function
 * of this array, so getting it in hand is the first thing boot does and the
 * thing that decides how long boot feels.
 *
 * Stale-while-revalidate, for a reason specific to what this is used for. A
 * recommender built from a catalogue that is five minutes out of date is a
 * recommender; one that is waiting on the network is nothing at all. So a
 * cached snapshot is returned synchronously-ish and a revalidation runs behind
 * it, and the only cost of the staleness is that a title published in the last
 * few minutes is missing from local ranking until the next visit — while the
 * server-side search, which the client still calls, has it immediately.
 *
 * Revalidation goes through `fetch` rather than the axios instance because the
 * point is the browser's own HTTP cache: the endpoint answers with an ETag, and
 * a plain fetch turns a repeat visit into a 304 with no body. Axios would treat
 * that 304 as a failure, and adding a token to the request would make the
 * response uncacheable for no benefit — there is nothing per-viewer in it.
 */

const CACHE_KEY = "corpus.snapshot";
const ENDPOINT = "/api/search/corpus";

/** Matches `schema` in the API payload; a bump invalidates every stored copy. */
const SCHEMA = 1;

export interface CorpusLoad {
  items: CorpusItem[];
  generatedAt: string;
  /** True when this came from IndexedDB rather than the network. */
  cached: boolean;
  degraded?: string;
}

function usable(value: unknown): value is CorpusSnapshot {
  const snapshot = value as CorpusSnapshot | null;
  return Boolean(
    snapshot &&
      snapshot.schema === SCHEMA &&
      Array.isArray(snapshot.items) &&
      snapshot.items.length > 0
  );
}

async function download(signal?: AbortSignal): Promise<CorpusSnapshot | null> {
  try {
    const response = await fetch(ENDPOINT, {
      signal,
      // Not `force-cache`: the ETag is what makes this cheap, and a forced cache
      // read would never revalidate and never see a newly published title.
      cache: "no-cache",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const snapshot = (await response.json()) as CorpusSnapshot;
    return usable(snapshot) ? snapshot : null;
  } catch {
    // Offline, aborted, or the API is asleep. The cached copy — or nothing —
    // is the answer, and either way it is not this function's problem.
    return null;
  }
}

/**
 * Loads the catalogue, preferring speed over freshness.
 *
 * `onRefresh` fires only when the network produced something genuinely newer
 * than what was returned, so a caller can rebuild its index once instead of
 * every load.
 */
export async function loadCorpus(options: {
  signal?: AbortSignal;
  onRefresh?: (load: CorpusLoad) => void;
} = {}): Promise<CorpusLoad> {
  const cached = await kvGet<CorpusSnapshot>(CACHE_KEY);

  if (usable(cached)) {
    void (async () => {
      const fresh = await download(options.signal);
      if (!fresh || fresh.generatedAt === cached.generatedAt) return;
      await kvSet(CACHE_KEY, fresh);
      options.onRefresh?.({
        items: fresh.items,
        generatedAt: fresh.generatedAt,
        cached: false,
        degraded: fresh.degraded,
      });
    })();

    return {
      items: cached.items,
      generatedAt: cached.generatedAt,
      cached: true,
      degraded: cached.degraded,
    };
  }

  const fresh = await download(options.signal);
  if (!fresh) {
    return { items: [], generatedAt: "", cached: false, degraded: "UNREACHABLE" };
  }

  await kvSet(CACHE_KEY, fresh);
  return {
    items: fresh.items,
    generatedAt: fresh.generatedAt,
    cached: false,
    degraded: fresh.degraded,
  };
}

// --- derived catalogue facts -------------------------------------------------

/**
 * Genre labels as the catalogue authored them, most common first.
 *
 * Kept separate from the vectoriser because it feeds the *query parser*, not
 * the index: a query is only read as "horror" if the catalogue actually
 * publishes a horror genre, so this list is the difference between reading
 * intent and guessing at it.
 */
export function genreVocabulary(items: CorpusItem[]): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const genre of item.genres) {
      if (genre) counts.set(genre, (counts.get(genre) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Every word that appears in a title, with how many titles use it.
 *
 * The corpus spelling correction runs against. Frequency breaks ties, so a typo
 * equidistant from two catalogue words resolves to the one more people were
 * likely aiming at.
 */
export function titleVocabulary(items: CorpusItem[]): Map<string, number> {
  const vocabulary = new Map<string, number>();
  for (const item of items) {
    for (const word of item.title.toLowerCase().split(/[^a-z0-9]+/i)) {
      if (word.length < 3) continue;
      vocabulary.set(word, (vocabulary.get(word) || 0) + 1);
    }
  }
  return vocabulary;
}
