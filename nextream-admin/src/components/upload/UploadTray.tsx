"use client";

import { useRef, useState } from "react";
import {
  FaChevronDown,
  FaChevronUp,
  FaExclamationTriangle,
  FaFolderOpen,
  FaPause,
  FaPlay,
  FaRedo,
  FaTimes,
  FaCheck,
} from "react-icons/fa";
import { cn } from "@/lib/cn";
import { formatBitrate, formatBytes, formatEta } from "@/lib/format";
import { Button, IconButton, Progress } from "@/components/ui";
import { useUploads, type UploadItem } from "./UploadProvider";

/**
 * App-wide upload tray.
 *
 * Uploads used to be trapped inside the form field that started them: leaving
 * the page cancelled the transfer, and nothing in the UI told you an upload was
 * running. Rendered from the root layout, this stays put across navigation.
 */
export function UploadTray() {
  const { items, activeCount, pause, resume, cancel, retry, dismiss, clearFinished } =
    useUploads();
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  const finished = items.filter((item) => item.status === "done").length;
  const failed = items.filter((item) => item.status === "error").length;
  const waiting = items.filter((item) => item.status === "needs-file").length;

  const summary = activeCount
    ? `Uploading ${activeCount} file${activeCount === 1 ? "" : "s"}`
    : failed
    ? `${failed} upload${failed === 1 ? "" : "s"} failed`
    : waiting
    ? `${waiting} upload${waiting === 1 ? "" : "s"} can be resumed`
    : `${finished} upload${finished === 1 ? "" : "s"} complete`;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-40 w-[min(24rem,calc(100vw-2rem))]",
        "rounded-card border border-border bg-popover shadow-overlay",
        "animate-in-up"
      )}
      role="region"
      aria-label="Uploads"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span className="flex-1 text-sm font-medium text-foreground truncate">
          {summary}
        </span>
        {(finished > 0 || failed > 0) && (
          <Button variant="ghost" size="sm" onClick={clearFinished}>
            Clear
          </Button>
        )}
        <IconButton
          label={collapsed ? "Expand uploads" : "Collapse uploads"}
          variant="ghost"
          size="sm"
          className="h-7 w-7"
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? <FaChevronUp /> : <FaChevronDown />}
        </IconButton>
      </div>

      {!collapsed && (
        <ul className="max-h-80 overflow-y-auto scroll-y divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="px-3 py-2.5">
              <UploadRow
                item={item}
                onPause={() => pause(item.id)}
                onResume={() => resume(item.id)}
                onCancel={() => cancel(item.id)}
                onRetry={() => retry(item.id)}
                onDismiss={() => dismiss(item.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UploadRow({
  item,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onDismiss,
}: {
  item: UploadItem;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const { resumeWithFile } = useUploads();
  const fileInput = useRef<HTMLInputElement>(null);

  const tone =
    item.status === "error"
      ? "danger"
      : item.status === "done"
      ? "success"
      : item.status === "paused" || item.status === "needs-file"
      ? "muted"
      : "primary";

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground" title={item.fileName}>
            {item.fileName}
          </span>
          {item.label && (
            <span className="block truncate text-xs text-muted-foreground">
              {item.label}
            </span>
          )}
        </span>

        <span className="flex items-center gap-0.5 shrink-0">
          {item.status === "uploading" && (
            <IconButton label="Pause upload" variant="ghost" size="sm" className="h-7 w-7" onClick={onPause}>
              <FaPause className="text-xs" />
            </IconButton>
          )}
          {item.status === "paused" && (
            <IconButton label="Resume upload" variant="ghost" size="sm" className="h-7 w-7" onClick={onResume}>
              <FaPlay className="text-xs" />
            </IconButton>
          )}
          {item.status === "error" && (
            <IconButton label="Retry upload" variant="ghost" size="sm" className="h-7 w-7" onClick={onRetry}>
              <FaRedo className="text-xs" />
            </IconButton>
          )}
          {item.status === "done" ? (
            <IconButton label="Dismiss" variant="ghost" size="sm" className="h-7 w-7" onClick={onDismiss}>
              <FaTimes className="text-xs" />
            </IconButton>
          ) : (
            <IconButton
              label="Cancel upload"
              variant="ghost"
              size="sm"
              className="h-7 w-7"
              onClick={item.status === "needs-file" ? onDismiss : onCancel}
            >
              <FaTimes className="text-xs" />
            </IconButton>
          )}
        </span>
      </div>

      {item.status === "done" ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-success">
          <FaCheck className="text-[10px]" aria-hidden />
          Uploaded · {formatBytes(item.fileSize)}
        </p>
      ) : item.status === "error" ? (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-danger">
          <FaExclamationTriangle className="mt-0.5 shrink-0 text-[10px]" aria-hidden />
          <span className="break-words">{item.error}</span>
        </p>
      ) : item.status === "needs-file" ? (
        <div className="mt-1.5">
          <p className="text-xs text-muted-foreground">
            Interrupted at {item.progress}% · re-select{" "}
            <span className="text-foreground">{item.fileName}</span> to continue
            where it stopped.
          </p>
          <input
            ref={fileInput}
            type="file"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) resumeWithFile(item.id, file);
              e.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            icon={<FaFolderOpen />}
            onClick={() => fileInput.current?.click()}
          >
            Choose file
          </Button>
        </div>
      ) : (
        <>
          <Progress
            value={item.progress}
            tone={tone}
            className="mt-2"
            label={`${item.fileName} upload progress`}
          />
          <p className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
            <span>
              {item.progress}% · {formatBytes(item.loaded)} of {formatBytes(item.fileSize)}
            </span>
            <span>
              {item.status === "paused"
                ? "Paused"
                : item.status === "queued"
                ? "Queued"
                : item.phase === "finalizing"
                ? "Finishing…"
                : [formatBitrate(item.speed), formatEta(item.eta)]
                    .filter(Boolean)
                    .join(" · ")}
            </span>
          </p>
        </>
      )}
    </div>
  );
}
