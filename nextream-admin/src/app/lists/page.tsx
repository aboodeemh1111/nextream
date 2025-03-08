'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import Link from 'next/link';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaEye, FaFilter } from 'react-icons/fa';

interface List {
  _id: string;
  title: string;
  type: string;
  genre: string;
  content: string[];
  createdAt: string;
}

export default function ListsPage() {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [genreFilter, setGenreFilter] = useState<string>('');
  const { user } = useAuth();

  useEffect(() => {
    const fetchLists = async () => {
      if (!user) return;

      try {
        setLoading(true);
        console.log('Fetching lists with token:', user.accessToken);
        
        // Log the headers being sent
        const headers = {
          token: `Bearer ${user.accessToken}`
        };
        console.log('Request headers:', headers);
        
        const res = await axios.get(
          `/api/lists`,
          {
            headers
          }
        );
        
        console.log('Lists API response:', res.data);
        
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLists(res.data);
          console.log('Successfully loaded', res.data.length, 'lists');
        } else {
          console.log('No lists found or invalid response format:', res.data);
          // Use mock data if no lists are returned
          setLists([
            {
              _id: '1',
              title: 'Popular on Nextream (Mock)',
              type: 'all',
              genre: '',
              content: ['1', '3', '4', '5'],
              createdAt: '2023-01-05T08:30:00.000Z'
            }
          ]);
        }
      } catch (err: any) {
        console.error('Error fetching lists:', err.response?.data || err.message);
        setError('Failed to load lists');
        
        // Use mock data if API call fails
        setLists([
          {
            _id: '1',
            title: 'Popular on Nextream (Mock)',
            type: 'all',
            genre: '',
            content: ['1', '3', '4', '5'],
            createdAt: '2023-01-05T08:30:00.000Z'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchLists();
  }, [user]);

  const handleDelete = async (listId: string) => {
    if (!user) return;
    
    if (window.confirm('Are you sure you want to delete this list?')) {
      try {
        // In a real application, you would call your API to delete the list
        // await axios.delete(`http://localhost:8800/api/lists/${listId}`, {
        //   headers: {
        //     token: `Bearer ${user.accessToken}`,
        //   },
        // });
        
        // Update local state
        setLists(lists.filter(list => list._id !== listId));
      } catch (err) {
        console.error(err);
        alert('Failed to delete list');
      }
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

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h1 className="text-2xl font-bold mb-4 md:mb-0">Content Lists</h1>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search lists..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'movie' | 'series')}
              className="w-full md:w-40 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="all">All Types</option>
              <option value="movie">Movies</option>
              <option value="series">Series</option>
            </select>
            
            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="w-full md:w-40 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">All Genres</option>
              {genres.map(genre => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
            
            <Link
              href="/lists/new"
              className="flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
            >
              <FaPlus className="mr-2" /> Create List
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
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      List Title
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Genre
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLists.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        No lists found
                      </td>
                    </tr>
                  ) : (
                    filteredLists.map((list) => (
                      <tr key={list._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{list.title}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            list.type === 'movie' 
                              ? 'bg-blue-100 text-blue-800' 
                              : list.type === 'series' 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-gray-100 text-gray-800'
                          }`}>
                            {list.type === 'all' ? 'All' : list.type === 'movie' ? 'Movies' : 'Series'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {list.genre || 'All Genres'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{list.content.length}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(list.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/lists/${list._id}`}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            <FaEye className="inline mr-1" /> View
                          </Link>
                          <Link
                            href={`/lists/edit/${list._id}`}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            <FaEdit className="inline mr-1" /> Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(list._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <FaTrash className="inline mr-1" /> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
} 