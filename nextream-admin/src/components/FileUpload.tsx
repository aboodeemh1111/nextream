'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import storage from '@/lib/firebase';
import { FaUpload, FaSpinner, FaCheck, FaTimes } from 'react-icons/fa';

interface FileUploadProps {
  onFileUpload: (url: string) => void;
  label: string;
  accept?: string;
  folder?: string;
  existingUrl?: string;
}

const FileUpload = ({ 
  onFileUpload, 
  label, 
  accept = 'video/*,image/*', 
  folder = 'videos',
  existingUrl = ''
}: FileUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadComplete, setUploadComplete] = useState<boolean>(false);
  const [fileUrl, setFileUrl] = useState<string>(existingUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setUploadComplete(false);
      setProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);

    // Create a unique file name
    const fileName = new Date().getTime() + '_' + file.name;
    console.log(`Starting upload to Firebase: ${folder}/${fileName}`);
    
    const storageRef = ref(storage, `${folder}/${fileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        // Track upload progress
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setProgress(progress);
        console.log(`Upload progress: ${progress}%`);
      },
      (error) => {
        // Handle errors
        console.error('Upload error:', error);
        setError('Error uploading file. Please try again.');
        setUploading(false);
      },
      async () => {
        // Upload complete
        try {
          console.log('Upload completed, getting download URL...');
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          console.log('Download URL:', downloadUrl);
          setFileUrl(downloadUrl);
          onFileUpload(downloadUrl);
          setUploadComplete(true);
          setUploading(false);
        } catch (err) {
          console.error('Error getting download URL:', err);
          setError('Error completing upload. Please try again.');
          setUploading(false);
        }
      }
    );
  };

  const resetUpload = () => {
    setFile(null);
    setProgress(0);
    setError(null);
    setUploadComplete(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      
      {fileUrl && !file && (
        <div className="mb-3">
          {fileUrl.includes('image') ? (
            <img 
              src={fileUrl} 
              alt="Uploaded file preview" 
              className="h-32 w-auto object-cover rounded-md mb-2" 
            />
          ) : (
            <div className="flex items-center text-blue-600 mb-2">
              <FaCheck className="mr-2" /> File already uploaded
            </div>
          )}
          <div className="text-xs text-gray-500 truncate mb-2">
            {fileUrl}
          </div>
          <button
            type="button"
            onClick={() => setFileUrl('')}
            className="text-red-600 text-sm hover:text-red-800"
          >
            Remove and upload new file
          </button>
        </div>
      )}
      
      {(!fileUrl || file) && (
        <>
          <div className="flex items-center space-x-3 mb-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={accept}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading || uploadComplete}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                !file || uploading || uploadComplete
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {uploading ? (
                <>
                  <FaSpinner className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Uploading...
                </>
              ) : uploadComplete ? (
                <>
                  <FaCheck className="-ml-1 mr-2 h-4 w-4" />
                  Uploaded
                </>
              ) : (
                <>
                  <FaUpload className="-ml-1 mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </button>
            
            {(file || error) && (
              <button
                type="button"
                onClick={resetUpload}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <FaTimes className="-ml-0.5 mr-2 h-4 w-4" />
                Reset
              </button>
            )}
          </div>
          
          {file && (
            <div className="text-sm text-gray-500 mb-2">
              Selected file: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
          
          {uploading && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
              <div className="text-xs text-gray-500 mt-1">{progress}% uploaded</div>
            </div>
          )}
          
          {error && (
            <div className="text-red-500 text-sm mt-1">{error}</div>
          )}
          
          {uploadComplete && (
            <div className="text-green-500 text-sm mt-1">
              File uploaded successfully!
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FileUpload; 