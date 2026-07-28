"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  deleteUpload,
  startUpload,
  UploadCancelledError,
  UploadFileMismatchError,
  type UploadController,
  type UploadPhase,
  type UploadPrefix,
  type UploadResult,
} from "@/lib/uploadClient";
import {
  deleteSession,
  listSessions,
  type PersistedUpload,
} from "@/lib/uploadStore";

export type UploadItemStatus =
  | "queued"
  | "uploading"
  | "paused"
  | "done"
  | "error"
  /** Restored after a reload; needs the original file re-selected to continue. */
  | "needs-file";

export interface UploadItem {
  id: string;
  /**
   * Stable address of the form field this upload belongs to, e.g.
   * "show:123:poster". Uploads are looked up by field rather than held in the
   * component that started them, so navigating away and back reattaches the
   * transfer instead of orphaning it.
   */
  fieldId?: string;
  label?: string;
  prefix: UploadPrefix;
  fileName: string;
  fileSize: number;
  status: UploadItemStatus;
  phase: UploadPhase;
  progress: number;
  loaded: number;
  speed: number;
  eta: number | null;
  error?: string;
  result?: UploadResult;
  session?: PersistedUpload;
  startedAt: number;
  completedAt?: number;
}

export interface EnqueueInput {
  file: File;
  prefix: UploadPrefix;
  fieldId?: string;
  label?: string;
  contentType?: string;
}

interface UploadApi {
  items: UploadItem[];
  activeCount: number;
  enqueue: (input: EnqueueInput) => string;
  itemForField: (fieldId: string) => UploadItem | undefined;
  resumeWithFile: (id: string, file: File) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  dismiss: (id: string) => void;
  clearFinished: () => void;
  /** Deletes a blob that is no longer referenced by any form field. */
  trash: (key: string) => Promise<void>;
}

const UploadContext = createContext<UploadApi | null>(null);

/** Whole files in flight at once. Each one also runs parts in parallel. */
const MAX_ACTIVE = 2;

