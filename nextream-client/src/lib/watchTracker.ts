"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/axios";
import { record } from "@/lib/ml/signals";

/**
 * Playback telemetry for a single sitting.
 *
 * Everything the profile and analytics pages show about *how* someone watched
 * is measured here, because the server cannot see any of it: it never learns
 * that a tab was backgrounded, that the player spent nine seconds rebuffering,
 * or that the viewer scrubbed to the end without watching the middle.
 *
 * Two rules make the numbers trustworthy:
 *
 *   Watch time is accumulated from wall-clock elapsed between `playing` and
 *   the next stall, not from `currentTime`. Seeking forward moves the position
 *   without earning watch time; a rewatch within the same sitting earns it
 *   twice. Position and watch time answer different questions and are reported
 *   separately.
 *
 *   Every field sent is an absolute running total, never a delta. Heartbeats
 *   are fire-and-forget over a flaky connection, so a dropped or duplicated
 *   one has to converge rather than compound. The server derives its own
 *   deltas from what it already holds.
 */

export type WatchContentType = "movie" | "episode";

/** Mirrors HEARTBEAT_INTERVAL_SEC on the API. */
const HEARTBEAT_MS = 15_000;
/** Below this, a "session" is a mis-tap and not worth a row. */
const MIN_REPORTABLE_SEC = 1;

interface Qoe {
  startupMs: number;
  rebufferCount: number;
  rebufferSec: number;
  errorCount: number;
  lastError: string;
  qualityLabel: string;
  qualitySwitches: number;
}

interface TrackerState {
  sessionId: string;
  /** Wall-clock seconds actually spent playing. */
  secondsWatched: number;
  /** Instant the current playing stretch began, or null when not playing. */
  playingSince: number | null;
  /** Instant playback was requested, for the startup measurement. */
  requestedAt: number | null;
  /** Instant the current stall began, or null when not stalled. */
  stalledSince: number | null;
  /** Highest total the server has acknowledged, to skip no-op heartbeats. */
  lastSentSeconds: number;
  ended: boolean;
  qoe: Qoe;
}

function newSessionId(): string {
  // randomUUID needs a secure context; a LAN dev host over plain http has none.
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyQoe(): Qoe {
  return {
    startupMs: 0,
    rebufferCount: 0,
    rebufferSec: 0,
    errorCount: 0,
    lastError: "",
    qualityLabel: "",
    qualitySwitches: 0,
  };
}

function authToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.accessToken) return parsed.accessToken;
    }
  } catch {
    // Corrupt entry; fall through to the standalone token.
  }
  return localStorage.getItem("auth-token");
}

export interface UseWatchTrackerOptions {
  contentType: WatchContentType;
  /** Null while the page is still loading; tracking starts once it is known. */
  contentId: string | null | undefined;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** False until the viewer is authenticated — anonymous pings are rejected. */
  enabled?: boolean;
  /** Current quality label, so switches can be counted. */
  qualityLabel?: string;
  /**
   * The catalogue entry this playback belongs to ("movie:<id>", "show:<id>"),
   * for the on-device recommender.
   *
   * Deliberately not derived from `contentId`. An episode's id is not in the
   * local catalogue index — the recommender works at the level of a show, not
   * an episode — so only the page knows which title this session is evidence
   * about. Left undefined, nothing is recorded locally and the server telemetry
   * above is unaffected.
   */
  signalUid?: string;
}

export interface WatchTracker {
  /** Force a heartbeat now, e.g. right before navigating away. */
  flush: (options?: { completed?: boolean; ended?: boolean }) => void;
  /** Report a playback error the media element surfaced. */
  reportError: (message: string) => void;
  sessionId: string;
}

