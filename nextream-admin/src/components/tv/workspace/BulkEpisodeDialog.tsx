"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FaFileVideo, FaFolderOpen, FaTrashAlt } from "react-icons/fa";
import { Button, Dialog, IconButton, Input, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";
import { VIDEO_ACCEPT } from "@/lib/mediaAccept";
import { parseEpisodeFilename, type Season } from "@/lib/tvApi";

export interface BulkRow {
  file: File;
  episodeNumber: string;
  title: string;
}

/**
 * Turns a folder of episode files into episodes.
 *
 * Adding ten episodes previously meant ten trips through a form, each with its
 * own single-file upload that blocked the page it lived on. Numbering is taken
 * from the filename when it is there — "Show.S02E07.mkv" already says which
 * episode it is.
 */
export function BulkEpisodeDialog({
  open,
  season,
  existingNumbers,
  onClose,
  onSubmit,
}: {
  open: boolean;
  season: Season | null;
  existingNumbers: number[];
  onClose: () => void;
  onSubmit: (rows: BulkRow[], publish: boolean) => Promise<void>;
}) {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [publish, setPublish] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setRows([]);
      setPublish(false);
      setBusy(false);
    }
  }, [open]);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;

    // Filenames sort the way an editor expects; the picker order does not.
    const incoming = Array.from(files).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

    setRows((prev) => {
      const taken = new Set<number>([
        ...existingNumbers,
        ...prev.map((row) => Number(row.episodeNumber)).filter(Number.isFinite),
      ]);

      const next = incoming.map((file) => {
        const parsed = parseEpisodeFilename(file.name);
        let number = parsed.episodeNumber;
        if (number == null || taken.has(number)) {
          number = 1;
          while (taken.has(number)) number++;
        }
        taken.add(number);
        return {
          file,
          episodeNumber: String(number),
          title: parsed.title,
        };
      });

      return [...prev, ...next];
    });
  };

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    rows.forEach((row) => seen.set(row.episodeNumber, (seen.get(row.episodeNumber) ?? 0) + 1));
    return new Set(
      [...seen.entries()].filter(([, count]) => count > 1).map(([number]) => number)
    );
  }, [rows]);

  const clashes = useMemo(
    () => new Set(rows.map((row) => Number(row.episodeNumber)).filter((n) => existingNumbers.includes(n))),
    [rows, existingNumbers]
  );

  const blocked = rows.length === 0 || duplicates.size > 0 || clashes.size > 0;

  const submit = async () => {
    setBusy(true);
    await onSubmit(rows, publish);
    setBusy(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={season ? `Add episodes to season ${season.seasonNumber}` : "Add episodes"}
      description="Episodes are created first, then their videos upload in the background."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={blocked}>
            Create {rows.length || ""} episode{rows.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex w-full flex-col items-center gap-1.5 rounded-control border-2 border-dashed px-4 py-8",
            "transition-colors duration-150",
            dragOver
              ? "border-primary bg-primary-soft/40"
              : "border-border hover:border-border-strong hover:bg-surface-2"
          )}
        >
          <FaFolderOpen className="text-xl text-muted-foreground" aria-hidden />
          <span className="text-sm text-foreground">Drop episode files, or browse</span>
          <span className="text-xs text-muted-foreground">
            S02E07 and 2x07 in filenames are read automatically
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={VIDEO_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {rows.length > 0 && (
          <>
            <ul className="space-y-2">
              {rows.map((row, index) => {
                const number = Number(row.episodeNumber);
                const conflict =
                  duplicates.has(row.episodeNumber) || existingNumbers.includes(number);

                return (
                  <li
                    key={`${row.file.name}-${index}`}
                    className="flex items-end gap-2 rounded-control border border-border bg-surface-2/50 p-2.5"
                  >
                    <Input
                      label={index === 0 ? "No." : undefined}
                      aria-label={`Episode number for ${row.file.name}`}
                      containerClassName="w-20"
                      className={cn(conflict && "border-danger")}
                      inputMode="numeric"
                      value={row.episodeNumber}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === index ? { ...r, episodeNumber: e.target.value } : r
                          )
                        )
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <Input
                        label={index === 0 ? "Title" : undefined}
                        aria-label={`Title for ${row.file.name}`}
                        value={row.title}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r, i) => (i === index ? { ...r, title: e.target.value } : r))
                          )
                        }
                      />
                      <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <FaFileVideo className="shrink-0" aria-hidden />
                        <span className="truncate">{row.file.name}</span>
                        <span className="shrink-0">· {formatBytes(row.file.size)}</span>
                      </p>
                    </div>
                    <IconButton
                      label={`Remove ${row.file.name}`}
                      variant="ghost"
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <FaTrashAlt />
                    </IconButton>
                  </li>
                );
              })}
            </ul>

            {(duplicates.size > 0 || clashes.size > 0) && (
              <div
                role="alert"
                className="rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground"
              >
                {duplicates.size > 0 &&
                  `Episode number ${[...duplicates].join(", ")} is used twice in this list. `}
                {clashes.size > 0 &&
                  `Episode ${[...clashes].join(", ")} already exists in this season.`}
              </div>
            )}

            <Switch
              checked={publish}
              onChange={setPublish}
              label="Publish on creation"
              description="Leave off to review each episode before it goes live."
            />
          </>
        )}
      </div>
    </Dialog>
  );
}
