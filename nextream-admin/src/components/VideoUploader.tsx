"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

type Props = {
  storagePathBuilder: (file: File) => string;
  initialUrl?: string;
  onUploaded: (url: string) => void;
  onError?: (err: Error) => void;
  accept?: string;
  maxSizeMb?: number;
};

export default function VideoUploader({ storagePathBuilder, initialUrl, onUploaded, onError, accept = "video/*", maxSizeMb = 2048 }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle"|"uploading"|"paused"|"done"|"error">(initialUrl ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState(initialUrl || "");
  const [speed, setSpeed] = useState(0); // bytes/sec
  const [eta, setEta] = useState<number | null>(null);
  const taskRef = useRef<ReturnType<typeof uploadBytesResumable> | null>(null);
  const lastSnapRef = useRef<{ time: number; bytes: number } | null>(null);

  useEffect(() => { setUrl(initialUrl || ""); }, [initialUrl]);

  const onFile = async (file: File) => {
    try {
      setError(null);
      if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
        throw new Error(`File is too large. Max ${maxSizeMb} MB`);
      }
      const storage = getStorage();
      const path = storagePathBuilder(file);
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
      taskRef.current = task;
      setStatus("uploading");
      setProgress(0);
      setSpeed(0);
      setEta(null);
      lastSnapRef.current = null;

      task.on("state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred * 100) / snap.totalBytes);
          setProgress(pct);
          const now = Date.now();
          const last = lastSnapRef.current;
          if (last) {
            const deltaBytes = snap.bytesTransferred - last.bytes;
            const deltaTime = (now - last.time) / 1000;
            if (deltaTime > 0) {
              const bps = deltaBytes / deltaTime;
              setSpeed(bps);
              const remaining = snap.totalBytes - snap.bytesTransferred;
              setEta(bps > 0 ? Math.ceil(remaining / bps) : null);
            }
          }
          lastSnapRef.current = { time: now, bytes: snap.bytesTransferred };
        },
        (err) => {
          setStatus("error");
          setError(err.message);
          onError?.(err as Error);
        },
        async () => {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          setUrl(downloadUrl);
          setStatus("done");
          setProgress(100);
          setSpeed(0);
          setEta(null);
          onUploaded(downloadUrl);
        }
      );
    } catch (e: any) {
      setStatus("error");
      const msg = e?.message || "Upload failed";
      setError(msg);
      onError?.(e);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  const pause = () => {
    try { taskRef.current?.pause(); setStatus("paused"); } catch {}
  };
  const resume = () => {
    try { taskRef.current?.resume(); setStatus("uploading"); } catch {}
  };
  const cancel = () => {
    try { taskRef.current?.cancel(); setStatus("idle"); setProgress(0); setSpeed(0); setEta(null); } catch {}
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const prettySpeed = useMemo(() => {
    if (!speed) return "";
    const mbps = speed / (1024 * 1024);
    return `${mbps.toFixed(2)} MB/s`;
  }, [speed]);

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded p-4 text-center ${dragOver ? 'border-red-500 bg-red-500/10' : 'border-white/20'}`}
      >
        <div className="text-sm text-gray-300">Drag & drop a video file here, or click to choose</div>
        <input type="file" accept={accept} onChange={onInputChange} className="mt-2" />
      </div>

      {status !== 'idle' && (
        <div className="mt-3 text-sm">
          <div className="w-full bg-white/10 rounded h-2 overflow-hidden">
            <div className="bg-red-600 h-2" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1 text-gray-300">
            <span>{progress}% {prettySpeed && `• ${prettySpeed}`}{eta != null && ` • ETA ${eta}s`}</span>
            <div className="flex gap-2">
              {status === 'uploading' && <button className="px-2 py-0.5 bg-gray-800 rounded" onClick={pause}>Pause</button>}
              {status === 'paused' && <button className="px-2 py-0.5 bg-gray-800 rounded" onClick={resume}>Resume</button>}
              {(status === 'uploading' || status === 'paused') && <button className="px-2 py-0.5 bg-gray-800 rounded" onClick={cancel}>Cancel</button>}
            </div>
          </div>
        </div>
      )}

      {url && status === 'done' && (
        <div className="mt-2 text-green-400 break-all text-xs">Uploaded: {url}</div>
      )}
      {error && (
        <div className="mt-2 text-red-400 text-xs">{error}</div>
      )}
    </div>
  );
}


