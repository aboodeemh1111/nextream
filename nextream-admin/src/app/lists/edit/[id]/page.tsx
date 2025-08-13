'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import api from '@/services/api';
import { use } from 'react';
import { FaEdit, FaTrash, FaPlus, FaArrowLeft } from 'react-icons/fa';
import Image from 'next/image';
import Link from 'next/link';

interface Movie {
  _id: string;
  title: string;
  img: string;
  genre: string;
  isSeries: boolean;
}

interface List {
  _id: string;
  title: string;
  type: string;
  genre: string;
  content: Movie[];
}

export default function EditListPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user } = useAuth();
  const [list, setList] = useState<List | null>(null);
  const [availableMovies, setAvailableMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Unwrap params using React.use()
  const { id } = use(params);

  useEffect(() => {
    const fetchList = async () => {
      try {
        const res = await axios.get(`/api/lists/find/${id}`, {
          headers: {
            token: `Bearer ${user?.accessToken}`,
          },
        });
        setList(res.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load list');
      }
    };

    const fetchMovies = async () => {
      try {
        const res = await api.get('/movies', {
          headers: {
            token: `Bearer ${user?.accessToken}`,
          },
        });
        const payload = res.data;
        setAvailableMovies(Array.isArray(payload?.data) ? payload.data : []);
      } catch (err: any) {
        console.error('Failed to load movies:', err);
      }
    };

    if (user && id) {
      Promise.all([fetchList(), fetchMovies()]).finally(() => setLoading(false));
    }
  }, [user, id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!list) return;

    try {
      setError(null);
      setSuccess(null);
      
      await axios.put(
        `/api/lists/${id}`,
        {
          title: list.title,
          type: list.type,
          genre: list.genre,
        },
        {
          headers: {
            token: `Bearer ${user?.accessToken}`,
          },
        }
      );
      
      setSuccess('List updated successfully');
      router.push('/lists');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update list');
    }
  };

  const handleAddMovie = async (movieId: string) => {
    try {
      setError(null);
      await axios.post(
        `/api/lists/${id}/movies/${movieId}`,
        {},
        {
          headers: {
            token: `Bearer ${user?.accessToken}`,
          },
        }
      );
      
      // Refresh list data
      const res = await axios.get(`/api/lists/find/${id}`, {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      });
      setList(res.data);
      setSuccess('Movie added to list');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add movie to list');
    }
  };

  const handleRemoveMovie = async (movieId: string) => {
    try {
      setError(null);
      await axios.delete(`/api/lists/${id}/movies/${movieId}`, {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      });
      
      // Refresh list data
      const res = await axios.get(`/api/lists/find/${id}`, {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      });
      setList(res.data);
      setSuccess('Movie removed from list');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove movie from list');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center min-h-screen bg-gray-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!list) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-sm">
              <p className="font-medium">List not found</p>
              <p className="mt-2 text-sm">The requested list could not be found. Please check the URL and try again.</p>
              <Link href="/lists" className="mt-4 inline-flex items-center text-red-700 hover:text-red-900">
                <FaArrowLeft className="mr-2" /> Back to Lists
              </Link>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <Link href="/lists" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
                <FaArrowLeft className="mr-2" /> Back to Lists
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Edit List</h1>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-sm">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md shadow-sm">
              <p className="font-medium">Success</p>
              <p className="text-sm">{success}</p>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  List Title
                </label>
                <input
                  type="text"
                  value={list.title}
                  onChange={(e) => setList({ ...list, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content Type
                </label>
                <select
                  value={list.type}
                  onChange={(e) => setList({ ...list, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="movie">Movies Only</option>
                  <option value="series">Series Only</option>
                  <option value="both">Movies & Series</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Genre
                </label>
                <input
                  type="text"
                  value={list.genre}
                  onChange={(e) => setList({ ...list, genre: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                >
                  Update List
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Movies in List</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {list.content.map((movie) => (
                <div
                  key={movie._id}
                  className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200"
                >
                  <div className="relative h-48 w-full">
                    <Image
                      src={movie.img}
                      alt={movie.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1">{movie.title}</h3>
                    <p className="text-sm text-gray-600 mb-4">{movie.genre}</p>
                    <button
                      onClick={() => handleRemoveMovie(movie._id)}
                      className="w-full inline-flex items-center justify-center px-4 py-2 border border-red-500 text-red-500 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                    >
                      <FaTrash className="mr-2" /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Available Movies</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {availableMovies
                .filter((movie) => !list.content.find((m) => m._id === movie._id))
                .map((movie) => (
                  <div
                    key={movie._id}
                    className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="relative h-48 w-full">
                      <Image
                        src={movie.img}
                        alt={movie.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-1">{movie.title}</h3>
                      <p className="text-sm text-gray-600 mb-4">{movie.genre}</p>
                      <button
                        onClick={() => handleAddMovie(movie._id)}
                        className="w-full inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                      >
                        <FaPlus className="mr-2" /> Add to List
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
} 