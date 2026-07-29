"use client";

import { useEffect, useRef, useState } from "react";
import { useDiscovery } from "@/context/DiscoveryContext";
import type { Arm } from "@/lib/ml/bandit";
import { slateId } from "@/lib/ml/observe";
import type { Candidate, RecommendOptions } from "@/lib/ml/types";

/**
 * One row's worth of on-device recommendations.
 *
 * The bookkeeping this hides is the part that is easy to get wrong and
 * invisible when it is. Every rendered row needs an identity so its impressions
 * group into a slate the listwise ranker can learn from, that identity has to be
 * registered against the strategy that produced it before any card can be
 * clicked, and it has to change when the row is re-ranked — otherwise two
 * different orderings of the same titles are recorded as one slate and the
 * ranker trains on a list it never showed anyone.
 *
 * Re-ranking is deliberately not automatic. The engine's answer moves as the
 * profile updates, and a row that reshuffles under the pointer because
 * something was hovered three cards over is a page that feels haunted. Rows
 * re-rank when their inputs change, and otherwise hold what they showed.
 */

export interface NeuralSlate {
  candidates: Candidate[];
  arm: Arm | null;
  /** How closely the row's genre mix matches the viewer's, 0-1. */
  calibration: number;
  slate: string;
  loading: boolean;
  /** Re-ranks now, e.g. after the viewer asks for something else. */
  refresh: () => void;
}

export function useNeuralSlate(options: RecommendOptions = {}): NeuralSlate {
  const { recommend, attribute, ready } = useDiscovery();

  const [nonce, setNonce] = useState(0);

  // Serialised rather than spread into the dependency array: `exclude` is a new
  // array literal on most renders, and depending on it by identity would re-rank
  // the row on every parent update.
  const key = `${nonce}:${JSON.stringify([
    options.limit, options.surface, options.kind, options.genre,
    options.seedUid, options.explore, options.diversity,
    (options.exclude || []).join(","),
  ])}`;

  const [state, setState] = useState<{
    candidates: Candidate[];
    arm: Arm | null;
    calibration: number;
    slate: string;
    /** The request this state answers. */
    answered: string;
  }>({ candidates: [], arm: null, calibration: 1, slate: "", answered: "" });

  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    recommend(latest.current)
      .then((result) => {
        if (cancelled) return;
        const id = slateId(latest.current.surface || "row");
        attribute(id, result.arm.key);
        setState({
          candidates: result.slate,
          arm: result.arm,
          calibration: result.calibration,
          slate: id,
          answered: key,
        });
      })
      .catch(() => {
        // Marking the request answered clears the loading state; the previous
        // slate stays on screen, which is better than emptying a row because
        // one re-rank failed.
        if (!cancelled) setState((previous) => ({ ...previous, answered: key }));
      });

    return () => {
      cancelled = true;
    };
  }, [ready, key, recommend, attribute]);

  return {
    candidates: state.candidates,
    arm: state.arm,
    calibration: state.calibration,
    slate: state.slate,
    // Derived rather than stored, so there is no moment where a request is in
    // flight and the flag says otherwise.
    loading: state.answered !== key,
    refresh: () => setNonce((value) => value + 1),
  };
}
