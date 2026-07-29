"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import type { Arm } from "@/lib/ml/bandit";
import { getEngine } from "@/lib/ml/engine";
import { flushNow, record, subscribe, type RecordOptions } from "@/lib/ml/signals";
import { kvGet, kvSet, wipe } from "@/lib/ml/store";
import type {
  Candidate,
  EngineStatus,
  RecommendOptions,
  SearchOptions,
  SearchOutcome,
} from "@/lib/ml/types";

/**
 * The on-device recommender, mounted.
 *
 * Everything under `lib/ml` is deliberately free of React and of the DOM, so
 * that it can be reasoned about — and tested — as the pile of linear algebra it
 * is. This is the only place the two meet, and it has three jobs.
 *
 * **Boot late.** The engine downloads the catalogue, decomposes it and loads a
 * megabyte of TensorFlow. None of that is on the path to the first frame, and
 * all of it competes for the same main thread as the page the viewer is
 * actually looking at. It starts when the browser says it is idle, after the
 * first paint, and every consumer is written to render fine before it is ready.
 *
 * **Close the loop.** A recommender that does not observe the consequences of
 * its own recommendations is a ranking function with extra steps. Interactions
 * flow back in here: they mark the profile stale, they schedule training, and
 * they pay the bandit for the slate that produced them.
 *
 * **Keep it per-viewer.** The signal log lives on the device, and two people
 * sharing a browser must not share a taste profile. Switching accounts wipes
 * it.
 */

interface DiscoveryValue {
  status: EngineStatus;
  ready: boolean;
  /** True when there is enough history for the personalised paths to run. */
  personalised: boolean;

  recommend: (options?: RecommendOptions) => Promise<{
    slate: Candidate[];
    arm: Arm;
    calibration: number;
  }>;
  search: (query: string, options?: SearchOptions) => Promise<SearchOutcome>;
  similar: (uid: string, limit?: number) => Promise<Candidate[]>;

  /** Records an interaction and schedules the learning that follows from it. */
  track: (options: RecordOptions) => void;
  /** Credits the strategy behind a slate. Called on a click, or on a timeout. */
  reward: (slate: string, value: number) => void;
  /** Registers which strategy produced a slate. */
  attribute: (slate: string, arm: string) => void;

  introspect: () => ReturnType<ReturnType<typeof getEngine>["introspect"]>;
  /** Forgets everything learned on this device. */
  forget: () => Promise<void>;
  trainNow: () => Promise<void>;
}

const DiscoveryContext = createContext<DiscoveryValue | null>(null);

/** Signals since the last training pass that are worth another one. */
const RETRAIN_AFTER = 12;

/** A slate nobody touched in this long earns its strategy a zero. */
const REWARD_TIMEOUT_MS = 45_000;

const OWNER_KEY = "profile.owner";

