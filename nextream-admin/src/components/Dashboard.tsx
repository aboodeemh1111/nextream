'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { FaUsers, FaFilm, FaListUl, FaEye, FaArrowUp, FaArrowDown, FaPlus } from 'react-icons/fa';
import Link from 'next/link';

interface Stats {
  userCount: number;
  movieCount: number;
  listCount: number;
  totalViews: number;
  newUsers: number;
  newUsersChange: number;
  popularMovies: { _id: string; title: string; views: number }[];
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    userCount: 0,
    movieCount: 0,
    listCount: 0,
    totalViews: 0,
    newUsers: 0,
    newUsersChange: 0,
    popularMovies: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        setLoading(true);
        // In a real application, you would fetch this data from your API
        // This is mock data for demonstration purposes
        
        // Mock API call
        // const res = await axios.get('http://localhost:8800/api/stats', {
        //   headers: {
        //     token: `Bearer ${user.accessToken}`,
        //   },
        // });
        // setStats(res.data);
        
        // Mock data
        setStats({
          userCount: 1243,
          movieCount: 567,
          listCount: 48,
          totalViews: 45892,
          newUsers: 124,
          newUsersChange: 12.5,
          popularMovies: [
            { _id: '1', title: 'Stranger Things', views: 12453 },
            { _id: '2', title: 'The Witcher', views: 9876 },
            { _id: '3', title: 'Money Heist', views: 8765 },
            { _id: '4', title: 'Dark', views: 7654 },
            { _id: '5', title: 'Breaking Bad', views: 6543 }
          ]
        });
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Users</p>
              <h2 className="text-3xl font-bold">{stats.userCount.toLocaleString()}</h2>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <FaUsers className="text-blue-600 text-xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className={`text-sm ${stats.newUsersChange >= 0 ? 'text-green-500' : 'text-red-500'} flex items-center`}>
              {stats.newUsersChange >= 0 ? <FaArrowUp className="mr-1" /> : <FaArrowDown className="mr-1" />}
              {Math.abs(stats.newUsersChange)}%
            </span>
            <span className="text-gray-500 text-sm ml-2">from last month</span>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Movies</p>
              <h2 className="text-3xl font-bold">{stats.movieCount.toLocaleString()}</h2>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <FaFilm className="text-red-600 text-xl" />
            </div>
          </div>
          <div className="mt-4">
            <Link href="/movies/new" className="text-red-600 text-sm hover:underline">
              Add new movie
            </Link>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Lists</p>
              <h2 className="text-3xl font-bold">{stats.listCount.toLocaleString()}</h2>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <FaListUl className="text-green-600 text-xl" />
            </div>
          </div>
          <div className="mt-4">
            <Link href="/lists/new" className="text-green-600 text-sm hover:underline">
              Create new list
            </Link>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Views</p>
              <h2 className="text-3xl font-bold">{stats.totalViews.toLocaleString()}</h2>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <FaEye className="text-purple-600 text-xl" />
            </div>
          </div>
          <div className="mt-4">
            <Link href="/analytics" className="text-purple-600 text-sm hover:underline">
              View analytics
            </Link>
          </div>
        </div>
      </div>
      
      {/* Popular Content */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Popular Content</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Views
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.popularMovies.map((movie) => (
                <tr key={movie._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{movie.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{movie.views.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/movies/${movie._id}`} className="text-indigo-600 hover:text-indigo-900 mr-4">
                      View
                    </Link>
                    <Link href={`/movies/edit/${movie._id}`} className="text-indigo-600 hover:text-indigo-900">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Firebase Integration */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-8">
        <h2 className="text-xl font-semibold mb-4">Firebase Integration</h2>
        <p className="text-gray-600 mb-4">
          This admin panel is integrated with Firebase Storage for uploading and storing media files.
          You can test the Firebase integration by uploading files on the Test Upload page.
        </p>
        <Link
          href="/test-upload"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FaPlus className="mr-2" /> Test Firebase Upload
        </Link>
      </div>
    </div>
  );
};

export default Dashboard; 