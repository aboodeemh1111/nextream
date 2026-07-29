"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAbort, search, SuggestResponse } from "@/lib/search";

const DEBOUNCE_MS = 140;
/** Enough that backspacing through a query never re-hits the network. */
const CACHE_LIMIT = 40;

interface InstantSearchState {
  data: SuggestResponse | null;
  /** True while a request is in flight — `data` may still be the previous one. */
  loading: boolean;
  /** True when `data` answers an older query than the one currently typed. */
  stale: boolean;
  error: string | null;
}

/**
 * Search-as-you-type, with the three things that separate a search box that
 * feels instant from one that feels broken.
 *
 * 1. **Out-of-order responses.** Requests fire per keystroke and the network
 *    does not promise to answer in order, so a slow response for "tot" can land
 *    after a fast one for "totoro" and repaint the panel with the wrong
 *    results. Every request carries an AbortController and a generation number;
 *    only the newest is allowed to write state.
 * 2. **The empty flash.** Clearing results the moment a keystroke arrives makes
 *    the panel strobe between content and nothing. The previous answer is held
 *    and marked `stale` instead, so the layout stays put and only the progress
 *    line moves.
 * 3. **Backspacing.** Deleting characters walks back through queries that were
 *    just answered, so answers are cached and replayed synchronously — no
 *    debounce, no request, no flicker.
 */
export function useInstantSearch(
  query: string,
  /** The palette is mounted for the whole session; only fetch while it is up. */
  enabled = true
): InstantSearchState & { refresh: () => void } {
  const [state, setState] = useState<InstantSearchState>({
    data: null,
    loading: false,
    stale: false,
    error: null,
  });

  const cache = useRef(new Map<string, SuggestResponse>());
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => {
    cache.current.clear();
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const trimmed = query.trim();
    const key = trimmed.toLowerCase();

    const cached = cache.current.get(key);
    if (cached) {
      generation.current += 1;
      controller.current?.abort();
      setState({ data: cached, loading: false, stale: false, error: null });
      return;
    }

    // Held, not cleared: see (2) above.
    setState((previous) => ({ ...previous, loading: true, stale: true, error: null }));

    const mine = (generation.current += 1);
    const timer = setTimeout(async () => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;

      try {
        const data = await search.suggest(trimmed, abort.signal);
        if (mine !== generation.current) return;

        cache.current.set(key, data);
        if (cache.current.size > CACHE_LIMIT) {
          cache.current.delete(cache.current.keys().next().value as string);
        }
        setState({ data, loading: false, stale: false, error: null });
      } catch (error) {
        if (isAbort(error) || mine !== generation.current) return;
        setState((previous) => ({
          ...previous,
          loading: false,
          stale: false,
          error: "Search is unavailable right now.",
        }));
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, nonce, enabled]);

  useEffect(() => () => controller.current?.abort(), []);

  return { ...state, refresh };
}

export default useInstantSearch;
