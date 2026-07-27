"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  startUpload,
  UploadCancelledError,
  type UploadController,
  type UploadPrefix,
} from "@/lib/uploadClient";

// Exposes exactly the state the three uploader components already render, so
// their JSX stays as-is: progress, speed, ETA, status, error.

export type UploadStatus = "idle" | "uploading" | "paused" | "done" | "error";

export interface UseUploadOptions {
  prefix: UploadPrefix;
  contentType?: string;
  maxSizeMb?: number;
  onUploaded?: (key: string, previewUrl: string) => void;
  onError?: (err: Error) => void;
}

export interface UseUploadState {
  progress: number;
  speed: number;
  eta: number | null;
  status: UploadStatus;
  error: string | null;
  key: string;
  previewUrl: string;
  start: (file: File) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  reset: () => void;
}

export function useUpload(options: UseUploadOptions): UseUploadState {
  const { prefix, contentType, maxSizeMb, onUploaded, onError } = options;

  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const controllerRef = useRef<UploadController | null>(null);
  const lastSnapRef = useRef<{ time: number; bytes: number } | null>(null);
  const mountedRef = useRef(true);

  // Keep the callbacks current without making start() change identity.
  const onUploadedRef = useRef(onUploaded);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Abandoning the page mid-upload must not leave a dangling multipart.
      controllerRef.current?.cancel();
      controllerRef.current = null;
    };
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.cancel();
    controllerRef.current = null;
    lastSnapRef.current = null;
    setProgress(0);
    setSpeed(0);
    setEta(null);
    setStatus("idle");
    setError(null);
    setKey("");
    setPreviewUrl("");
  }, []);

  const start = useCallback(
    (file: File) => {
      if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
        const err = new Error(`File is too large. Max ${maxSizeMb} MB`);
        setStatus("error");
        setError(err.message);
        onErrorRef.current?.(err);
        return;
      }

      controllerRef.current?.cancel();
      lastSnapRef.current = null;
      setStatus("uploading");
      setError(null);
      setProgress(0);
      setSpeed(0);
      setEta(null);
      setKey("");
      setPreviewUrl("");

      const controller = startUpload({
        file,
        prefix,
        contentType,
        onProgress: (loaded, total) => {
          if (!mountedRef.current) return;
          setProgress(total ? Math.round((loaded * 100) / total) : 0);

          const now = Date.now();
          const last = lastSnapRef.current;
          if (last) {
            const deltaBytes = loaded - last.bytes;
            const deltaTime = (now - last.time) / 1000;
            // Sample about once a second so the readout does not jitter.
            if (deltaTime >= 0.5 && deltaBytes >= 0) {
              const bps = deltaBytes / deltaTime;
              setSpeed(bps);
              setEta(bps > 0 ? Math.ceil((total - loaded) / bps) : null);
              lastSnapRef.current = { time: now, bytes: loaded };
            }
          } else {
            lastSnapRef.current = { time: now, bytes: loaded };
          }
        },
      });
      controllerRef.current = controller;

      controller.done
        .then((result) => {
          if (!mountedRef.current) return;
          controllerRef.current = null;
          setKey(result.key);
          setPreviewUrl(result.previewUrl);
          setProgress(100);
          setSpeed(0);
          setEta(null);
          setStatus("done");
          onUploadedRef.current?.(result.key, result.previewUrl);
        })
        .catch((err: unknown) => {
          if (!mountedRef.current) return;
          controllerRef.current = null;
          if (err instanceof UploadCancelledError) {
            setStatus("idle");
            setProgress(0);
            setSpeed(0);
            setEta(null);
            return;
          }
          const e = err instanceof Error ? err : new Error("Upload failed");
          setStatus("error");
          setError(e.message);
          setSpeed(0);
          setEta(null);
          onErrorRef.current?.(e);
        });
    },
    [prefix, contentType, maxSizeMb]
  );

  const pause = useCallback(() => {
    controllerRef.current?.pause();
    lastSnapRef.current = null;
    setSpeed(0);
    setEta(null);
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    controllerRef.current?.resume();
    lastSnapRef.current = null;
    setStatus("uploading");
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.cancel();
    controllerRef.current = null;
    lastSnapRef.current = null;
    setStatus("idle");
    setProgress(0);
    setSpeed(0);
    setEta(null);
  }, []);

  return {
    progress,
    speed,
    eta,
    status,
    error,
    key,
    previewUrl,
    start,
    pause,
    resume,
    cancel,
    reset,
  };
}

export default useUpload;
