import api from "@/lib/axios";
import { resolveContentType } from "@/lib/mediaAccept";

// Transport only — no React. The browser PUTs bytes straight at the bucket
// using a URL the API signed; the API never sees the file itself.
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
}

export interface UploadOptions {
  file: File;
  prefix: UploadPrefix;
  /** Overrides file.type — browsers often report "" for .vtt. */
  contentType?: string;
  onProgress?: (loaded: number, total: number) => void;
}

export interface UploadController {
  done: Promise<UploadResult>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

/** Files at or below this go up in a single PUT; larger ones use multipart. */
const SIMPLE_MAX_BYTES = 16 * 1024 * 1024;
const PART_RETRIES = 2;

export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

function apiErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.message || err?.message || fallback;
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
      else reject(new Error(`Upload failed (HTTP ${xhr.status})`));
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Network error during upload. Check the bucket's CORS configuration."
        )
      );
    xhr.onabort = () => reject(new UploadCancelledError());
    register(xhr);
    xhr.send(body);
  });
}

class Upload {
  private xhr: XMLHttpRequest | null = null;
  private paused = false;
  private cancelled = false;
  private resumeWaiters: Array<() => void> = [];
  private completedBytes = 0;
  private inFlightBytes = 0;
  private multipart: { key: string; uploadId: string } | null = null;

  readonly done: Promise<UploadResult>;

  constructor(private readonly options: UploadOptions) {
    this.done = this.run();
  }

  pause() {
    if (this.cancelled || this.paused) return;
    this.paused = true;
    // Abort the part in flight rather than letting it finish: pausing should
    // feel immediate. At most one part is re-sent on resume.
    this.xhr?.abort();
  }

  resume() {
    if (this.cancelled || !this.paused) return;
    this.paused = false;
    const waiters = this.resumeWaiters;
    this.resumeWaiters = [];
    waiters.forEach((w) => w());
  }

  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    this.paused = false;
    this.resumeWaiters.splice(0).forEach((w) => w());
    this.xhr?.abort();
    void this.abortMultipart();
  }

  private async abortMultipart() {
    if (!this.multipart) return;
    const { key, uploadId } = this.multipart;
    this.multipart = null;
    try {
      await api.post("/uploads/multipart/abort", { key, uploadId });
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
    this.options.onProgress?.(
      this.completedBytes + this.inFlightBytes,
      this.options.file.size
    );
  }

  private async run(): Promise<UploadResult> {
    const { file, prefix } = this.options;
    // Prefer an explicit override, then File.type, then extension — browsers
    // frequently omit type for webp/heic/jfif, which would otherwise become
    // application/octet-stream and get rejected by the images/ prefix policy.
    const contentType = resolveContentType(file, this.options.contentType);

    try {
      const result =
        file.size > SIMPLE_MAX_BYTES
          ? await this.runMultipart(contentType)
          : await this.runSimple(contentType);
      return result;
    } catch (err) {
      if (!(err instanceof UploadCancelledError)) {
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

    // headers come from the server and are covered by the signature — sending
    // anything else fails the signature check.
    await xhrSend(
      uploadUrl,
      file,
      headers,
      (loaded) => {
        this.inFlightBytes = loaded;
        this.report();
      },
      (xhr) => (this.xhr = xhr)
    );
    this.xhr = null;
    this.completedBytes = file.size;
    this.inFlightBytes = 0;
    this.report();

    return this.confirm(key);
  }

  private async runMultipart(contentType: string): Promise<UploadResult> {
    const { file, prefix } = this.options;
    this.throwIfCancelled();

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
    this.multipart = { key, uploadId };

    const totalParts = Math.max(1, Math.ceil(file.size / partSize));
    const parts: Array<{ PartNumber: number; ETag: string }> = [];

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * partSize;
      const chunk = file.slice(start, Math.min(start + partSize, file.size));

      // Pausing is simply "stop requesting new part URLs".
      await this.waitWhilePaused();
      this.throwIfCancelled();

      const etag = await this.sendPart(key, uploadId, partNumber, chunk);
      parts.push({ PartNumber: partNumber, ETag: etag });

      this.completedBytes += chunk.size;
      this.inFlightBytes = 0;
      this.report();
    }

    this.throwIfCancelled();
    const completed = await api
      .post("/uploads/multipart/complete", { key, uploadId, parts })
      .catch((err) => {
        throw new Error(apiErrorMessage(err, "Could not finish the upload"));
      });
    this.multipart = null;

    return this.confirm((completed.data as { key: string }).key);
  }

  private async sendPart(
    key: string,
    uploadId: string,
    partNumber: number,
    chunk: Blob
  ): Promise<string> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= PART_RETRIES; attempt++) {
      try {
        const partRes = await api.post("/uploads/multipart/part", {
          key,
          uploadId,
          partNumber,
        });
        const { url } = partRes.data as { url: string };

        const xhr = await xhrSend(
          url,
          chunk,
          {},
          (loaded) => {
            this.inFlightBytes = loaded;
            this.report();
          },
          (x) => (this.xhr = x)
        );
        this.xhr = null;

        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          throw new Error(
            "The bucket did not expose an ETag. Add ExposeHeaders: ETag to its CORS rule."
          );
        }
        return etag;
      } catch (err) {
        this.xhr = null;
        this.inFlightBytes = 0;
        // A pause aborts the in-flight request; that is not a failure, so wait
        // for resume and retry the same part without consuming an attempt.
        if (err instanceof UploadCancelledError && this.paused && !this.cancelled) {
          await this.waitWhilePaused();
          attempt--;
          continue;
        }
        if (err instanceof UploadCancelledError) throw err;
        lastError = err;
        if (attempt < PART_RETRIES) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Part ${partNumber} failed`);
  }

  /**
   * The server confirms the object actually landed before the key is allowed
   * anywhere near Mongo, and hands back a short-lived URL for the form preview.
   */
  private async confirm(key: string): Promise<UploadResult> {
    const res = await api.post("/uploads/complete", { key }).catch((err) => {
      throw new Error(apiErrorMessage(err, "Could not confirm the upload"));
    });
    const data = res.data as { key: string; size: number; previewUrl: string };
    return { key: data.key, size: data.size, previewUrl: data.previewUrl };
  }
}

export function startUpload(options: UploadOptions): UploadController {
  const upload = new Upload(options);
  return {
    done: upload.done,
    pause: () => upload.pause(),
    resume: () => upload.resume(),
    cancel: () => upload.cancel(),
  };
}

/** Deletes an already-uploaded blob, e.g. when the admin replaces a file. */
export async function deleteUpload(key: string): Promise<void> {
  await api.delete(`/uploads/${key}`);
}
