"use client";

import { useEffect, useMemo, useState } from "react";
import useUpload from "@/hooks/useUpload";
import type { UploadPrefix } from "@/lib/uploadClient";

type Props = {
  /**
   * Bucket namespace to upload into. Replaces the old storagePathBuilder prop:
   * the server now generates every key from a UUID, so the client cannot
   * choose where bytes land.
   */
  prefix: UploadPrefix;
  /** Existing media for this field, already signed by the API. */
  initialUrl?: string;
  /** Receives the storage *key* to submit, plus a short-lived preview URL. */
  onUploaded: (key: string, previewUrl: string) => void;
  onError?: (err: Error) => void;
  accept?: string;
  maxSizeMb?: number;
};

export default function VideoUploader({
  prefix,
  initialUrl,
  onUploaded,
  onError,
  accept = "video/*",
  maxSizeMb = 2048,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [existingUrl, setExistingUrl] = useState(initialUrl || "");

  const {
    progress,
    speed,
    eta,
    status,
    error,
    previewUrl,
    start,
    pause,
    resume,
    cancel,
  } = useUpload({ prefix, maxSizeMb, onUploaded, onError });

  useEffect(() => {
    setExistingUrl(initialUrl || "");
  }, [initialUrl]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) start(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) start(f);
  };

  const prettySpeed = useMemo(() => {
    if (!speed) return "";
    const mbps = speed / (1024 * 1024);
    return `${mbps.toFixed(2)} MB/s`;
  }, [speed]);

  // The forms used to preview from the uploaded URL. They now hold a key, so
  // the preview comes from the signed URL /complete hands back instead.
  const displayUrl = previewUrl || existingUrl;
  const isImageField = accept.startsWith("image/");

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded p-4 text-center ${dragOver ? 'border-red-500 bg-red-500/10' : 'border-border'}`}
      >
        <div className="text-sm text-muted-foreground">Drag & drop a file here, or click to choose</div>
        <input type="file" accept={accept} onChange={onInputChange} className="mt-2" />
      </div>

      {status !== 'idle' && (
        <div className="mt-3 text-sm">
          <div className="w-full bg-muted rounded h-2 overflow-hidden">
            <div className="bg-red-600 h-2" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1 text-muted-foreground">
            <span>{progress}% {prettySpeed && `• ${prettySpeed}`}{eta != null && ` • ETA ${eta}s`}</span>
            <div className="flex gap-2">
              {status === 'uploading' && <button type="button" className="px-2 py-0.5 bg-muted rounded" onClick={pause}>Pause</button>}
              {status === 'paused' && <button type="button" className="px-2 py-0.5 bg-muted rounded" onClick={resume}>Resume</button>}
              {(status === 'uploading' || status === 'paused') && <button type="button" className="px-2 py-0.5 bg-muted rounded" onClick={cancel}>Cancel</button>}
            </div>
          </div>
        </div>
      )}

      {displayUrl && isImageField && (
        <img src={displayUrl} alt="Upload preview" className="mt-2 w-32 rounded border border-border" />
      )}

      {status === 'done' && (
        <div className="mt-2 text-green-400 text-xs">Uploaded</div>
      )}
      {error && (
        <div className="mt-2 text-red-400 text-xs">{error}</div>
      )}
    </div>
  );
}
