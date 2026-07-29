/**
 * Local storage for everything the recommender learns.
 *
 * IndexedDB rather than localStorage, for three reasons that all matter here:
 * it holds structured values, so a Float32Array of model weights round-trips as
 * binary instead of as a JSON array five times its size; it is asynchronous, so
 * writing a megabyte of catalogue does not block the frame; and its quota is
 * measured in hundreds of megabytes rather than five.
 *
 * Two stores, because the access patterns have nothing in common. `kv` holds a
 * handful of large values written rarely — the snapshot, the weights, the taste
 * profile. `signals` holds thousands of tiny ones written constantly and read in
 * time order, which is an index on a timestamp and an append.
 *
 * Every operation here resolves rather than rejects on failure. Private
 * browsing, a full disk and Safari's storage eviction all surface as exceptions
 * from IndexedDB, and none of them is a reason to stop showing recommendations
 * — they only mean this session starts from nothing and cannot save what it
 * learns. That is a degradation, not an error.
 */

const DB_NAME = "nextream-ml";
const DB_VERSION = 1;
const KV = "kv";
const SIGNALS = "signals";

/**
 * How many interactions are kept.
 *
 * Enough for the sequence model to see real sessions and for the listwise
 * ranker to have slates to learn from; bounded because this grows without
 * limit otherwise, and a year-old impression tells the ranker nothing that the
 * taste vector has not already absorbed.
 */
export const SIGNAL_LIMIT = 6000;

let connection: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (connection) return connection;

  connection = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
      if (!db.objectStoreNames.contains(SIGNALS)) {
        const store = db.createObjectStore(SIGNALS, { keyPath: "seq", autoIncrement: true });
        // Signals are always read as "the last N in order" — for the sequence
        // model, for decay weighting, for trimming. Without this index every
        // one of those is a full scan and a sort.
        store.createIndex("at", "at");
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Another tab running a newer build will try to upgrade and be blocked by
      // this handle. Closing frees it; this tab loses persistence for the rest
      // of its life, which beats deadlocking the tab the viewer is looking at.
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return connection;
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest | null,
  fallback: T
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve) => {
        if (!db) return resolve(fallback);

        let request: IDBRequest | null;
        try {
          const tx = db.transaction(store, mode);
          tx.onerror = () => resolve(fallback);
          tx.onabort = () => resolve(fallback);
          request = fn(tx.objectStore(store));
        } catch {
          return resolve(fallback);
        }

        if (!request) return resolve(fallback);
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => resolve(fallback);
      })
  );
}

// --- key/value ---------------------------------------------------------------

export function kvGet<T>(key: string): Promise<T | null> {
  return run<T | null>(KV, "readonly", (store) => store.get(key), null).then(
    (value) => value ?? null
  );
}

export function kvSet(key: string, value: unknown): Promise<void> {
  return run(KV, "readwrite", (store) => store.put(value, key), undefined).then(() => undefined);
}

// --- signals -----------------------------------------------------------------

export interface StoredSignal {
  seq?: number;
  kind: string;
  uid: string;
  at: number;
  surface: string;
  position: number;
  weight: number;
  query?: string;
  slate?: string;
}

export function appendSignals(signals: StoredSignal[]): Promise<void> {
  if (!signals.length) return Promise.resolve();

  return open().then(
    (db) =>
      new Promise<void>((resolve) => {
        if (!db) return resolve();
        try {
          const tx = db.transaction(SIGNALS, "readwrite");
          const store = tx.objectStore(SIGNALS);
          // One transaction for the whole batch. Signals arrive in bursts — a
          // row scrolling into view is twenty impressions in one frame — and a
          // transaction each would be twenty round trips through the event loop.
          for (const signal of signals) store.add(signal);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        } catch {
          resolve();
        }
      })
  );
}

/** The most recent `limit` signals, oldest first. */
export function readSignals(limit = SIGNAL_LIMIT): Promise<StoredSignal[]> {
  return open().then(
    (db) =>
      new Promise<StoredSignal[]>((resolve) => {
        if (!db) return resolve([]);
        try {
          const tx = db.transaction(SIGNALS, "readonly");
          const index = tx.objectStore(SIGNALS).index("at");
          const cursor = index.openCursor(null, "prev");
          const out: StoredSignal[] = [];

          cursor.onsuccess = () => {
            const handle = cursor.result;
            if (!handle || out.length >= limit) {
              // Walked backwards from the newest to bound the read; the models
              // all want time order, so hand back the reversal.
              return resolve(out.reverse());
            }
            out.push(handle.value as StoredSignal);
            handle.continue();
          };
          cursor.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      })
  );
}

/**
 * Drops everything past the cap, oldest first.
 *
 * Called after a write burst rather than on a timer: the store only grows when
 * something is added, so that is the only moment it can cross the limit.
 */
export function trimSignals(limit = SIGNAL_LIMIT): Promise<number> {
  return open().then(
    (db) =>
      new Promise<number>((resolve) => {
        if (!db) return resolve(0);
        try {
          const tx = db.transaction(SIGNALS, "readwrite");
          const store = tx.objectStore(SIGNALS);
          const counter = store.count();

          counter.onsuccess = () => {
            const excess = counter.result - limit;
            if (excess <= 0) return resolve(0);

            let removed = 0;
            const cursor = store.index("at").openCursor();
            cursor.onsuccess = () => {
              const handle = cursor.result;
              if (!handle || removed >= excess) return resolve(removed);
              handle.delete();
              removed += 1;
              handle.continue();
            };
            cursor.onerror = () => resolve(removed);
          };
          counter.onerror = () => resolve(0);
        } catch {
          resolve(0);
        }
      })
  );
}

export function clearSignals(): Promise<void> {
  return run(SIGNALS, "readwrite", (store) => store.clear(), undefined).then(() => undefined);
}

/** Forgets everything — the model, the history, the cached catalogue. */
export async function wipe(): Promise<void> {
  await clearSignals();
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(KV, "readwrite");
      tx.objectStore(KV).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
