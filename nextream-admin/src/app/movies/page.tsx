'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import api from '@/services/api';
import Link from 'next/link';
import Image from 'next/image';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaEye } from 'react-icons/fa';

interface Movie {
  _id: string;
  title: string;
  desc: string;
  img: string;
  imgSm?: string;
  trailer?: string;
  year?: string;
  limit?: number;
  genre?: string;
  isSeries: boolean;
  createdAt: string;
}

export default function MoviesPage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'movie' | 'series'>('all');
  const { user } = useAuth();

  useEffect(() => {
    const fetchMovies = async () => {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);
        
        const headers = { token: `Bearer ${user.accessToken}` };
        // Use shared axios instance and adapt to paginated shape { data, page, pageSize, total }
        const res = await api.get('/movies', { headers });
        const payload = res.data;
        if (payload && Array.isArray(payload.data)) {
          setMovies(payload.data);
          console.log('Successfully loaded', res.data.length, 'movies');
        } else {
          setError('Invalid data format received from server');
          console.error('Invalid data format:', payload);
        }
      } catch (err: any) {
        console.error('Error fetching movies:', err.response?.data || err.message);
        setError(err.response?.data?.message || 'Failed to load movies');
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [user]);

  const handleDelete = async (movieId: string) => {
    if (!user) return;
    
    if (window.confirm('Are you sure you want to delete this movie?')) {
      try {
        // In a real application, you would call your API to delete the movie
        // await axios.delete(`http://localhost:8800/api/movies/${movieId}`, {
        //   headers: {
        //     token: `Bearer ${user.accessToken}`,
        //   },
        // });
        
        // Update local state
        setMovies(movies.filter(movie => movie._id !== movieId));
      } catch (err) {
        console.error(err);
        alert('Failed to delete movie');
      }
    }
  };

  const filteredMovies = movies.filter(movie => {
    const matchesSearch = movie.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || 
      (filter === 'movie' && !movie.isSeries) || 
      (filter === 'series' && movie.isSeries);
    
    return matchesSearch && matchesFilter;
  });

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h1 className="text-2xl font-bold mb-4 md:mb-0">Movies & Series</h1>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search titles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
            
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'movie' | 'series')}
              className="w-full md:w-40 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="all">All</option>
              <option value="movie">Movies</option>
              <option value="series">Series</option>
            </select>
            
            <Link
              href="/movies/new"
              className="flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
            >
              <FaPlus className="mr-2" /> Add Content
            </Link>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMovies.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                No content found
              </div>
            ) : (
              filteredMovies.map((movie) => (
                <div key={movie._id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="relative h-48">
                    <Image
                      src={movie.imgSm || movie.img}
                      alt={movie.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                      {movie.isSeries ? 'Series' : 'Movie'}
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="text-lg font-semibold">{movie.title}</h2>
                      <span className="text-sm text-gray-500">{movie.year}</span>
                    </div>
                    
                    <div className="flex items-center mb-2">
                      <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded mr-2">
                        {movie.genre}
                      </span>
                      {movie.limit && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                          {movie.limit}+
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{movie.desc}</p>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-500">
                        Added: {new Date(movie.createdAt).toLocaleDateString()}
                      </div>
                      
                      <div className="flex space-x-2">
                        <Link
                          href={`/movies/${movie._id}`}
                          className="text-blue-600 hover:text-blue-800"
                          title="View details"
                        >
                          <FaEye />
                        </Link>
                        <Link
                          href={`/movies/edit/${movie._id}`}
                          className="text-indigo-600 hover:text-indigo-800"
                          title="Edit"
                        >
                          <FaEdit />
                        </Link>
                        <button
                          onClick={() => handleDelete(movie._id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
} 