"use client";

import { useCallback, useEffect, useRef } from "react";
import { record } from "./signals";
import type { Surface } from "./types";

/**
 * Watching the page, so the ranker has something to learn from.
 *
 * Two events matter and neither is a click.
 *
 * An **impression** is a card that was genuinely on screen. Not rendered — a row
 * renders twenty cards and shows four — and not merely intersecting by a pixel
 * as it slides past. Half the card, for half a second, which is roughly where a
 * card stops being scenery and starts being something a person declined. Without
 * that distinction the negatives are worthless, and the negatives are most of
 * the training set.
 *
 * A **dwell** is a pointer that stopped. It is the only pre-click signal there
 * is, and on a page where most cards are never clicked it is often the only
 * evidence of interest at all — someone who reads three synopses and plays
 * nothing has still said a great deal about what they were considering.
 *
 * One shared IntersectionObserver for the whole document. A row of twenty cards
 * creating twenty observers is twenty separate callbacks into layout on every
 * scroll frame, and there can be several rows.
 */

/** Fraction of a card that must be visible. */
const VISIBLE = 0.5;

/** How long it must stay that way. Below this it was scrolled past, not seen. */
const DWELL_MS = 500;

/** A pointer resting at least this long is interest rather than travel. */
const HOVER_MS = 400;

type Seen = () => void;

let observer: IntersectionObserver | null = null;
const handlers = new WeakMap<Element, Seen>();
const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

function ensureObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  if (observer) return observer;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const element = entry.target;

        if (!entry.isIntersecting) {
          const timer = timers.get(element);
          if (timer) {
            clearTimeout(timer);
            timers.delete(element);
          }
          continue;
        }

        if (timers.has(element)) continue;
        timers.set(
          element,
          setTimeout(() => {
            timers.delete(element);
            handlers.get(element)?.();
            // One impression per element per mount. A row that scrolls back and
            // forth would otherwise log the same card repeatedly, and the
            // cooldown in `record` is a second line of defence rather than the
            // first.
            observer?.unobserve(element);
            handlers.delete(element);
          }, DWELL_MS)
        );
      }
    },
    { threshold: VISIBLE }
  );

  return observer;
}

export interface ImpressionOptions {
  uid: string;
  surface: Surface;
  position: number;
  /** Groups the row this card belongs to, for listwise training. */
  slate?: string;
  query?: string;
  /** False while the data is still loading, so a skeleton is not an impression. */
  enabled?: boolean;
}

/**
 * Attaches impression and dwell tracking to one card.
 *
 * Returns a ref callback rather than a ref object: cards mount and unmount as a
 * row virtualises, and a callback is the only form that fires on both.
 */
export function useTracking(options: ImpressionOptions) {
  const { uid, surface, position, slate, query } = options;
  const enabled = options.enabled ?? true;

  // Written from an effect rather than during render, so the value only changes
  // after commit — the same discipline `watchTracker` uses for the same reason.
  // A card's position and slate move as a row re-ranks, and the observer
  // callback has to see the current pair without being torn down to learn it.
  const latest = useRef({ ...options, enabled });
  useEffect(() => {
    latest.current = { ...options, enabled };
  });

  const element = useRef<Element | null>(null);
  const hoverStart = useRef(0);

  const attach = useCallback(
    (node: Element | null) => {
      const previous = element.current;
      if (previous) {
        observer?.unobserve(previous);
        handlers.delete(previous);
        const timer = timers.get(previous);
        if (timer) clearTimeout(timer);
        timers.delete(previous);
      }

      element.current = node;
      if (!node || !latest.current.enabled || !latest.current.uid) return;

      const watcher = ensureObserver();
      if (!watcher) return;

      handlers.set(node, () => {
        const current = latest.current;
        record({
          kind: "impression",
          uid: current.uid,
          surface: current.surface,
          position: current.position,
          slate: current.slate,
          query: current.query,
        });
      });
      watcher.observe(node);
    },
    // Reading through `latest` rather than closing over the values keeps this
    // callback stable — a new identity on every render would detach and
    // re-observe every card on every parent update.
    []
  );

  useEffect(
    () => () => {
      const node = element.current;
      if (!node) return;
      observer?.unobserve(node);
      handlers.delete(node);
      const timer = timers.get(node);
      if (timer) clearTimeout(timer);
      timers.delete(node);
    },
    []
  );

  const onPointerEnter = useCallback(() => {
    hoverStart.current = Date.now();
  }, []);

  const onPointerLeave = useCallback(() => {
    if (!hoverStart.current) return;
    const seconds = (Date.now() - hoverStart.current) / 1000;
    hoverStart.current = 0;
    if (seconds * 1000 < HOVER_MS) return;
    record({ kind: "hover", uid, surface, position, weight: seconds, slate });
  }, [uid, surface, position, slate]);

  const onSelect = useCallback(() => {
    record({
      kind: query ? "search_click" : "click",
      uid,
      surface,
      position,
      slate,
      query,
    });
  }, [uid, surface, position, slate, query]);

  return { ref: attach, onPointerEnter, onPointerLeave, onSelect };
}

/** A stable id for one rendered slate, so its impressions group together. */
export function slateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
