"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FaBolt, FaMagic, FaSearch } from "react-icons/fa";
import { useDiscovery } from "@/context/DiscoveryContext";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/cn";
import { slateId } from "@/lib/ml/observe";
import { record } from "@/lib/ml/signals";
import type { SearchOutcome } from "@/lib/ml/types";
import NeuralCard from "./NeuralCard";

/**
 * Search with no network in the loop.
 *
 * The palette in the navbar still calls the API, and should: the server can
 * reach episodes, it knows about titles published in the last five minutes, and
 * it works for someone who has just arrived. This is the other half — the same
 * query answered from the index in memory, where the round trip is zero and the
 * ranking can use signals that never leave the device.
 *
 * What that buys, concretely, is that results appear *while* the query is being
 * typed rather than after it. There is still a debounce, but it exists to avoid
 * re-ranking on every keystroke, not to avoid requests — so it is short enough
 * that the results feel attached to the keyboard.
 *
 * The suggestions are the honest way to demonstrate the difference. "A heist
 * that goes wrong" shares no word with most of what it should return; only the
 * latent space can answer it, and only from a corpus it has decomposed itself.
 */

const DEBOUNCE_MS = 90;

const EXAMPLES = [
  "a heist that goes wrong",
  "something funny and short",
  "top rated horror series",
  "space and survival",
  "documentaries about the ocean",
];

export default function SemanticSearch() {
  const { search, ready, status } = useDiscovery();
  const [query, setQuery] = useState("");
  // The outcome carries the query it answers, so "still ranking" is derived
  // from the two disagreeing rather than tracked as its own flag that can end
  // up stuck on after a failure.
  const [outcome, setOutcome] = useState<{ answered: string; value: SearchOutcome | null } | null>(
    null
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const debounced = useDebouncedValue(query, DEBOUNCE_MS);
  const trimmed = debounced.trim();

  // A new query is a new slate: the same titles in a different order is a
  // different thing to have shown someone, and the ranker has to learn from the
  // list as displayed.
  const slate = useMemo(() => slateId(`semantic:${trimmed}`), [trimmed]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const settle = (value: SearchOutcome | null) => {
      if (!cancelled) setOutcome({ answered: trimmed, value });
    };

    if (!trimmed) {
      settle(null);
      return;
    }

    search(trimmed, { limit: 18 })
      .then((result) => {
        settle(result);
        if (cancelled) return;
        // Logged as a search, not as a result: what someone typed is a signal
        // about intent even when nothing was clicked afterwards.
        record({ kind: "search", uid: "", surface: "discover", query: trimmed, weight: 1 });
      })
      .catch(() => settle(null));

    return () => {
      cancelled = true;
    };
  }, [trimmed, ready, search]);

  const running = Boolean(trimmed) && outcome?.answered !== trimmed;
  const results = outcome?.answered === trimmed ? outcome.value : null;

  return (
    <section>
      <div className="relative">
        <FaSearch
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-nx-dim"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={ready ? "Describe what you feel like watching…" : "Starting the index…"}
          disabled={!ready && status.stage !== "failed"}
          autoComplete="off"
          spellCheck={false}
          aria-label="Search by meaning"
          className="w-full rounded-xl border border-white/12 bg-white/[0.04] py-3.5 pl-11 pr-28 text-[15px] text-nx-ink outline-none transition placeholder:text-nx-dim focus:border-white/30 disabled:opacity-50"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2 text-[10px] text-nx-dim">
          {running ? (
            <span className="animate-pulse">ranking…</span>
          ) : results ? (
            <>
              <FaBolt className="text-nx-cyan" aria-hidden />
              <span className="tabular-nums">{results.tookMs}ms</span>
            </>
          ) : null}
        </span>
      </div>

      {!trimmed && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] text-nx-dim">Try</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuery(example);
                inputRef.current?.focus();
              }}
              className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] text-nx-muted transition hover:border-white/30 hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {results && (
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {results.understood.length > 0 && (
              <>
                <FaMagic className="text-[10px] text-nx-violet" aria-hidden />
                <span className="text-[11px] text-nx-dim">Read as</span>
                {results.understood.map((filter) => (
                  <span
                    key={`${filter.type}:${filter.value}`}
                    className="rounded-full border border-nx-violet/30 bg-nx-violet/10 px-2.5 py-0.5 text-[11px] font-semibold text-nx-ink"
                  >
                    {filter.label}
                  </span>
                ))}
              </>
            )}

            <span
              className={cn(
                "text-[11px] text-nx-dim",
                results.understood.length > 0 && "ml-auto"
              )}
            >
              {results.total} {results.total === 1 ? "match" : "matches"}
            </span>
          </div>

          {results.didYouMean && (
            <button
              type="button"
              onClick={() => setQuery(results.didYouMean as string)}
              className="mb-4 text-[13px] text-nx-muted transition hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
            >
              Did you mean{" "}
              <span className="font-semibold text-amber-300 underline underline-offset-4">
                {results.didYouMean}
              </span>
              ?
            </button>
          )}

          {results.results.length === 0 ? (
            <p className="py-12 text-center text-sm text-nx-muted">
              Nothing in the catalogue is close to that.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
              {results.results.map((candidate, index) => (
                <NeuralCard
                  key={candidate.item.uid}
                  candidate={candidate}
                  position={index}
                  surface="search"
                  slate={slate}
                  query={trimmed}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
