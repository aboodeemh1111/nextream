/**
 * Server-sent events, so the bell updates the moment something lands.
 *
 * The alternative was polling, and it is worth saying why this is here instead.
 * A bell that polls is a choice between two bad numbers: poll every 30 seconds
 * and every signed-in tab costs a request per half-minute forever, or poll
 * slowly and "new episode" arrives after the viewer has already gone looking.
 * SSE inverts it — one held connection per tab, zero requests until there is
 * something to say, and delivery in the same tick as the insert.
 *
 * Why not a WebSocket library: nothing here needs a client-to-server channel.
 * Reads and writes already have REST endpoints, and SSE is plain HTTP — it
 * traverses the Next.js dev proxy and any reverse proxy without an upgrade
 * handshake, reconnects on its own in every browser, and adds no dependency to
 * an API whose deployment story is a single Node process.
 *
 * The two things a naive SSE hub gets wrong, both handled below:
 *
 *   - **Buffering.** `compression()` is mounted globally, and a gzip stream
 *     holds bytes back until its buffer fills, so events arrive in clumps
 *     minutes late. `Cache-Control: no-transform` is the documented opt-out and
 *     is what makes this work at all behind the existing middleware stack.
 *   - **Leaks.** A connection that is never closed by the client — a laptop lid,
 *     a killed proxy — leaves a `res` in the registry that is written to
 *     forever. Every write is guarded, a dead socket unregisters itself, and
 *     both the per-viewer and process-wide connection counts are capped.
 */

const HEARTBEAT_MS = 25_000;

/**
 * Per-viewer connection ceiling. A viewer with six tabs open is ordinary; a
 * viewer with sixty is a reconnect loop, and the cap is what stops that loop
 * from consuming the process's file descriptors.
 */
const MAX_PER_USER = 8;

/** Process-wide ceiling, so one deployment cannot be exhausted by connections. */
const MAX_TOTAL = 2_000;

/** userId -> Set of live response objects. */
const clients = new Map();
let total = 0;
let heartbeat = null;

function countFor(userId) {
  return clients.get(String(userId))?.size || 0;
}

function stats() {
  return { users: clients.size, connections: total };
}

/**
 * One SSE frame. `event:` names the frame so the client can attach separate
 * handlers instead of switching on a field inside the JSON.
 */
function frame(event, payload) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function write(res, chunk) {
  try {
    if (res.writableEnded || res.destroyed) return false;
    res.write(chunk);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * A comment line every 25 seconds.
 *
 * Not decoration: intermediaries close idle connections at 30–60 seconds, and
 * without traffic the client sees a silent hang rather than a disconnect it can
 * retry. The interval is unref'd so it never holds the process open.
 */
function startHeartbeat() {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    for (const [userId, connections] of clients) {
      for (const res of connections) {
        if (!write(res, ": ping\n\n")) drop(userId, res);
      }
    }
  }, HEARTBEAT_MS);
  if (typeof heartbeat.unref === "function") heartbeat.unref();
}

function stopHeartbeat() {
  if (heartbeat && total === 0) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

function drop(userId, res) {
  const key = String(userId);
  const connections = clients.get(key);
  if (!connections || !connections.has(res)) return;

  connections.delete(res);
  total -= 1;
  if (!connections.size) clients.delete(key);

  try {
    if (!res.writableEnded) res.end();
  } catch (err) {
    /* already gone */
  }
  stopHeartbeat();
}

/**
 * Attaches one response as an event stream.
 *
 * Returns a teardown function; the route also wires it to the request's `close`
 * event, because a client that vanishes never sends anything the handler could
 * react to.
 */
function subscribe(userId, req, res, { unread = 0 } = {}) {
  if (total >= MAX_TOTAL) {
    res.status(503).json({ error: "STREAM_CAPACITY", message: "Too many open streams" });
    return null;
  }

  const key = String(userId);
  const connections = clients.get(key) || new Set();

  // Evict the oldest rather than refusing the newest: the tab the viewer is
  // looking at is the one that just connected.
  while (connections.size >= MAX_PER_USER) {
    const oldest = connections.values().next().value;
    drop(key, oldest);
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    // `no-transform` is what stops the global compression middleware from
    // buffering this response into uselessness.
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // nginx and friends buffer proxied responses by default; this opts out.
    "X-Accel-Buffering": "no",
  });
  if (typeof res.flushHeaders === "function") res.flushHeaders();
  // Without this the kernel batches small frames, adding up to 40ms of latency
  // to the one thing this transport exists to make immediate.
  if (req.socket && typeof req.socket.setNoDelay === "function") req.socket.setNoDelay(true);

  connections.add(res);
  clients.set(key, connections);
  total += 1;
  startHeartbeat();

  // A retry hint plus the current state, so a reconnecting tab is correct
  // immediately rather than after the next event happens to arrive.
  write(res, "retry: 5000\n\n");
  write(res, frame("hello", { unread, at: new Date().toISOString() }));

  const teardown = () => drop(key, res);
  req.on("close", teardown);
  req.on("error", teardown);
  return teardown;
}

/**
 * Sends an event to every tab one viewer has open.
 *
 * Returns how many connections took it, which is what lets the dispatcher note
 * "this person is looking at the app right now" — worth knowing, because it is
 * the case where a push notification is least welcome.
 */
function publish(userId, event, payload) {
  const connections = clients.get(String(userId));
  if (!connections || !connections.size) return 0;

  const chunk = frame(event, payload);
  let delivered = 0;
  for (const res of [...connections]) {
    if (write(res, chunk)) delivered += 1;
    else drop(userId, res);
  }
  return delivered;
}

/** Is this viewer currently connected? */
function isOnline(userId) {
  return countFor(userId) > 0;
}

/** Closes every stream. Used by tests and by a graceful shutdown. */
function closeAll() {
  for (const [userId, connections] of [...clients]) {
    for (const res of [...connections]) drop(userId, res);
  }
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

module.exports = {
  HEARTBEAT_MS,
  MAX_PER_USER,
  MAX_TOTAL,
  closeAll,
  countFor,
  frame,
  isOnline,
  publish,
  stats,
  subscribe,
};
