import api from "@/lib/axios";
import { resolveContentType } from "@/lib/mediaAccept";
import {
  deleteSession,
  fileMatchesSession,
  fingerprintOf,
  saveSession,
  updateSessionParts,
  type PersistedUpload,
} from "@/lib/uploadStore";

// Transport only — no React. The browser PUTs bytes straight at the bucket
// using URLs the API signs; the API never sees the file itself.
//
// XMLHttpRequest rather than fetch because fetch still has no upload progress
// events, and the uploader UI reports percentage, speed and ETA.

export type UploadPrefix =
  | "images"
  | "trailers"
  | "videos"
  | "shows"
  | "episodes"
  | "subs"
  | "avatars";

export interface UploadResult {
  key: string;
  previewUrl: string;
  size: number;
  contentType?: string;
}

export type UploadPhase =
  | "preparing"
  | "uploading"
  | "finalizing"
  | "done";

export interface UploadOptions {
  file: File;
  prefix: UploadPrefix;
  /** Overrides file.type — browsers often report "" for .vtt and .heic. */
  contentType?: string;
  /** How many parts are in flight at once. */
  concurrency?: number;
  /** Continue a multipart upload persisted before a reload. */
  resumeSession?: PersistedUpload;
  onProgress?: (loaded: number, total: number) => void;
  onPhase?: (phase: UploadPhase) => void;
  /** Fires once a multipart upload exists, so it can be persisted. */
  onSession?: (session: PersistedUpload) => void;
  label?: string;
}

export interface UploadController {
  id: string;
  done: Promise<UploadResult>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

export interface UploadPolicy {
  prefixes: Record<string, { accept: string[]; maxBytes: number }>;
  simpleMaxBytes: number;
  defaultPartSize: number;
  minPartSize: number;
  maxParts: number;
}

const FALLBACK_POLICY: UploadPolicy = {
  prefixes: {},
  simpleMaxBytes: 16 * 1024 * 1024,
  defaultPartSize: 16 * 1024 * 1024,
  minPartSize: 5 * 1024 * 1024,
  maxParts: 10000,
};

const DEFAULT_CONCURRENCY = 4;
const PART_ATTEMPTS = 4;

export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

/** Wrong file picked when resuming; the session is still usable. */
export class UploadFileMismatchError extends Error {
  constructor() {
    super("That is a different file — pick the original to resume this upload");
    this.name = "UploadFileMismatchError";
  }
}

class HttpUploadError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "HttpUploadError";
  }

  /** 5xx and throttling are worth another go; a 400 never is. */
  get retryable() {
    return (
      this.status === 0 ||
      this.status === 403 || // expired signature — a fresh one is requested per attempt
      this.status === 408 ||
      this.status === 429 ||
      this.status >= 500
    );
  }
}

function apiErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.message || err?.message || fallback;
}

let policyPromise: Promise<UploadPolicy> | null = null;

/**
 * Limits come from the server. The old client hardcoded a single 2 GB cap for
 * every field while the API enforces 25 MB on images and 5 MB on subtitles, so
 * an oversized poster passed the browser check and failed at /presign.
 */
export function fetchUploadPolicy(): Promise<UploadPolicy> {
  if (!policyPromise) {
    policyPromise = api
      .get("/uploads/policy")
      .then((res) => res.data as UploadPolicy)
      .catch(() => FALLBACK_POLICY);
  }
  return policyPromise;
}

export function maxBytesFor(policy: UploadPolicy, prefix: UploadPrefix): number | null {
  return policy.prefixes[prefix]?.maxBytes ?? null;
}

function xhrSend(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress: ((loaded: number) => void) | undefined,
  register: (xhr: XMLHttpRequest | null) => void
): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }
    if (onProgress) {
      xhr.upload.onprogress = (e) => onProgress(e.loaded);
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr);
      else reject(new HttpUploadError(xhr.status, `Upload failed (HTTP ${xhr.status})`));
    };
    xhr.onerror = () =>
      reject(
        new HttpUploadError(
          0,
          "Network error during upload. Check the bucket's CORS configuration."
        )
      );
    xhr.onabort = () => reject(new UploadCancelledError());
    register(xhr);
    xhr.send(body);
  });
}