export function useWatchTracker({
  contentType,
  contentId,
  videoRef,
  enabled = true,
  qualityLabel = "",
  signalUid,
}: UseWatchTrackerOptions): WatchTracker {
  // Mirrored in state, not just held in the ref, because it is part of this
  // hook's return value: a ref updated from an effect never re-renders, so
  // callers would keep reading the id of the *previous* title while heartbeats
  // went out under the new one.
  const [sessionId, setSessionId] = useState(newSessionId);

  const stateRef = useRef<TrackerState>({
    sessionId,
    secondsWatched: 0,
    playingSince: null,
    requestedAt: null,
    stalledSince: null,
    lastSentSeconds: -1,
    ended: false,
    qoe: emptyQoe(),
  });

  // Read inside callbacks that must not be re-created on every render — a new
  // identity there would tear down and re-attach the media listeners mid-play.
  // Written from an effect rather than during render so that the value is only
  // swapped after commit; see the note on `send`'s `target` option.
  const targetRef = useRef({ contentType, contentId, enabled });
  useEffect(() => {
    targetRef.current = { contentType, contentId, enabled };
  });

  /** Folds the in-flight playing stretch into the total. */
  const settle = useCallback(() => {
    const state = stateRef.current;
    if (state.playingSince === null) return;
    state.secondsWatched += (Date.now() - state.playingSince) / 1000;
    state.playingSince = null;
  }, []);

  const send = useCallback(
    (
      options: {
        completed?: boolean;
        ended?: boolean;
        beacon?: boolean;
        /**
         * The title this heartbeat belongs to. Callers running from an effect
         * cleanup pass their own, captured from the effect's closure, rather
         * than lean on `targetRef` — that ref is maintained by an effect of its
         * own, and rather than reason about effect ordering at every call site
         * it is simpler for a cleanup to name the title it was set up for. The
         * cost of getting it wrong is the final stretch of one episode being
         * credited to the following one.
         */
        target?: { contentType: WatchContentType; contentId: string };
      } = {}
    ) => {
      const state = stateRef.current;
      const fallback = targetRef.current;
      const type = options.target?.contentType ?? fallback.contentType;
      const id = options.target?.contentId ?? fallback.contentId;
      if (!fallback.enabled || !id) return;

      // Count the stretch in progress without ending it: a heartbeat mid-play
      // must report time already watched, and playback has not stopped.
      const inFlight =
        state.playingSince !== null ? (Date.now() - state.playingSince) / 1000 : 0;
      const seconds = state.secondsWatched + inFlight;

      // A paused player re-reporting the same total teaches the server nothing
      // and would keep the session looking alive. The final flush still goes.
      if (
        seconds < MIN_REPORTABLE_SEC ||
        (!options.ended && !options.completed && seconds <= state.lastSentSeconds)
      ) {
        return;
      }
      state.lastSentSeconds = seconds;

      const video = videoRef.current;
      const payload = {
        sessionId: state.sessionId,
        contentType: type,
        contentId: id,
        positionSec: video?.currentTime || 0,
        durationSec: Number.isFinite(video?.duration) ? video?.duration || 0 : 0,
        secondsWatched: seconds,
        completed: options.completed ?? state.ended,
        ended: options.ended ?? false,
        qoe: state.qoe,
      };

      if (options.beacon) {
        // The page is going away, so an axios promise would be cancelled with
        // it. `keepalive` survives the teardown, and unlike sendBeacon it can
        // still carry the auth header this API expects.
        const token = authToken();
        try {
          void fetch("/api/playback/heartbeat", {
            method: "POST",
            keepalive: true,
            headers: {
              "Content-Type": "application/json",
              ...(token ? { token: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
          });
        } catch {
          // Nothing useful to do while unloading.
        }
        return;
      }

      // Telemetry must never interrupt playback, so failures are swallowed.
      api.post("/playback/heartbeat", payload).catch(() => {});
    },
    [videoRef]
  );

  const flush = useCallback(
    (options: { completed?: boolean; ended?: boolean } = {}) => {
      settle();
      send(options);
    },
    [send, settle]
  );

  const reportError = useCallback((message: string) => {
    const state = stateRef.current;
    state.qoe.errorCount += 1;
    state.qoe.lastError = String(message || "").slice(0, 200);
  }, []);

  // --- local recommender signals --------------------------------------------

  // Held in a ref so the media listeners can read the current title without
  // being torn down and rebuilt when it changes — the same reason `targetRef`
  // exists above.
  const signalRef = useRef({ uid: signalUid, played: false });
  useEffect(() => {
    // A new title is a new session as far as the recommender is concerned, so
    // "already recorded a play" resets with it.
    if (signalRef.current.uid !== signalUid) signalRef.current = { uid: signalUid, played: false };
  }, [signalUid]);

  /**
   * Reports how far this sitting got, to the on-device model.
   *
   * Position rather than watch time: the question the recommender is asking is
   * "did they get through it", and someone who rewatched the first ten minutes
   * three times has more watch time than position and did not.
   */
  const reportProgress = useCallback(
    (kind: "progress" | "complete" | "abandon") => {
      const uid = signalRef.current.uid;
      if (!uid) return;

      const video = videoRef.current;
      const duration = Number.isFinite(video?.duration) ? video?.duration || 0 : 0;
      const fraction = duration > 0 ? Math.min(1, (video?.currentTime || 0) / duration) : 0;

      // Below a minute of position there is nothing to say — a mis-tap and a
      // rejection look identical, and logging one as the other is worse than
      // logging nothing.
      if (kind !== "complete" && (video?.currentTime || 0) < 60) return;

      record({ kind, uid, surface: "watch", weight: kind === "complete" ? 1 : fraction });
    },
    [videoRef]
  );

  // A new title is a new sitting, even within the same mounted player — the
  // episode page swaps `contentId` without unmounting when the viewer hits
  // "next episode".
  useEffect(() => {
    const id = newSessionId();
    stateRef.current = {
      sessionId: id,
      secondsWatched: 0,
      playingSince: null,
      requestedAt: null,
      stalledSince: null,
      lastSentSeconds: -1,
      ended: false,
      qoe: emptyQoe(),
    };
    setSessionId(id);
  }, [contentId, contentType]);

  // Quality switches are a QoE signal in their own right: a session that
  // stepped down three times was a bad session even if it never stalled.
  useEffect(() => {
    const state = stateRef.current;
    if (!qualityLabel) return;
    if (state.qoe.qualityLabel && state.qoe.qualityLabel !== qualityLabel) {
      state.qoe.qualitySwitches += 1;
    }
    state.qoe.qualityLabel = qualityLabel;
  }, [qualityLabel]);

  // --- media listeners ------------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled || !contentId) return;

    const state = stateRef.current;

    const onPlay = () => {
      if (state.requestedAt === null && state.qoe.startupMs === 0) {
        state.requestedAt = Date.now();
      }
    };

    const onPlaying = () => {
      // First frame: everything between the play request and now was startup,
      // which is the number viewers actually feel.
      if (state.requestedAt !== null && state.qoe.startupMs === 0) {
        state.qoe.startupMs = Date.now() - state.requestedAt;
        state.requestedAt = null;
      }
      // A stall that resolves is a rebuffer. One that happens before the first
      // frame is startup, already counted above, so it is not double-charged.
      if (state.stalledSince !== null) {
        state.qoe.rebufferSec += (Date.now() - state.stalledSince) / 1000;
        state.stalledSince = null;
      }
      if (state.playingSince === null) state.playingSince = Date.now();

      // Once per title, on the first frame that actually rendered. `play`
      // fires on a click that then fails to start, and a recommender that
      // counts intent as consumption learns from sessions that never happened.
      if (signalRef.current.uid && !signalRef.current.played) {
        signalRef.current.played = true;
        record({ kind: "play", uid: signalRef.current.uid, surface: "watch", weight: 1 });
      }
    };

    const onWaiting = () => {
      settle();
      if (state.stalledSince === null && state.qoe.startupMs > 0) {
        state.qoe.rebufferCount += 1;
        state.stalledSince = Date.now();
      }
    };

    const target = { contentType, contentId };

    const onPause = () => {
      settle();
      send({ target });
    };

    const onEnded = () => {
      state.ended = true;
      settle();
      send({ completed: true, ended: true, target });
      reportProgress("complete");
    };

    const onError = () => {
      settle();
      reportError(`media error ${video.error?.code ?? "unknown"}`);
    };

    // Seeking does not stop the media element from firing `playing` again, but
    // it does mean the stretch either side of it is not continuous.
    const onSeeking = () => settle();

    video.addEventListener("play", onPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);
    video.addEventListener("seeking", onSeeking);

    // The element may already be playing when this runs — autoPlay fires
    // before the effect on a cached source.
    if (!video.paused && !video.ended) onPlaying();

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      video.removeEventListener("seeking", onSeeking);
    };
    // `videoRef.current` is read at effect time; the deps that matter are what
    // decides whether tracking runs at all and which element is mounted.
  }, [videoRef, enabled, contentId, contentType, settle, send, reportError, reportProgress]);

  // --- heartbeat ------------------------------------------------------------

  useEffect(() => {
    if (!enabled || !contentId) return;
    const timer = setInterval(() => send(), HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [enabled, contentId, send]);

  // Closing the tab, backgrounding it, and navigating away are the three most
  // common ways to stop watching, and none of them fires `pause`. Without this
  // the last stretch of every session — often the longest — is simply lost.
  useEffect(() => {
    if (!enabled || !contentId) return;
    const target = { contentType, contentId };

    const onHide = () => {
      settle();
      send({ beacon: true, target });
      reportProgress("progress");
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };

    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      // Unmount, or a switch to another title, ends this sitting.
      settle();
      send({ ended: true, beacon: true, target });
      // Leaving mid-title. `valueOf` reads the fraction as how *little* was
      // watched, so walking out ten minutes in is a strong negative and
      // stopping during the credits is barely one.
      if (!stateRef.current.ended) reportProgress("abandon");
    };
  }, [enabled, contentId, contentType, send, settle, reportProgress]);

  // Stable identity: callers put this object in dependency arrays, and a fresh
  // literal each render would defeat every useCallback that closes over it.
  return useMemo(
    () => ({ flush, reportError, sessionId }),
    [flush, reportError, sessionId]
  );
}

/** Where the viewer left off, for players that need to seek before first play. */
export async function fetchResume(
  contentType: WatchContentType,
  contentId: string
): Promise<{ positionSec: number; durationSec: number; percent: number; completed: boolean }> {
  try {
    const res = await api.get(`/playback/resume/${contentType}/${contentId}`);
    return res.data;
  } catch {
    // No stored position is indistinguishable from a failed lookup as far as
    // the player is concerned: both mean "start from the beginning".
    return { positionSec: 0, durationSec: 0, percent: 0, completed: false };
  }
}
