'use client';

import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { FaUpload, FaSpinner, FaCheck, FaTimes } from 'react-icons/fa';
import useUpload from '@/hooks/useUpload';
import type { UploadPrefix } from '@/lib/uploadClient';

interface FileUploadProps {
  /** Receives the storage *key* to submit, plus a short-lived preview URL. */
  onFileUpload: (key: string, previewUrl: string) => void;
  label: string;
  accept?: string;
  /** Bucket namespace. Replaces the old `folder` prop. */
  prefix?: UploadPrefix;
  /** Existing media for this field, already signed by the API. */
  existingUrl?: string;
}

const FileUpload = ({
  onFileUpload,
  label,
  accept = 'video/*,image/*',
  prefix = 'videos',
  existingUrl = ''
}: FileUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [savedUrl, setSavedUrl] = useState<string>(existingUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { progress, status, error, previewUrl, start, reset } = useUpload({
    prefix,
    onUploaded: (key, url) => {
      setSavedUrl(url);
      onFileUpload(key, url);
    },
  });

  useEffect(() => {
    setSavedUrl(existingUrl);
  }, [existingUrl]);

  const uploading = status === 'uploading';
  const uploadComplete = status === 'done';

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      reset();
    }
  };

  const handleUpload = () => {
    if (!file) return;
    start(file);
  };

  const resetUpload = () => {
    setFile(null);
    reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // The field holds a key now, so previews come from the signed URL the API
  // returns rather than from the stored value.
  const fileUrl = previewUrl || savedUrl;
  const isImageField = accept.includes('image/');

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-muted-foreground mb-2">{label}</label>

      {fileUrl && !file && (
        <div className="mb-3">
          {isImageField ? (
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
          <button
            type="button"
            onClick={() => { setSavedUrl(''); resetUpload(); }}
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
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-foreground hover:file:bg-muted"
            />

            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading || uploadComplete}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm ${
                !file || uploading || uploadComplete
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
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
                className="inline-flex items-center px-3 py-2 border border-input shadow-sm text-sm leading-4 font-medium rounded-md text-muted-foreground bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <FaTimes className="-ml-0.5 mr-2 h-4 w-4" />
                Reset
              </button>
            )}
          </div>

          {file && (
            <div className="text-sm text-muted-foreground mb-2">
              Selected file: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}

          {uploading && (
            <div className="w-full bg-muted rounded-full h-2.5 mb-2">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
              <div className="text-xs text-muted-foreground mt-1">{progress}% uploaded</div>
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