function backoffDelay(attempt: number) {
  // Exponential with jitter, so a bucket hiccup does not turn into a
  // synchronised retry storm across every part in flight.
  const base = Math.min(8000, 400 * Math.pow(2, attempt));
  return base + Math.random() * 250;
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `up_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

class Upload {
  readonly id: string;
  readonly done: Promise<UploadResult>;

  private paused = false;
  private cancelled = false;
  private resumeWaiters: Array<() => void> = [];
  private inFlight = new Set<XMLHttpRequest>();

  /** Bytes for parts that finished, plus live counts for parts in flight. */
  private completedBytes = 0;
  private partProgress = new Map<number, number>();

  private session: PersistedUpload | null = null;

  constructor(private readonly options: UploadOptions) {
    this.id = options.resumeSession?.id ?? newId();
    this.done = this.run();
  }

  pause() {
    if (this.cancelled || this.paused) return;
    this.paused = true;
    // Abort what is in flight rather than letting it drain: pausing a 2 GB
    // upload should feel immediate. Those parts are re-sent on resume.
    this.abortInFlight();
  }

  resume() {
    if (this.cancelled || !this.paused) return;
    this.paused = false;
    const waiters = this.resumeWaiters;
    this.resumeWaiters = [];
    waiters.forEach((wake) => wake());
  }

  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    this.paused = false;
    this.resumeWaiters.splice(0).forEach((wake) => wake());
    this.abortInFlight();
    void this.abortMultipart();
  }

  private abortInFlight() {
    for (const xhr of this.inFlight) xhr.abort();
    this.inFlight.clear();
    this.partProgress.clear();
    this.report();
  }

  private async abortMultipart() {
    const session = this.session;
    if (!session) return;
    this.session = null;
    await deleteSession(session.id).catch(() => {});
    try {
      await api.post("/uploads/multipart/abort", {
        key: session.key,
        uploadId: session.uploadId,
      });
    } catch {
      // The bucket lifecycle rule reaps incomplete uploads as a backstop.
    }
  }

  private waitWhilePaused(): Promise<void> {
    if (!this.paused) return Promise.resolve();
    return new Promise((resolve) => this.resumeWaiters.push(resolve));
  }

  private throwIfCancelled() {
    if (this.cancelled) throw new UploadCancelledError();
  }

  private report() {
    let inFlightBytes = 0;
    for (const bytes of this.partProgress.values()) inFlightBytes += bytes;
    this.options.onProgress?.(
      Math.min(this.options.file.size, this.completedBytes + inFlightBytes),
      this.options.file.size
    );
  }

  private phase(phase: UploadPhase) {
    this.options.onPhase?.(phase);
  }

  private async run(): Promise<UploadResult> {
    const { file, prefix, resumeSession } = this.options;
    // Prefer an explicit override, then File.type, then the extension —
    // browsers frequently omit type for webp/heic/jfif, which would otherwise
    // become application/octet-stream and be rejected by the prefix policy.
    const contentType = resolveContentType(file, this.options.contentType);

    try {
      this.phase("preparing");

      if (resumeSession) {
        if (!fileMatchesSession(file, resumeSession)) {
          throw new UploadFileMismatchError();
        }
        return await this.runMultipart(contentType, resumeSession);
      }

      const policy = await fetchUploadPolicy();
      const limit = maxBytesFor(policy, prefix);
      if (limit !== null && file.size > limit) {
        throw new Error(
          `File is too large for "${prefix}". Max ${Math.floor(limit / (1024 * 1024))} MB`
        );
      }

      return file.size > policy.simpleMaxBytes
        ? await this.runMultipart(contentType, null)
        : await this.runSimple(contentType);
    } catch (err) {
      if (!(err instanceof UploadCancelledError) && !(err instanceof UploadFileMismatchError)) {
        // Leave nothing dangling in the bucket on failure either.
        await this.abortMultipart();
      }
      throw err;
    }
  }

  private async runSimple(contentType: string): Promise<UploadResult> {
    const { file, prefix } = this.options;
    this.throwIfCancelled();

    const presign = await api
      .post("/uploads/presign", {
        prefix,
        filename: file.name,
        contentType,
        size: file.size,
      })
      .catch((err) => {
        throw new Error(apiErrorMessage(err, "Could not start the upload"));
      });

    const { key, uploadUrl, headers } = presign.data as {
      key: string;
      uploadUrl: string;
      headers: Record<string, string>;
    };

    this.throwIfCancelled();
    await this.waitWhilePaused();
    this.phase("uploading");

    // headers come from the server and are covered by the signature — sending
    // anything else fails the signature check.
    await xhrSend(
      uploadUrl,
      file,
      headers,
      (loaded) => {
        this.partProgress.set(1, loaded);
        this.report();
      },
      (xhr) => {
        if (xhr) this.inFlight.add(xhr);
      }
    );
    this.inFlight.clear();
    this.completedBytes = file.size;
    this.partProgress.clear();
    this.report();

    return this.confirm(key);
  }

  private async runMultipart(
    contentType: string,
    existing: PersistedUpload | null
  ): Promise<UploadResult> {
    const { file, prefix } = this.options;
    this.throwIfCancelled();

    let session = existing;
    let done: Array<{ PartNumber: number; ETag: string }> = [];

    if (session) {
      // The bucket, not our local record, decides what actually landed: a part
      // can be in flight when the tab closes, and a stale uploadId has to be
      // detected rather than retried forever.
      const status = await api
        .post("/uploads/multipart/status", {
          key: session.key,
          uploadId: session.uploadId,
        })
        .then((res) => res.data as { active: boolean; parts: Array<{ PartNumber: number; ETag: string }> })
        .catch(() => null);

      if (!status || !status.active) {
        await deleteSession(session.id).catch(() => {});
        session = null;
      } else {
        done = status.parts.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag }));
      }
    }

    if (!session) {
      const created = await api
        .post("/uploads/multipart/create", {
          prefix,
          filename: file.name,
          contentType,
          size: file.size,
        })
        .catch((err) => {
          throw new Error(apiErrorMessage(err, "Could not start the upload"));
        });

      const { key, uploadId, partSize } = created.data as {
        key: string;
        uploadId: string;
        partSize: number;
      };

      session = {
        id: this.id,
        key,
        uploadId,
        prefix,
        contentType,
        partSize,
        parts: [],
        label: this.options.label,
        ...fingerprintOf(file),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveSession(session).catch(() => {});
      this.options.onSession?.(session);
    }

    this.session = session;
    const { partSize } = session;
    const totalParts = Math.max(1, Math.ceil(file.size / partSize));

    const byNumber = new Map(done.map((p) => [p.PartNumber, p]));
    // Resumed parts count towards progress immediately, so the bar picks up
    // where it left off instead of snapping back to zero.
    for (const part of byNumber.keys()) {
      this.completedBytes += this.sizeOfPart(part, totalParts, partSize, file.size);
    }
    this.report();

    const pending: number[] = [];
    for (let n = 1; n <= totalParts; n++) {
      if (!byNumber.has(n)) pending.push(n);
    }

    this.phase("uploading");
    await this.drainParts(pending, byNumber, session, partSize, totalParts);

    this.throwIfCancelled();
    this.phase("finalizing");

    const parts = Array.from(byNumber.values()).sort(
      (a, b) => a.PartNumber - b.PartNumber
    );
    const completed = await api
      .post("/uploads/multipart/complete", {
        key: session.key,
        uploadId: session.uploadId,
        parts,
      })
      .catch((err) => {
        throw new Error(apiErrorMessage(err, "Could not finish the upload"));
      });

    await deleteSession(session.id).catch(() => {});
    this.session = null;

    return this.confirm((completed.data as { key: string }).key);
  }

  private sizeOfPart(
    partNumber: number,
    totalParts: number,
    partSize: number,
    fileSize: number
  ) {
    return partNumber === totalParts ? fileSize - (totalParts - 1) * partSize : partSize;
  }

  /**
   * Runs `concurrency` part uploads at a time.
   *
   * The previous implementation awaited one 16 MB part at a time, which leaves
   * most of the available bandwidth idle for the whole transfer — the round
   * trip to request the next part URL alone stalls the pipe between parts.
   */
  private async drainParts(
    pending: number[],
    byNumber: Map<number, { PartNumber: number; ETag: string }>,
    session: PersistedUpload,
    partSize: number,
    totalParts: number
  ) {
    const { file } = this.options;
    const concurrency = Math.max(
      1,
      Math.min(this.options.concurrency ?? DEFAULT_CONCURRENCY, pending.length || 1)
    );

    let cursor = 0;
    let failure: unknown = null;

    const worker = async () => {
      for (;;) {
        if (failure || this.cancelled) return;

        await this.waitWhilePaused();
        if (failure || this.cancelled) return;

        const index = cursor++;
        if (index >= pending.length) return;
        const partNumber = pending[index];

        const start = (partNumber - 1) * partSize;
        const chunk = file.slice(start, Math.min(start + partSize, file.size));

        try {
          const etag = await this.sendPart(session, partNumber, chunk);
          byNumber.set(partNumber, { PartNumber: partNumber, ETag: etag });

          this.completedBytes += this.sizeOfPart(partNumber, totalParts, partSize, file.size);
          this.partProgress.delete(partNumber);
          this.report();

          // Persist after every part: a reload now costs at most one part.
          void updateSessionParts(
            session.id,
            Array.from(byNumber.values()).sort((a, b) => a.PartNumber - b.PartNumber)
          );
        } catch (err) {
          this.partProgress.delete(partNumber);
          failure = err;
          this.abortInFlight();
          return;
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));

    if (failure) throw failure;
    this.throwIfCancelled();
  }

  private async sendPart(
    session: PersistedUpload,
    partNumber: number,
    chunk: Blob
  ): Promise<string> {
    let lastError: unknown;

    for (let attempt = 0; attempt < PART_ATTEMPTS; attempt++) {
      try {
        // A fresh signature per attempt, so an expired part URL heals itself.
        const partRes = await api.post("/uploads/multipart/part", {
          key: session.key,
          uploadId: session.uploadId,
          partNumber,
        });
        const { url } = partRes.data as { url: string };

        const xhr = await xhrSend(
          url,
          chunk,
          {},
          (loaded) => {
            this.partProgress.set(partNumber, loaded);
            this.report();
          },
          (x) => {
            if (x) this.inFlight.add(x);
          }
        );

        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          throw new Error(
            "The bucket did not expose an ETag. Add ExposeHeaders: ETag to its CORS rule."
          );
        }
        return etag;
      } catch (err) {
        this.partProgress.delete(partNumber);

        // A pause aborts in-flight requests; that is not a failure, so wait for
        // resume and retry the same part without consuming an attempt.
        if (err instanceof UploadCancelledError && this.paused && !this.cancelled) {
          await this.waitWhilePaused();
          attempt--;
          continue;
        }
        if (err instanceof UploadCancelledError) throw err;

        // Never burn retries on an error that cannot succeed on a second try.
        if (err instanceof HttpUploadError && !err.retryable) throw err;

        lastError = err;
        if (attempt < PART_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, backoffDelay(attempt)));
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Part ${partNumber} failed after ${PART_ATTEMPTS} attempts`);
  }

  /**
   * The server confirms the object actually landed before the key is allowed
   * anywhere near Mongo, and hands back a short-lived URL for the form preview.
   */
  private async confirm(key: string): Promise<UploadResult> {
    const res = await api.post("/uploads/complete", { key }).catch((err) => {
      throw new Error(apiErrorMessage(err, "Could not confirm the upload"));
    });
    const data = res.data as {
      key: string;
      size: number;
      previewUrl: string;
      contentType?: string;
    };
    this.phase("done");
    return {
      key: data.key,
      size: data.size,
      previewUrl: data.previewUrl,
      contentType: data.contentType,
    };
  }
}

export function startUpload(options: UploadOptions): UploadController {
  const upload = new Upload(options);
  return {
    id: upload.id,
    done: upload.done,
    pause: () => upload.pause(),
    resume: () => upload.resume(),
    cancel: () => upload.cancel(),
  };
}

/**
 * Deletes an already-uploaded blob.
 *
 * This existed before and was never called from anywhere, so replacing a poster
 * before saving the form left the first one in the bucket with nothing pointing
 * at it. The upload manager now calls it on every replace and discard.
 */
export async function deleteUpload(key: string): Promise<void> {
  await api.delete(`/uploads/${key}`);
}
