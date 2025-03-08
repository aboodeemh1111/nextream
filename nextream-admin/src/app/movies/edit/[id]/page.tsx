'use client';

import { useParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import MovieForm from '@/components/MovieForm';
import { FaEdit } from 'react-icons/fa';

export default function EditMoviePage() {
  const params = useParams();
  const movieId = params.id as string;

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            <FaEdit className="mr-2 text-red-600" /> Edit Content
          </h1>
          <p className="text-gray-600 mt-1">
            Edit movie or series details and media files. Any changes will be saved to the database and Firebase storage.
          </p>
        </div>
        
        <MovieForm movieId={movieId} isEdit={true} />
      </div>
    </AdminLayout>
  );
} 