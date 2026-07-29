/* global self, importScripts, firebase, clients */

/**
 * The push service worker.
 *
 * This worker renders every notification itself rather than letting the browser
 * do it, and that single decision is what the rest of the file follows from. The
 * server sends **data-only** messages (see api/services/notifications/push.js):
 * a payload with a top-level `notification` key is displayed by Chrome *and*
 * delivered to `onBackgroundMessage`, so the obvious implementation shows
 * everything twice. Owning the render is also the only way to get:
 *
 *   - **Collapsing.** `tag` is set from the server's group key, so five new
 *     episodes of one show replace each other instead of stacking five banners.
 *   - **Actions.** A "Watch now" button that goes straight to the player.
 *   - **Click attribution.** The click handler reports back *before* opening the
 *     deep link, which is what makes the open-rate figure in the admin console
 *     real rather than an estimate from page views.
 *   - **Focus handoff.** When a tab is already visible, no OS banner is shown at
 *     all — the page is told to render an in-app toast instead. Interrupting
 *     someone to tell them about something they are looking at is noise.
 *
 * Written against the compat SDK, loaded from gstatic, because a service worker
 * cannot use the app's module bundle.
 */

importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js");

// Public web config. Not secrets — these identify the project to Firebase and are
// visible in any client bundle.
firebase.initializeApp({
  apiKey: "AIzaSyB91ogaobBfR_bflbdUjr8J_hHBkI7G_JI",
  authDomain: "onstream-6a46b.firebaseapp.com",
  projectId: "onstream-6a46b",
  messagingSenderId: "635674662728",
  appId: "1:635674662728:web:603b0f17a1e43fd096457d",
});

const messaging = firebase.messaging();

const FALLBACK_ICON = "/logo.png";

/** Take over from a previous worker immediately rather than on the next reload. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/** The shape the page's NotificationsContext expects on a postMessage. */
function toClientNotification(data) {
  return {
    id: data.id || "",
    type: data.type || "",
    category: data.category || "product",
    categoryLabel: "",
    priority: data.priority || "normal",
    title: data.title || "Nextream",
    body: data.body || "",
    image: data.image || "",
    icon: data.icon || "",
    deepLink: data.deepLink || "/",
    entity: { kind: data.entityKind || "", id: data.entityId || "", title: "" },
    reason: "",
    groupKey: data.groupKey || null,
    read: false,
    readAt: null,
    clickedAt: null,
    archived: false,
    createdAt: new Date().toISOString(),
    pushed: true,
  };
}

/** Is one of this origin's tabs on screen right now? */
async function visibleClients() {
  const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
  return all.filter((client) => client.visibilityState === "visible");
}

async function handlePush(data) {
  const open = await visibleClients();

  if (open.length) {
    // Handed to the page: an OS banner over a tab the viewer is reading is worse
    // than the in-app toast the app can render in place.
    for (const client of open) {
      client.postMessage({
        source: "nextream-notifications",
        type: "push",
        notification: toClientNotification(data),
      });
    }
    return;
  }

  const actions = [];
  // Only offered where it means something. A "Watch now" button on a security
  // alert would be a button that does the wrong thing.
  if (data.deepLink && /^\/watch\//.test(data.deepLink)) {
    actions.push({ action: "open", title: "Watch now" });
  }

  await self.registration.showNotification(data.title || "Nextream", {
    body: data.body || "",
    icon: data.icon || FALLBACK_ICON,
    badge: FALLBACK_ICON,
    image: data.image || undefined,
    // The group key from the catalog: one card per show, not one per episode.
    tag: data.groupKey || data.id || "nextream",
    // With a tag set, the default is to replace *silently*. A replacement that
    // arrives unannounced is a notification the viewer never learns about.
    renotify: Boolean(data.groupKey),
    // Only account and security notices stay on screen until acknowledged;
    // everything else is dismissible noise if the viewer is busy.
    requireInteraction: data.category === "account",
    silent: data.priority === "low",
    timestamp: Date.now(),
    data: {
      id: data.id || "",
      deepLink: data.deepLink || "/",
      category: data.category || "",
      type: data.type || "",
    },
    actions,
  });
}

messaging.onBackgroundMessage((payload) => {
  // Data-only by design, so everything is in `payload.data`. The `notification`
  // fallback covers a message sent by hand from the Firebase console.
  const data = payload.data || {};
  if (!data.title && payload.notification) {
    data.title = payload.notification.title;
    data.body = payload.notification.body;
  }
  handlePush(data);
});

/**
 * Where a click waits to be reported.
 *
 * The worker cannot report it itself. The API authenticates with a bearer token
 * the app keeps in `localStorage`, and a service worker has no access to that —
 * a `fetch` from here would simply 401, silently, and the click rate in the admin
 * console would read as zero forever.
 *
 * So the click is recorded in IndexedDB, which *is* shared between the worker and
 * the page, and the page drains it on load (see lib/pendingClicks.ts). Since a
 * click always opens or focuses a page, the hand-off is reliable — and putting
 * the queue here rather than postMessaging a freshly-opened tab avoids racing its
 * listener registration.
 *
 * Keep the database name, version and store in step with lib/pendingClicks.ts.
 */
const DB_NAME = "nextream-notifications";
const DB_VERSION = 1;
const STORE = "pendingClicks";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function queueClick(id) {
  return openDatabase()
    .then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE, "readwrite");
          // Keyed on the notification id, so a double-tap queues one entry.
          transaction.objectStore(STORE).put({ id, at: Date.now() });
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        })
    )
    .catch(() => {});
}

/**
 * A tap on the notification.
 *
 * The click is queued first and the window opened second, both inside
 * `waitUntil` — a worker that has already navigated away can be terminated, and
 * the queued click is what the open rate in the admin console is computed from.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const target = data.deepLink || "/";

  event.waitUntil(
    (async () => {
      if (data.id) await queueClick(data.id);

      const all = await clients.matchAll({ type: "window", includeUncontrolled: true });

      // Reuse a tab that is already on the target, then any tab of this origin,
      // and only open a new window as a last resort. Opening one unconditionally
      // leaves a viewer with a fresh tab per notification.
      const exact = all.find((client) => new URL(client.url).pathname === target);
      if (exact) return exact.focus();

      const existing = all[0];
      if (existing) {
        await existing.focus();
        return existing.navigate(target).catch(() => clients.openWindow(target));
      }

      return clients.openWindow(target);
    })()
  );
});
