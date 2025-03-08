'use client';

import AdminLayout from '@/components/AdminLayout';
import MovieForm from '@/components/MovieForm';
import { FaFilm } from 'react-icons/fa';

export default function NewMoviePage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            <FaFilm className="mr-2 text-red-600" /> Add New Content
          </h1>
          <p className="text-gray-600 mt-1">
            Create a new movie or series by filling out the form below. Upload images and video files to Firebase storage.
          </p>
        </div>
        
        <MovieForm />
      </div>
    </AdminLayout>
  );
} 