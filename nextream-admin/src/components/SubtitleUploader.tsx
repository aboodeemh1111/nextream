"use client";

import { useEffect, useState } from "react";
import useUpload from "@/hooks/useUpload";

type Props = {
  /** Existing subtitle for this field, already signed by the API. */
  initialUrl?: string;
  /** Receives the storage *key* to submit, plus a short-lived preview URL. */
  onUploaded: (key: string, previewUrl: string) => void;
  onError?: (err: Error) => void;
};

export default function SubtitleUploader({ initialUrl, onUploaded, onError }: Props) {
  const [existingUrl, setExistingUrl] = useState(initialUrl || "");

  // Browsers usually report an empty type for .vtt, so pin it explicitly.
  const { progress, status, error, previewUrl, start } = useUpload({
    prefix: "subs",
    contentType: "text/vtt",
    maxSizeMb: 5,
    onUploaded,
    onError,
  });

  useEffect(() => {
    setExistingUrl(initialUrl || "");
  }, [initialUrl]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) start(file);
  };

  const uploaded = previewUrl || existingUrl;

  return (
    <div>
      <input type="file" accept="text/vtt,.vtt" onChange={onChange} />
      {status === 'uploading' && (
        <div className="text-xs text-muted-foreground mt-1">Uploading: {progress}%</div>
      )}
      {uploaded && status !== 'uploading' && (
        <div className="text-xs text-green-400 mt-1">Subtitle uploaded</div>
      )}
      {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
    </div>
  );
}
