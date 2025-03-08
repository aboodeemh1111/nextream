'use client';

import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import FileUpload from '@/components/FileUpload';

export default function TestUploadPage() {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');

  const handleImageUpload = (url: string) => {
    setImageUrl(url);
  };

  const handleVideoUpload = (url: string) => {
    setVideoUrl(url);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Test Firebase Upload</h1>
        <p className="mb-6 text-gray-600">
          This page is for testing Firebase Storage uploads. Try uploading an image and a video to verify that the Firebase integration is working correctly.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Image Upload Test</h2>
            <FileUpload
              label="Upload an image"
              onFileUpload={handleImageUpload}
              accept="image/*"
              folder="test-images"
            />

            {imageUrl && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Uploaded Image</h3>
                <div className="relative h-48 bg-gray-100 rounded-md overflow-hidden">
                  <img src={imageUrl} alt="Uploaded" className="object-contain w-full h-full" />
                </div>
                <p className="mt-2 text-sm text-gray-500 break-all">{imageUrl}</p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Video Upload Test</h2>
            <FileUpload
              label="Upload a video"
              onFileUpload={handleVideoUpload}
              accept="video/*"
              folder="test-videos"
            />

            {videoUrl && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Uploaded Video</h3>
                <div className="relative h-48 bg-gray-100 rounded-md overflow-hidden flex items-center justify-center">
                  <a 
                    href={videoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View uploaded video
                  </a>
                </div>
                <p className="mt-2 text-sm text-gray-500 break-all">{videoUrl}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Firebase Configuration</h2>
          <p className="mb-4 text-gray-600">
            The application is configured to use Firebase Storage for file uploads. The configuration is stored in <code>src/lib/firebase.ts</code>.
          </p>
          <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto">
            {`// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB91ogaobBfR_bflbdUjr8J_hHBkI7G_JI",
  authDomain: "onstream-6a46b.firebaseapp.com",
  projectId: "onstream-6a46b",
  storageBucket: "onstream-6a46b.appspot.com",
  messagingSenderId: "635674662728",
  appId: "1:635674662728:web:603b0f17a1e43fd096457d",
  measurementId: "G-Y6J312X406",
};`}
          </pre>
        </div>
      </div>
    </AdminLayout>
  );
} 