export function UploadProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<UploadItem[]>([]);

  const controllers = useRef(new Map<string, UploadController>());
  const files = useRef(new Map<string, File>());
  const inputs = useRef(new Map<string, EnqueueInput>());
  const samples = useRef(new Map<string, { time: number; bytes: number }>());
  const startingRef = useRef(new Set<string>());

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...changes } : item))
    );
  }, []);

  const forget = useCallback((id: string) => {
    controllers.current.delete(id);
    files.current.delete(id);
    inputs.current.delete(id);
    samples.current.delete(id);
    startingRef.current.delete(id);
  }, []);

  // --- restore anything a reload interrupted --------------------------------

  useEffect(() => {
    let cancelled = false;
    listSessions().then((sessions) => {
      if (cancelled || sessions.length === 0) return;
      setItems((prev) => {
        const known = new Set(prev.map((item) => item.id));
        const restored = sessions
          .filter((session) => !known.has(session.id))
          .map<UploadItem>((session) => ({
            id: session.id,
            label: session.label,
            prefix: session.prefix,
            fileName: session.fileName,
            fileSize: session.fileSize,
            status: "needs-file",
            phase: "preparing",
            progress: Math.min(
              99,
              Math.round(
                ((session.parts.length * session.partSize) / session.fileSize) * 100
              )
            ),
            loaded: session.parts.length * session.partSize,
            speed: 0,
            eta: null,
            session,
            startedAt: session.createdAt,
          }));
        return restored.length ? [...prev, ...restored] : prev;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- the actual transfer --------------------------------------------------

  const launch = useCallback(
    (item: UploadItem) => {
      const file = files.current.get(item.id);
      const input = inputs.current.get(item.id);
      if (!file || !input) return;

      startingRef.current.add(item.id);
      patch(item.id, { status: "uploading", error: undefined, startedAt: Date.now() });
      samples.current.delete(item.id);

      const controller = startUpload({
        file,
        prefix: input.prefix,
        contentType: input.contentType,
        label: input.label,
        resumeSession: item.session,
        onPhase: (phase) => patch(item.id, { phase }),
        onProgress: (loaded, total) => {
          const progress = total ? Math.round((loaded * 100) / total) : 0;
          const now = Date.now();
          const last = samples.current.get(item.id);

          let speed: number | undefined;
          let eta: number | null | undefined;
          if (last) {
            const deltaBytes = loaded - last.bytes;
            const deltaTime = (now - last.time) / 1000;
            // Sample about twice a second so the readout does not jitter.
            if (deltaTime >= 0.5 && deltaBytes >= 0) {
              const bps = deltaBytes / deltaTime;
              speed = bps;
              eta = bps > 0 ? Math.ceil((total - loaded) / bps) : null;
              samples.current.set(item.id, { time: now, bytes: loaded });
            }
          } else {
            samples.current.set(item.id, { time: now, bytes: loaded });
          }

          patch(item.id, {
            progress,
            loaded,
            ...(speed !== undefined ? { speed } : {}),
            ...(eta !== undefined ? { eta } : {}),
          });
        },
      });

      controllers.current.set(item.id, controller);

      controller.done
        .then((result) => {
          patch(item.id, {
            status: "done",
            phase: "done",
            progress: 100,
            loaded: file.size,
            speed: 0,
            eta: null,
            result,
            session: undefined,
            completedAt: Date.now(),
          });
          controllers.current.delete(item.id);
          startingRef.current.delete(item.id);
        })
        .catch((err: unknown) => {
          controllers.current.delete(item.id);
          startingRef.current.delete(item.id);

          if (err instanceof UploadCancelledError) {
            // cancel() already removed the row.
            return;
          }
          if (err instanceof UploadFileMismatchError) {
            patch(item.id, { status: "needs-file", error: err.message, speed: 0, eta: null });
            return;
          }
          patch(item.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
            speed: 0,
            eta: null,
          });
        });
    },
    [patch]
  );

  // Promote queued uploads whenever a slot frees up.
  useEffect(() => {
    const active = items.filter(
      (item) => item.status === "uploading" || item.status === "paused"
    ).length;
    if (active >= MAX_ACTIVE) return;

    const next = items.find(
      (item) => item.status === "queued" && !startingRef.current.has(item.id)
    );
    if (next) launch(next);
  }, [items, launch]);

  // --- guard the tab --------------------------------------------------------

  useEffect(() => {
    const busy = items.some(
      (item) =>
        item.status === "uploading" ||
        item.status === "queued" ||
        item.status === "paused"
    );
    if (!busy) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Large transfers can be resumed, but the user should still be asked.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [items]);

  // --- public API -----------------------------------------------------------

  const enqueue = useCallback(
    (input: EnqueueInput) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `up_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      files.current.set(id, input.file);
      inputs.current.set(id, input);

      setItems((prev) => [
        // One upload per field: starting a new poster supersedes a half-finished
        // one rather than racing it.
        ...prev.filter(
          (item) =>
            !(
              input.fieldId &&
              item.fieldId === input.fieldId &&
              item.status !== "done"
            )
        ),
        {
          id,
          fieldId: input.fieldId,
          label: input.label,
          prefix: input.prefix,
          fileName: input.file.name,
          fileSize: input.file.size,
          status: "queued",
          phase: "preparing",
          progress: 0,
          loaded: 0,
          speed: 0,
          eta: null,
          startedAt: Date.now(),
        },
      ]);

      return id;
    },
    []
  );

  const pause = useCallback(
    (id: string) => {
      controllers.current.get(id)?.pause();
      patch(id, { status: "paused", speed: 0, eta: null });
      samples.current.delete(id);
    },
    [patch]
  );

  const resume = useCallback(
    (id: string) => {
      controllers.current.get(id)?.resume();
      patch(id, { status: "uploading" });
      samples.current.delete(id);
    },
    [patch]
  );

  const cancel = useCallback(
    (id: string) => {
      controllers.current.get(id)?.cancel();
      setItems((prev) => prev.filter((item) => item.id !== id));
      forget(id);
    },
    [forget]
  );

  const retry = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "queued", error: undefined, progress: 0, loaded: 0 }
            : item
        )
      );
    },
    []
  );

  /** Continue a session restored from IndexedDB, once the file is back. */
  const resumeWithFile = useCallback(
    (id: string, file: File) => {
      const item = items.find((entry) => entry.id === id);
      if (!item?.session) return;

      files.current.set(id, file);
      inputs.current.set(id, {
        file,
        prefix: item.session.prefix,
        fieldId: item.fieldId,
        label: item.label,
        contentType: item.session.contentType,
      });
      patch(id, { status: "queued", error: undefined });
    },
    [items, patch]
  );

  const dismiss = useCallback(
    (id: string) => {
      const item = items.find((entry) => entry.id === id);
      if (item?.session) void deleteSession(item.session.id);
      setItems((prev) => prev.filter((entry) => entry.id !== id));
      forget(id);
    },
    [items, forget]
  );

  const clearFinished = useCallback(() => {
    setItems((prev) => {
      prev
        .filter((item) => item.status === "done" || item.status === "error")
        .forEach((item) => forget(item.id));
      return prev.filter((item) => item.status !== "done" && item.status !== "error");
    });
  }, [forget]);

  const itemForField = useCallback(
    (fieldId: string) => {
      // Newest first: a replacement supersedes whatever it replaced.
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].fieldId === fieldId) return items[i];
      }
      return undefined;
    },
    [items]
  );

  const trash = useCallback(async (key: string) => {
    if (!key) return;
    try {
      await deleteUpload(key);
    } catch {
      // reapOrphans.js is the backstop; a failed cleanup must never block a save.
    }
  }, []);

  const api = useMemo<UploadApi>(
    () => ({
      items,
      activeCount: items.filter(
        (item) =>
          item.status === "uploading" ||
          item.status === "queued" ||
          item.status === "paused"
      ).length,
      enqueue,
      itemForField,
      resumeWithFile,
      pause,
      resume,
      cancel,
      retry,
      dismiss,
      clearFinished,
      trash,
    }),
    [
      items,
      enqueue,
      itemForField,
      resumeWithFile,
      pause,
      resume,
      cancel,
      retry,
      dismiss,
      clearFinished,
      trash,
    ]
  );

  return <UploadContext.Provider value={api}>{children}</UploadContext.Provider>;
}

export function useUploads(): UploadApi {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUploads must be used inside an UploadProvider");
  }
  return context;
}
