import { appendSignals, readSignals, trimSignals, type StoredSignal } from "./store";
import type { Signal, SignalKind, Surface } from "./types";

/**
 * What the viewer did, recorded where it happened.
 *
 * This is the training set. Everything else in the recommender is machinery for
 * turning it into an ordering, and the quality of the ordering is bounded by
 * how honestly this file describes what went on.
 *
 * Two decisions do most of that work.
 *
 * **Impressions are recorded.** A log of clicks and plays teaches a model that
 * every title is wonderful, because it never sees one that was on screen, in
 * position two, and scrolled past. The negatives are the entire signal; the
 * positives only say which of them was not one.
 *
 * **Weight is separate from kind.** "Played" is not one event — playing four
 * minutes of something and abandoning it is close to a negative, and finishing
 * it is the strongest positive in the log. Collapsing that into a type name
 * throws away the part that distinguishes them.
 */

/**
 * Base value per event, before its own weight is applied.
 *
 * Negative numbers are real evidence, not merely absent evidence. Removing
 * something from My List and dismissing a card are both deliberate statements
 * that the ranker got it wrong, and they should move the profile *away*.
 *
 * `impression` is very slightly negative on purpose: across a session a title
 * shown many times and never touched is genuinely less interesting than one
 * never shown at all, and this is the standard way to express that without
 * letting it overwhelm a single real click.
 */
const BASE_VALUE: Record<SignalKind, number> = {
  impression: -0.02,
  hover: 0.12,
  click: 0.45,
  play: 0.8,
  progress: 0.9,
  complete: 1.0,
  abandon: -0.25,
  list_add: 0.95,
  list_remove: -0.7,
  search: 0,
  search_click: 0.7,
  dismiss: -0.9,
};

/** Buffered writes flush at least this often. */
const FLUSH_MS = 4000;
/** Or as soon as this many are pending — a scrolling row fills it in one frame. */
const FLUSH_SIZE = 24;
/** The same title on the same surface is not re-logged as an impression within this. */
const IMPRESSION_COOLDOWN_MS = 45_000;

let buffer: StoredSignal[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;
const lastImpression = new Map<string, number>();
const subscribers = new Set<(signal: Signal) => void>();

/** Signals written since load, so callers can tell if a retrain is worth running. */
let written = 0;

function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!buffer.length) return;

  const batch = buffer;
  buffer = [];
  void appendSignals(batch).then(() => {
    // Trimming after the write rather than before: the store only crosses its
    // cap by being written to, so this is the only moment it can need it.
    if (written % 200 === 0) void trimSignals();
  });
}

function schedule(): void {
  if (buffer.length >= FLUSH_SIZE) return flush();
  if (timer) return;
  timer = setTimeout(flush, FLUSH_MS);
}

/**
 * Closing the tab is the single most common way a session ends, and it fires no
 * event that a normal write can survive. Anything still buffered when the page
 * hides is lost otherwise — including the `complete` that just fired, which is
 * the most valuable signal there is.
 */
function listen(): void {
  if (listening || typeof document === "undefined") return;
  listening = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}

export interface RecordOptions {
  kind: SignalKind;
  uid: string;
  surface: Surface;
  position?: number;
  /** Scales the event's base value. Progress fraction, dwell, click confidence. */
  weight?: number;
  query?: string;
  /** Groups one rendered slate, so the listwise ranker can reconstruct it. */
  slate?: string;
}

/**
 * Records one interaction.
 *
 * Cheap and synchronous by design — this is called from pointer handlers and
 * from an IntersectionObserver, and anything that awaits inside those is a
 * dropped frame the viewer can feel.
 */
export function record(options: RecordOptions): void {
  if (typeof window === "undefined" || !options.uid) return;
  listen();

  const at = Date.now();

  if (options.kind === "impression") {
    // A row that scrolls in and out of view fires the observer each time. Left
    // unfiltered, one indecisive scroll produces thirty impressions of the same
    // card and buries every real signal in the log under it.
    const key = `${options.surface}:${options.uid}`;
    const previous = lastImpression.get(key) || 0;
    if (at - previous < IMPRESSION_COOLDOWN_MS) return;
    lastImpression.set(key, at);
  }

  const signal: Signal = {
    kind: options.kind,
    uid: options.uid,
    at,
    surface: options.surface,
    position: options.position ?? -1,
    weight: options.weight ?? 1,
    query: options.query,
    slate: options.slate,
  };

  buffer.push(signal as StoredSignal);
  written += 1;
  schedule();

  for (const subscriber of subscribers) subscriber(signal);
}

/** Notifies on every recorded signal — the engine uses it to schedule training. */
export function subscribe(handler: (signal: Signal) => void): () => void {
  subscribers.add(handler);
  return () => subscribers.delete(handler);
}

/** Everything on disk, plus whatever has not been flushed yet, oldest first. */
export async function allSignals(): Promise<Signal[]> {
  const stored = await readSignals();
  const pending = buffer.slice();
  return [...stored, ...pending].map((signal) => ({
    kind: signal.kind as SignalKind,
    uid: signal.uid,
    at: signal.at,
    surface: signal.surface as Surface,
    position: signal.position,
    weight: signal.weight,
    query: signal.query,
    slate: signal.slate,
  }));
}

export function flushNow(): void {
  flush();
}

/**
 * How much a single event is worth, before time decay.
 *
 * `progress` is the interesting one: the weight is the fraction watched, and
 * squaring it makes the first minute of a title worth almost nothing while the
 * last quarter is worth nearly everything. Someone who watched 20% of a film
 * did not like it, and treating that as a fifth of a positive — which linear
 * scaling does — is how a recommender ends up confidently suggesting more of
 * what its viewer keeps giving up on.
 */
export function valueOf(signal: Signal): number {
  const base = BASE_VALUE[signal.kind] ?? 0;

  switch (signal.kind) {
    case "progress":
      return base * Math.pow(Math.max(0, Math.min(1, signal.weight)), 2);
    case "abandon":
      // Abandoning something two minutes in is the strong negative; abandoning
      // it near the end is barely one, and often means "finished, credits".
      return base * (1 - Math.max(0, Math.min(1, signal.weight)));
    case "hover":
      // Dwell in seconds, saturating: three seconds on a card is interest, ten
      // seconds is a viewer reading the synopsis and not thirty times as much.
      return base * Math.min(1, signal.weight / 3);
    default:
      return base * (signal.weight || 1);
  }
}

/**
 * Exponential time decay.
 *
 * A half life rather than a window. Taste drifts continuously and a hard cutoff
 * makes the profile lurch every time an old event falls out of range; two weeks
 * is short enough to follow a change of mood and long enough that a fortnight
 * away does not reset someone to a stranger.
 */
export const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

export function decay(at: number, now = Date.now()): number {
  return Math.pow(0.5, Math.max(0, now - at) / HALF_LIFE_MS);
}
