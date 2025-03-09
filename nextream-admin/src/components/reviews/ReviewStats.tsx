'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { FaStar, FaThumbsUp, FaComment, FaChartBar } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import RatingStars from '../RatingStars';

interface ReviewStatsProps {
  className?: string;
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Array<{
    _id: number;
    count: number;
  }>;
  topRatedMovies: Array<{
    _id: string;
    title: string;
    averageRating: number;
    reviewCount: number;
  }>;
  mostReviewedMovies: Array<{
    _id: string;
    title: string;
    reviewCount: number;
    averageRating: number;
  }>;
  recentReviews: Array<any>;
}

const ReviewStats: React.FC<ReviewStatsProps> = ({ className = '' }) => {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('admin-auth-token');
      const response = await axios.get('/api/reviews/stats', {
        headers: {
          token: `Bearer ${token}`,
        },
      });
      
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching review stats:', err);
      setError('Failed to load review statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatRatingDistribution = () => {
    if (!stats) return [];
    
    // Create an array with all ratings from 1 to 5
    const distribution = Array.from({ length: 5 }, (_, i) => ({
      rating: i + 1,
      count: 0,
    }));
    
    // Fill in the actual counts
    stats.ratingDistribution.forEach((item) => {
      distribution[item._id - 1].count = item.count;
    });
    
    return distribution;
  };

  if (loading) {
    return (
      <div className={`flex justify-center py-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-100 text-red-700 p-4 rounded ${className}`}>
        {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={`bg-gray-50 p-6 text-center rounded ${className}`}>
        <p className="text-gray-500">No review statistics available.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Reviews</p>
              <h2 className="text-3xl font-bold text-gray-800 mt-1">
                {stats.totalReviews.toLocaleString()}
              </h2>
            </div>
            <div className="bg-indigo-100 p-3 rounded-full">
              <FaComment className="text-indigo-600 text-xl" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Average Rating</p>
              <div className="flex items-center mt-1">
                <h2 className="text-3xl font-bold text-gray-800 mr-2">
                  {stats.averageRating.toFixed(1)}
                </h2>
                <RatingStars rating={stats.averageRating} size={20} />
              </div>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <FaStar className="text-yellow-600 text-xl" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Most Liked Movie</p>
              <h2 className="text-xl font-bold text-gray-800 mt-1 truncate max-w-[200px]">
                {stats.topRatedMovies[0]?.title || 'N/A'}
              </h2>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <FaThumbsUp className="text-blue-600 text-xl" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Rating Distribution Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Rating Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={formatRatingDistribution()}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rating" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Number of Reviews" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Top Rated Movies */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Rated Movies</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Movie
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reviews
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.topRatedMovies.slice(0, 5).map((movie) => (
                <tr key={movie._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {movie.title}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900 mr-2">
                        {movie.averageRating.toFixed(1)}
                      </span>
                      <RatingStars rating={movie.averageRating} size={16} />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {movie.reviewCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Most Reviewed Movies */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Most Reviewed Movies</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Movie
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reviews
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.mostReviewedMovies.slice(0, 5).map((movie) => (
                <tr key={movie._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {movie.title}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {movie.reviewCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900 mr-2">
                        {movie.averageRating.toFixed(1)}
                      </span>
                      <RatingStars rating={movie.averageRating} size={16} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReviewStats; 