export function DiscoveryProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  // Read out once. Every use below wants the id and nothing else, and depending
  // on `user` would rebuild the context value whenever any field of it changed
  // — including the access token, which rotates.
  const userId = user?._id;
  const engine = useMemo(() => getEngine(), []);

  const [status, setStatus] = useState<EngineStatus>(() => engine.getStatus());
  const [booted, setBooted] = useState(false);

  const sinceTraining = useRef(0);
  const pendingRewards = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const rewarded = useRef(new Set<string>());

  // --- boot -----------------------------------------------------------------

  useEffect(() => {
    if (authLoading || !userId) return;
    let cancelled = false;

    const start = async () => {
      // A different account on the same device inherits nothing. The profile is
      // built from what someone watched, and handing that to the next person to
      // sign in is both wrong and a privacy problem — the "because you watched"
      // lines would name titles they have never seen.
      const owner = await kvGet<string>(OWNER_KEY);
      if (owner && owner !== userId) await wipe();
      if (owner !== userId) await kvSet(OWNER_KEY, userId);

      await engine.boot();
      if (cancelled) return;
      setStatus(engine.getStatus());
      setBooted(true);
    };

    // requestIdleCallback is not in Safari before 17, and the fallback matters
    // — without it the engine would never boot at all on those, rather than
    // booting slightly less politely.
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => void start(), { timeout: 3000 })
      : window.setTimeout(() => void start(), 1200);

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback && typeof idle === "number") {
        window.cancelIdleCallback(idle);
      } else {
        clearTimeout(idle as number);
      }
    };
  }, [engine, authLoading, userId]);

  // --- the feedback loop -----------------------------------------------------

  useEffect(() => {
    const unsubscribe = subscribe((signal) => {
      engine.markDirty();

      // An impression is not worth a training pass on its own; a play is. The
      // counter weights them so a page of scrolling does not trigger a retrain
      // while a single completed film does.
      sinceTraining.current += signal.kind === "impression" ? 1 : 3;
      if (sinceTraining.current >= RETRAIN_AFTER) {
        sinceTraining.current = 0;
        engine.trainSoon();
      }

      // Anything deliberate credits the slate it came from.
      if (signal.slate && signal.kind !== "impression") {
        const value = signal.kind === "play" || signal.kind === "list_add" ? 1 : 0.6;
        if (!rewarded.current.has(signal.slate)) {
          rewarded.current.add(signal.slate);
          engine.reward(signal.slate, value);
          const timer = pendingRewards.current.get(signal.slate);
          if (timer) {
            clearTimeout(timer);
            pendingRewards.current.delete(signal.slate);
          }
        }
      }
    });

    return unsubscribe;
  }, [engine]);

  useEffect(() => {
    const timers = pendingRewards.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      flushNow();
    };
  }, []);

  // Status is polled rather than pushed. The engine is not an event emitter and
  // making it one would mean every stage transition re-rendering the tree; the
  // only consumer that wants live status is the insight panel, and a second is
  // fast enough for a progress read-out.
  useEffect(() => {
    if (!booted) return;
    const timer = setInterval(() => setStatus(engine.getStatus()), 1000);
    return () => clearInterval(timer);
  }, [engine, booted]);

  // --- api -------------------------------------------------------------------

  const track = useCallback((options: RecordOptions) => record(options), []);

  const attribute = useCallback(
    (slate: string, arm: string) => {
      engine.attributeSlate(slate, arm as Parameters<typeof engine.attributeSlate>[1]);

      // A slate that is shown and never acted on is the most common outcome and
      // the one a bandit has to see, or every strategy looks equally good
      // forever. The timer is what turns "nothing happened" into an observation.
      if (pendingRewards.current.has(slate)) return;
      pendingRewards.current.set(
        slate,
        setTimeout(() => {
          pendingRewards.current.delete(slate);
          if (!rewarded.current.has(slate)) {
            rewarded.current.add(slate);
            engine.reward(slate, 0);
          }
        }, REWARD_TIMEOUT_MS)
      );
    },
    [engine]
  );

  const value = useMemo<DiscoveryValue>(
    () => ({
      status,
      ready: status.stage === "ready" || status.stage === "training",
      personalised: status.personalised,
      recommend: (options) => engine.recommend(options),
      search: (query, options) => engine.search(query, options),
      similar: (uid, limit) => engine.similar(uid, limit),
      track,
      reward: (slate, amount) => engine.reward(slate, amount),
      attribute,
      introspect: () => engine.introspect(),
      forget: async () => {
        await wipe();
        if (userId) await kvSet(OWNER_KEY, userId);
        rewarded.current.clear();
        // A reload is the honest way to start over: the engine holds a trained
        // model, a taste profile and cached item vectors in memory, and
        // rebuilding all of that in place is a lot of moving parts to get right
        // for something that happens once, deliberately, at the viewer's
        // request.
        window.location.reload();
      },
      trainNow: () => engine.train(),
    }),
    [engine, status, track, attribute, userId]
  );

  return <DiscoveryContext.Provider value={value}>{children}</DiscoveryContext.Provider>;
}

/**
 * Throws when used outside the provider rather than returning null.
 *
 * Every consumer of this would have to branch on null and the branch would
 * never be taken — the provider is mounted at the root. A missing provider is a
 * wiring mistake, and a loud one is cheaper to find than a page that silently
 * shows no recommendations.
 */
export function useDiscovery(): DiscoveryValue {
  const value = useContext(DiscoveryContext);
  if (!value) throw new Error("useDiscovery must be used inside DiscoveryProvider");
  return value;
}

/** For components that render with or without the engine, e.g. shared cards. */
export function useOptionalDiscovery(): DiscoveryValue | null {
  return useContext(DiscoveryContext);
}
