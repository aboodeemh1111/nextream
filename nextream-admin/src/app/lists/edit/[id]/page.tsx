'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { use } from 'react';

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
        const res = await axios.get('/api/movies', {
          headers: {
            token: `Bearer ${user?.accessToken}`,
          },
        });
        setAvailableMovies(res.data);
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
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!list) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            List not found
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Edit List</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Title
            </label>
            <input
              type="text"
              value={list.title}
              onChange={(e) => setList({ ...list, title: e.target.value })}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Type
            </label>
            <select
              value={list.type}
              onChange={(e) => setList({ ...list, type: e.target.value })}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            >
              <option value="movie">Movie</option>
              <option value="series">Series</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Genre
            </label>
            <input
              type="text"
              value={list.genre}
              onChange={(e) => setList({ ...list, genre: e.target.value })}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>

          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Update List
          </button>
        </form>

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Movies in List</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.content.map((movie) => (
              <div
                key={movie._id}
                className="border rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center">
                  <img
                    src={movie.img}
                    alt={movie.title}
                    className="w-16 h-16 object-cover rounded mr-4"
                  />
                  <div>
                    <h3 className="font-semibold">{movie.title}</h3>
                    <p className="text-sm text-gray-600">{movie.genre}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveMovie(movie._id)}
                  className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Available Movies</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableMovies
              .filter((movie) => !list.content.find((m) => m._id === movie._id))
              .map((movie) => (
                <div
                  key={movie._id}
                  className="border rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <img
                      src={movie.img}
                      alt={movie.title}
                      className="w-16 h-16 object-cover rounded mr-4"
                    />
                    <div>
                      <h3 className="font-semibold">{movie.title}</h3>
                      <p className="text-sm text-gray-600">{movie.genre}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddMovie(movie._id)}
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm"
                  >
                    Add
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
} 