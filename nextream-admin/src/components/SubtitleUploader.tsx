"use client";

import { useState } from "react";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

type Props = {
  storagePathBuilder: (file: File) => string;
  initialUrl?: string;
  onUploaded: (url: string) => void;
  onError?: (err: Error) => void;
};

export default function SubtitleUploader({ storagePathBuilder, initialUrl, onUploaded, onError }: Props) {
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState(initialUrl || "");
  const [error, setError] = useState<string | null>(null);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const s = getStorage();
      const r = ref(s, storagePathBuilder(file));
      const task = uploadBytesResumable(r, file, { contentType: 'text/vtt' });
      task.on('state_changed',
        (snap) => setProgress(Math.round((snap.bytesTransferred * 100) / snap.totalBytes)),
        (err) => { setError(err.message); onError?.(err as Error); },
        async () => {
          const u = await getDownloadURL(task.snapshot.ref);
          setUrl(u); onUploaded(u);
        }
      );
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
      onError?.(e);
    }
  };

  return (
    <div>
      <input type="file" accept="text/vtt,.vtt" onChange={onChange} />
      {progress > 0 && progress < 100 && (
        <div className="text-xs text-gray-300 mt-1">Uploading: {progress}%</div>
      )}
      {url && <div className="text-xs text-green-400 break-all mt-1">Uploaded: {url}</div>}
      {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
    </div>
  );
}


