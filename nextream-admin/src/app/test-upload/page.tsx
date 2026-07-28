'use client';

import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import FileUpload from '@/components/FileUpload';
import { IMAGE_ACCEPT, VIDEO_ACCEPT } from '@/lib/mediaAccept';

export default function TestUploadPage() {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');

  // The uploaders hand back the storage key plus a short-lived preview URL.
  // Only the key is ever submitted to the API; the URL is for display.
  const [imageKey, setImageKey] = useState<string>('');
  const [videoKey, setVideoKey] = useState<string>('');

  const handleImageUpload = (key: string, previewUrl: string) => {
    setImageKey(key);
    setImageUrl(previewUrl);
  };

  const handleVideoUpload = (key: string, previewUrl: string) => {
    setVideoKey(key);
    setVideoUrl(previewUrl);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Test Bucket Upload</h1>
        <p className="mb-6 text-muted-foreground">
          This page exercises the self-hosted bucket end to end: the API signs an upload URL, the browser PUTs straight at the bucket, and the API confirms the object landed before returning a key.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Image Upload Test</h2>
            <FileUpload
              label="Upload an image"
              onFileUpload={handleImageUpload}
              accept={IMAGE_ACCEPT}
              prefix="images"
            />

            {imageUrl && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Uploaded Image</h3>
                <div className="relative h-48 bg-background rounded-md overflow-hidden">
                  <img src={imageUrl} alt="Uploaded" className="object-contain w-full h-full" />
                </div>
                <p className="mt-2 text-sm text-muted-foreground break-all">Key: {imageKey}</p>
              </div>
            )}
          </div>

          <div className="bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Video Upload Test</h2>
            <FileUpload
              label="Upload a video"
              onFileUpload={handleVideoUpload}
              accept={VIDEO_ACCEPT}
              prefix="videos"
            />

            {videoUrl && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Uploaded Video</h3>
                <div className="relative h-48 bg-background rounded-md overflow-hidden flex items-center justify-center">
                  <a 
                    href={videoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View uploaded video
                  </a>
                </div>
                <p className="mt-2 text-sm text-muted-foreground break-all">Key: {videoKey}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 p-6 bg-card rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">How uploads work</h2>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>The admin app asks the API to presign an upload (JWT + isAdmin).</li>
            <li>The API generates the key itself from a UUID — the client never chooses a path.</li>
            <li>The browser PUTs the bytes straight at the bucket; the API never sees the file.</li>
            <li>Files over 16 MB use multipart, which is what makes pause, resume and cancel work.</li>
            <li>Only the returned key is stored in Mongo. The API signs it into a URL on read.</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
} 