'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import api from '@/services/api';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaFilter, FaEye } from 'react-icons/fa';
import Image from 'next/image';

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
  createdAt: string;
}

export default function ListsPage() {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [genreFilter, setGenreFilter] = useState<string>('');
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchLists();
    }
  }, [user]);

  const fetchLists = async () => {
    if (!user) {
      setError('Authentication required. Please log in.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching lists with token:', user.accessToken.substring(0, 15) + '...');
      
      const res = await api.get('/lists/all', {
        headers: {
          token: `Bearer ${user.accessToken}`,
        },
      });
      
      console.log('Lists API response status:', res.status);
      setLists(res.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching lists:', err.response?.data || err.message);
      
      if (err.response?.status === 403) {
        setError('Access denied. You do not have permission to view lists. Please ensure you are logged in with an admin account.');
      } else if (err.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
      } else {
        setError(err.response?.data?.message || 'Failed to load lists. Please try again later.');
      }
      
      // Use mock data for development if API call fails
      if (process.env.NODE_ENV === 'development') {
        console.log('Using mock data for development');
        setLists([
          {
            _id: '1',
            title: 'Popular Movies',
            type: 'movie',
            genre: 'all',
            content: [
              { _id: '101', title: 'Sample Movie 1', img: 'https://via.placeholder.com/150x225', genre: 'Action', isSeries: false },
              { _id: '102', title: 'Sample Movie 2', img: 'https://via.placeholder.com/150x225', genre: 'Drama', isSeries: false }
            ],
            createdAt: new Date().toISOString()
          }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this list?')) {
      return;
    }

    try {
      await api.delete(`/lists/${id}`, {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      });
      setSuccess('List deleted successfully');
      fetchLists();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete list');
    }
  };

  const filteredLists = lists.filter(list => {
    const matchesSearch = list.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || list.type === typeFilter || list.type === 'all';
    const matchesGenre = !genreFilter || list.genre === genreFilter;
    
    return matchesSearch && matchesType && matchesGenre;
  });

  // Get unique genres for filter dropdown
  const genres = Array.from(new Set(lists.map(list => list.genre).filter(Boolean)));

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center min-h-screen bg-gray-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Content Lists</h1>
              <p className="mt-2 text-sm text-gray-600">Manage your content lists and collections</p>
            </div>
            
            <div className="mt-4 md:mt-0">
              <Link
                href="/lists/create"
                className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
              >
                <FaPlus className="mr-2" /> Create New List
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm mb-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search lists..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                    <FaSearch className="absolute left-3 top-3 text-gray-400" />
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as 'all' | 'movie' | 'series')}
                    className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="all">All Types</option>
                    <option value="movie">Movies</option>
                    <option value="series">Series</option>
                  </select>
                  
                  <select
                    value={genreFilter}
                    onChange={(e) => setGenreFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">All Genres</option>
                    {genres.map(genre => (
                      <option key={genre} value={genre}>{genre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <div className="m-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
                <p className="font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="m-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md">
                <p className="font-medium">Success</p>
                <p className="text-sm">{success}</p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      List Details
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Genre
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Content
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLists.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <FaFilter className="w-8 h-8 mb-4 text-gray-400" />
                          <p className="text-lg font-medium">No lists found</p>
                          <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLists.map((list) => (
                      <tr key={list._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{list.title}</div>
                              <div className="text-sm text-gray-500">Created {new Date(list.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            list.type === 'movie' 
                              ? 'bg-blue-100 text-blue-800' 
                              : list.type === 'series' 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-gray-100 text-gray-800'
                          }`}>
                            {list.type === 'movie' ? 'Movies' : list.type === 'series' ? 'Series' : 'Both'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {list.genre || 'All Genres'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex -space-x-2 mr-2">
                              {list.content.slice(0, 3).map((movie, index) => (
                                <div key={movie._id} className="relative w-8 h-8 rounded-full ring-2 ring-white overflow-hidden">
                                  <Image
                                    src={movie.img}
                                    alt={movie.title}
                                    fill
                                    className="object-cover"
                                    sizes="32px"
                                  />
                                </div>
                              ))}
                            </div>
                            <span className="text-sm text-gray-500">
                              {list.content.length} items
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Link
                              href={`/lists/${list._id}`}
                              className="text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100"
                            >
                              <FaEye className="w-4 h-4" />
                            </Link>
                            <Link
                              href={`/lists/edit/${list._id}`}
                              className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded-md hover:bg-blue-100"
                            >
                              <FaEdit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleDelete(list._id)}
                              className="text-red-600 hover:text-red-900 px-2 py-1 rounded-md hover:bg-red-100"
                            >
                              <FaTrash className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
} 