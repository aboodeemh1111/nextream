import type { UploadPrefix } from "./uploadClient";

/**
 * Durable record of an in-progress multipart upload.
 *
 * Multipart already gave us pause and per-part retry, but the uploadId and the
 * ETags collected so far only ever lived in a closure — reloading the tab threw
 * them away and a 2 GB episode restarted from byte 0. Keeping them here means a
 * reload costs the user one file re-selection, not the whole transfer.
 *
 * The file itself is deliberately not stored. Putting a multi-gigabyte Blob in
 * IndexedDB doubles disk usage for the entire upload, and the browser may evict
 * it anyway; the fingerprint below is enough to prove the re-picked file is the
 * same one before any part is skipped.
 */
export interface PersistedUpload {
  id: string;
  key: string;
  uploadId: string;
  prefix: UploadPrefix;
  contentType: string;
  partSize: number;
  parts: Array<{ PartNumber: number; ETag: string }>;
  /** Fingerprint of the source file, checked before resuming. */
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  /** What the admin was filling in, so the tray can say where it belongs. */
  label?: string;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = "nextream-uploads";
const DB_VERSION = 1;
const STORE = "sessions";

/** Sessions older than this are past any sane bucket lifecycle rule. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      // Private browsing modes can throw outright.
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    // Persistence is an optimisation: if it is unavailable the upload still
    // works, it just cannot survive a reload.
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const transaction = db.transaction(STORE, mode);
          const request = run(transaction.objectStore(STORE));
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

export function fingerprintOf(file: File) {
  return {
    fileName: file.name,
    fileSize: file.size,
    fileLastModified: file.lastModified,
  };
}

/** True when a re-selected file is byte-for-byte the one the session started. */
export function fileMatchesSession(file: File, session: PersistedUpload): boolean {
  return (
    file.name === session.fileName &&
    file.size === session.fileSize &&
    file.lastModified === session.fileLastModified
  );
}

export async function saveSession(session: PersistedUpload): Promise<void> {
  await tx("readwrite", (store) => store.put(session));
}

export async function updateSessionParts(
  id: string,
  parts: PersistedUpload["parts"]
): Promise<void> {
  const existing = await tx<PersistedUpload>("readonly", (store) => store.get(id));
  if (!existing) return;
  await tx("readwrite", (store) =>
    store.put({ ...existing, parts, updatedAt: Date.now() })
  );
}

export async function deleteSession(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id));
}

export async function listSessions(): Promise<PersistedUpload[]> {
  const all = await tx<PersistedUpload[]>("readonly", (store) => store.getAll());
  if (!all) return [];

  const cutoff = Date.now() - MAX_AGE_MS;
  const fresh = all.filter((session) => session.updatedAt >= cutoff);
  // Sweep anything the bucket lifecycle rule will have reaped by now.
  for (const stale of all.filter((session) => session.updatedAt < cutoff)) {
    void deleteSession(stale.id);
  }
  return fresh.sort((a, b) => b.updatedAt - a.updatedAt);
}
