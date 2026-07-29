/**
 * The page side of the service worker's click queue.
 *
 * A notification clicked while the app was closed is the whole point of push, and
 * it is also the one click the worker cannot report: the API authenticates with a
 * bearer token held in `localStorage`, which a service worker cannot read. So the
 * worker records the click in IndexedDB — shared between both contexts — and this
 * drains it from the page, which does have the token.
 *
 * Reliable because a click always opens or focuses a page: the drain runs on every
 * mount of NotificationsProvider, so the report happens on the very load the click
 * caused. Entries that somehow outlive that are expired rather than kept, since a
 * click attributed a week late is worse data than no click at all.
 *
 * Keep DB_NAME / DB_VERSION / STORE in step with public/firebase-messaging-sw.js.
 */

const DB_NAME = "nextream-notifications";
const DB_VERSION = 1;
const STORE = "pendingClicks";

/** Past this, a queued click is stale enough to be misleading. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface PendingClick {
  id: string;
  at: number;
}

function supported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    // Created here as well as in the worker: whichever context runs first owns
    // the upgrade, and the page frequently wins on a cold start.
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

/**
 * Removes and returns every queued click.
 *
 * Read-and-clear in one transaction, so two tabs draining at the same moment
 * cannot both report the same click and double-count it.
 */
export async function drainPendingClicks(): Promise<string[]> {
  if (!supported()) return [];

  try {
    const db = await openDatabase();
    return await new Promise<string[]>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const rows = (request.result || []) as PendingClick[];
        store.clear();
        const cutoff = Date.now() - MAX_AGE_MS;
        resolve(rows.filter((row) => row.id && row.at >= cutoff).map((row) => row.id));
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Private browsing, a blocked upgrade, a quota error: none of these are worth
    // surfacing for a lost analytics event.
    return [];
  }
}
