"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaCloudUploadAlt,
  FaExclamationTriangle,
  FaPause,
  FaPlay,
  FaTimes,
  FaTrashAlt,
} from "react-icons/fa";
import { cn } from "@/lib/cn";
import { formatBitrate, formatBytes, formatEta } from "@/lib/format";
import { IMAGE_ACCEPT, VIDEO_ACCEPT } from "@/lib/mediaAccept";
import { mediaFileName } from "@/lib/media";
import { fetchUploadPolicy, maxBytesFor, type UploadPrefix } from "@/lib/uploadClient";
import { Button, Field, IconButton, Progress } from "@/components/ui";
import { useUploads } from "./UploadProvider";
import { MediaPreview, type MediaAspect, type MediaKind } from "./MediaPreview";

const ACCEPT: Record<MediaKind, string> = {
  image: IMAGE_ACCEPT,
  video: VIDEO_ACCEPT,
  subtitle: "text/vtt,.vtt",
};

/** Guidance shown under the drop zone, per field shape. */
const ASPECT_HINT: Record<MediaAspect, string> = {
  poster: "Portrait artwork, 2:3 (e.g. 600×900)",
  wide: "Landscape artwork, 16:9 (e.g. 1920×1080)",
  square: "Square artwork, 1:1",
};

export interface MediaFieldProps {
  /** Stable address, e.g. "show:123:poster" — see UploadProvider. */
  fieldId: string;
  label: string;
  prefix: UploadPrefix;
  kind: MediaKind;
  aspect?: MediaAspect;
  /** The storage key held by the form. */
  value: string;
  /** Signed URL for `value`, as returned by the API. */
  previewUrl?: string;
  onChange: (key: string, previewUrl: string) => void;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * One media field: drop zone, preview, progress, replace and remove.
 *
 * Replaces three components that behaved differently (VideoUploader, FileUpload
 * and SubtitleUploader) and one that lied about its type — the "Url" props all
 * held storage keys, so a key ended up in an <img src> whenever the component
 * remounted and lost its signed preview.
 */
export function MediaField({
  fieldId,
  label,
  prefix,
  kind,
  aspect = kind === "image" ? "wide" : "wide",
  value,
  previewUrl,
  onChange,
  hint,
  required,
  disabled,
  className,
}: MediaFieldProps) {
  const { enqueue, itemForField, pause, resume, cancel, trash } = useUploads();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [maxBytes, setMaxBytes] = useState<number | null>(null);

  /** Preview for a key uploaded in this session; `value` alone is not a URL. */
  const [uploadedPreview, setUploadedPreview] = useState<string>("");
  /** Keys this field uploaded but has not saved — safe to delete on replace. */
  const unsavedKeys = useRef(new Set<string>());
  const appliedResult = useRef<string | null>(null);

  const item = itemForField(fieldId);

  useEffect(() => {
    let active = true;
    fetchUploadPolicy().then((policy) => {
      if (active) setMaxBytes(maxBytesFor(policy, prefix));
    });
    return () => {
      active = false;
    };
  }, [prefix]);

  // Adopt whatever the provider finished for this field. Because uploads live
  // above the router, this also picks up a transfer that completed while the
  // admin was on another page.
  useEffect(() => {
    if (item?.status !== "done" || !item.result) return;
    if (appliedResult.current === item.result.key) return;

    appliedResult.current = item.result.key;
    unsavedKeys.current.add(item.result.key);
    setUploadedPreview(item.result.previewUrl);
    setLocalError(null);
    onChange(item.result.key, item.result.previewUrl);
  }, [item, onChange]);

  const accept = ACCEPT[kind];
  const displayUrl = uploadedPreview || previewUrl || "";

  const acceptFile = useCallback(
    (file: File) => {
      setLocalError(null);

      if (maxBytes !== null && file.size > maxBytes) {
        setLocalError(
          `${formatBytes(file.size)} is over the ${formatBytes(maxBytes)} limit for ${label.toLowerCase()}.`
        );
        return;
      }

      // The previous value was uploaded here and never saved, so nothing else
      // references it — delete it now instead of leaking it into the bucket.
      if (value && unsavedKeys.current.has(value)) {
        unsavedKeys.current.delete(value);
        void trash(value);
      }

      enqueue({ file, prefix, fieldId, label });
    },
    [enqueue, fieldId, label, maxBytes, prefix, trash, value]
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  };

  const remove = () => {
    if (value && unsavedKeys.current.has(value)) {
      unsavedKeys.current.delete(value);
      void trash(value);
    }
    appliedResult.current = null;
    setUploadedPreview("");
    setLocalError(null);
    onChange("", "");
  };

  const busy =
    item?.status === "uploading" ||
    item?.status === "queued" ||
    item?.status === "paused";

  const error = localError ?? (item?.status === "error" ? item.error : null);

  const hintText = useMemo(() => {
    const parts = [hint ?? (kind === "image" ? ASPECT_HINT[aspect] : undefined)];
    if (maxBytes !== null) parts.push(`Max ${formatBytes(maxBytes)}`);
    return parts.filter(Boolean).join(" · ");
  }, [hint, kind, aspect, maxBytes]);

  return (
    <Field label={label} required={required} error={error} className={className}>
      <div className="flex gap-3">
        <div className={cn("shrink-0", aspect === "poster" ? "w-24" : "w-36")}>
          <MediaPreview url={displayUrl} kind={kind} aspect={aspect} alt={label} />
        </div>

        <div className="min-w-0 flex-1">
          {busy && item ? (
            <div className="rounded-control border border-border bg-surface-2 p-3">
              <p className="truncate text-sm text-foreground" title={item.fileName}>
                {item.fileName}
              </p>
              <Progress
                value={item.progress}
                tone={item.status === "paused" ? "muted" : "primary"}
                className="mt-2"
                label={`${label} upload progress`}
              />
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.status === "queued"
                    ? "Waiting for a slot…"
                    : item.status === "paused"
                    ? `Paused at ${item.progress}%`
                    : item.phase === "finalizing"
                    ? "Finishing…"
                    : `${item.progress}% · ${formatBytes(item.loaded)} of ${formatBytes(
                        item.fileSize
                      )}${item.speed ? ` · ${formatBitrate(item.speed)}` : ""}${
                        item.eta ? ` · ${formatEta(item.eta)}` : ""
                      }`}
                </span>
                <span className="flex items-center gap-0.5 shrink-0">
                  {item.status === "uploading" && (
                    <IconButton
                      label="Pause upload"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7"
                      onClick={() => pause(item.id)}
                    >
                      <FaPause className="text-xs" />
                    </IconButton>
                  )}
                  {item.status === "paused" && (
                    <IconButton
                      label="Resume upload"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7"
                      onClick={() => resume(item.id)}
                    >
                      <FaPlay className="text-xs" />
                    </IconButton>
                  )}
                  <IconButton
                    label="Cancel upload"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7"
                    onClick={() => cancel(item.id)}
                  >
                    <FaTimes className="text-xs" />
                  </IconButton>
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* A button, not a bare div: the old drop zone told users to
                  "click to choose" but only the nested file input responded,
                  and nothing was reachable by keyboard. */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!disabled) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-1",
                  "rounded-control border-2 border-dashed px-4 py-5 text-center",
                  "transition-colors duration-150",
                  dragOver
                    ? "border-primary bg-primary-soft/40"
                    : "border-border hover:border-border-strong hover:bg-surface-2",
                  disabled && "opacity-60 cursor-not-allowed"
                )}
              >
                <FaCloudUploadAlt className="text-lg text-muted-foreground" aria-hidden />
                <span className="text-sm text-foreground">
                  {value ? "Replace file" : "Drop a file or browse"}
                </span>
                {hintText && (
                  <span className="text-xs text-muted-foreground">{hintText}</span>
                )}
              </button>

              <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="sr-only"
                disabled={disabled}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) acceptFile(file);
                  // Allow re-picking the same file after a failure.
                  e.target.value = "";
                }}
              />

              {value && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground" title={value}>
                    {mediaFileName(value)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<FaTrashAlt />}
                    onClick={remove}
                    disabled={disabled}
                  >
                    Remove
                  </Button>
                </div>
              )}

              {item?.status === "needs-file" && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                  <FaExclamationTriangle className="mt-0.5 shrink-0" aria-hidden />
                  An interrupted upload for this field can be resumed from the
                  upload tray.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Field>
  );
}
