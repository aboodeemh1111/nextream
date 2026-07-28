/**
 * The arithmetic behind a playback heartbeat, kept away from Express and
 * Mongo so the rules that make the numbers trustworthy can be pinned without
 * a database.
 *
 * Every rule here exists to survive the same three things: a heartbeat that
 * arrives twice, one that arrives out of order, and one that arrives from a
 * client that is lying or broken.
 */

/** Long enough not to spam the API, short enough that a closed laptop loses little. */
const HEARTBEAT_INTERVAL_SEC = 15;
/**
 * Wall-clock grace before a reported total is treated as impossible.
 *
 * A session row is created by the *first* heartbeat, one interval into
 * playback, so a client's honest total always runs slightly ahead of the time
 * elapsed since the row existed. The grace covers that plus clock skew,
 * without letting a broken player claim hours it never spent.
 */
const CLOCK_GRACE_SEC = 120;
/** Matches tvCatalog: the last few percent are credits nobody watches. */
const COMPLETE_PERCENT = 95;

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(num(value), max));
}

/** Map keys become dotted update paths, so anything that breaks one is out. */
function genreKey(genre) {
  const key = String(genre || "")
    .replace(/[.$ ]/g, " ")
    .trim();
  return key.length && key.length <= 60 ? key : null;
}

function sanitiseQoe(input) {
  const qoe = input && typeof input === "object" ? input : {};
  return {
    startupMs: clamp(qoe.startupMs, 0, 600000),
    rebufferCount: Math.round(clamp(qoe.rebufferCount, 0, 10000)),
    rebufferSec: clamp(qoe.rebufferSec, 0, 86400),
    errorCount: Math.round(clamp(qoe.errorCount, 0, 10000)),
    lastError: String(qoe.lastError || "").slice(0, 200),
    qualityLabel: String(qoe.qualityLabel || "").slice(0, 60),
    qualitySwitches: Math.round(clamp(qoe.qualitySwitches, 0, 10000)),
  };
}

/**
 * Folds a heartbeat's QoE into what the session already holds.
 *
 * A plain overwrite loses data: any client that omits the block — an older
 * build, an embed, a final flush assembled without it — would reset a session
 * that had already reported a slow start and three rebuffers back to a clean
 * record. Counters only ever climb, and startup is measured once per session,
 * so the merge is a max over the numbers and first-non-empty over the strings.
 */
function mergeQoe(stored, incoming) {
  const prev = stored || {};
  const next = sanitiseQoe(incoming);
  return {
    startupMs: prev.startupMs > 0 ? prev.startupMs : next.startupMs,
    rebufferCount: Math.max(num(prev.rebufferCount), next.rebufferCount),
    rebufferSec: Math.max(num(prev.rebufferSec), next.rebufferSec),
    errorCount: Math.max(num(prev.errorCount), next.errorCount),
    lastError: next.lastError || prev.lastError || "",
    qualityLabel: next.qualityLabel || prev.qualityLabel || "",
    qualitySwitches: Math.max(num(prev.qualitySwitches), next.qualitySwitches),
  };
}

/**
 * Reconciles the running total a client reports against what is stored.
 *
 * Monotonic, and bounded by how long the session has actually been open. A
 * client reporting *less* than we hold is stale, not authoritative — that is
 * what makes a duplicated or reordered heartbeat harmless. One reporting more
 * time than has elapsed is broken or hostile.
 *
 * @returns {{seconds: number, delta: number}} the new total, and the amount to
 *   advance user-level rollups by. `delta` is derived here rather than sent by
 *   the client precisely so that replaying a heartbeat adds nothing.
 */
function reconcileSeconds({ priorSeconds = 0, reportedSeconds, startedAt, now = new Date() }) {
  const prior = Math.max(0, num(priorSeconds));
  const reported = Math.max(0, num(reportedSeconds));
  const start = startedAt ? new Date(startedAt) : now;
  const elapsed = Math.max(0, (now - start) / 1000) + CLOCK_GRACE_SEC;

  const seconds = Math.min(Math.max(prior, reported), elapsed);
  return { seconds, delta: Math.max(0, seconds - prior) };
}

/**
 * Position, percentage and completion for one heartbeat.
 *
 * Percent is computed from the furthest point reached, not the current one, so
 * a viewer who watches to the end and then scrubs back does not un-finish the
 * title — and neither does a heartbeat that lands just after a seek to zero.
 */
function computePosition({
  positionSec,
  durationSec,
  catalogueDurationMin = 0,
  storedMaxPositionSec = 0,
  completedFlag,
  previouslyCompleted,
}) {
  const position = Math.max(0, num(positionSec));
  const reported = Math.max(0, num(durationSec));
  // Fall back to the catalogue value (authored in minutes) so a ping that
  // arrives before loadedmetadata still yields a usable percentage.
  const duration = reported || Math.max(0, num(catalogueDurationMin)) * 60;

  const maxPosition = Math.max(Math.max(0, num(storedMaxPositionSec)), position);
  const percent = duration ? Math.min(100, Math.round((maxPosition / duration) * 100)) : 0;

  const completed =
    completedFlag === true ||
    Boolean(previouslyCompleted) ||
    (duration > 0 && percent >= COMPLETE_PERCENT);

  return { position, duration, maxPosition, percent, completed };
}

module.exports = {
  CLOCK_GRACE_SEC,
  COMPLETE_PERCENT,
  HEARTBEAT_INTERVAL_SEC,
  computePosition,
  genreKey,
  mergeQoe,
  reconcileSeconds,
  sanitiseQoe,
};
