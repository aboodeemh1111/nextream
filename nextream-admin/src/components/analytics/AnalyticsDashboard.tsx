'use client';

import { useState } from 'react';
import { 
  FaUsers, 
  FaFilm, 
  FaEye, 
  FaArrowUp, 
  FaArrowDown,
  FaChartLine,
  FaInfoCircle
} from 'react-icons/fa';
import Image from 'next/image';
import Link from 'next/link';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsDashboardProps {
  data: {
    userStats: {
      total: number;
      dau: number;
      wau: number;
      mau: number;
    };
    contentStats: {
      totalMovies: number;
      totalViews: number;
    };
    topMovies: Array<{
      _id: string;
      title: string;
      views: number;
      img: string;
    }>;
    genreDistribution: Array<{
      _id: string;
      count: number;
      totalViews: number;
    }>;
    userGrowth: Array<{
      date: string;
      count: number;
    }>;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B', '#6B66FF'];

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ data }) => {
  const [activeUserMetric, setActiveUserMetric] = useState<'dau' | 'wau' | 'mau'>('mau');
  const [showChartInfo, setShowChartInfo] = useState(false);
  
  // Format numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    } else {
      return num.toString();
    }
  };
  
  // Calculate month name from date string (YYYY-MM)
  const getMonthName = (dateStr: string): string => {
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'short' }) + ' ' + year;
  };
  
  // Format user growth data for chart
  const formattedUserGrowth = data.userGrowth.map(item => ({
    name: getMonthName(item.date),
    users: item.count
  }));
  
  // Format genre distribution data for chart
  const formattedGenreDistribution = data.genreDistribution.map(item => ({
    name: item._id || 'Unknown',
    value: item.count
  }));
  
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {/* Total Users Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Total Users</p>
              <h2 className="text-xl sm:text-3xl font-bold text-gray-800 mt-1">{formatNumber(data.userStats.total)}</h2>
            </div>
            <div className="bg-blue-100 p-2 sm:p-3 rounded-full">
              <FaUsers className="text-blue-600 text-lg sm:text-xl" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2 sm:gap-4">
            <button 
              className={`text-xs px-2 py-1 rounded ${activeUserMetric === 'dau' ? 'bg-blue-100 text-blue-800' : 'text-gray-500 hover:bg-gray-100'}`}
              onClick={() => setActiveUserMetric('dau')}
            >
              DAU: {formatNumber(data.userStats.dau)}
            </button>
            <button 
              className={`text-xs px-2 py-1 rounded ${activeUserMetric === 'wau' ? 'bg-blue-100 text-blue-800' : 'text-gray-500 hover:bg-gray-100'}`}
              onClick={() => setActiveUserMetric('wau')}
            >
              WAU: {formatNumber(data.userStats.wau)}
            </button>
            <button 
              className={`text-xs px-2 py-1 rounded ${activeUserMetric === 'mau' ? 'bg-blue-100 text-blue-800' : 'text-gray-500 hover:bg-gray-100'}`}
              onClick={() => setActiveUserMetric('mau')}
            >
              MAU: {formatNumber(data.userStats.mau)}
            </button>
          </div>
        </div>
        
        {/* Total Movies Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Total Movies</p>
              <h2 className="text-xl sm:text-3xl font-bold text-gray-800 mt-1">{formatNumber(data.contentStats.totalMovies)}</h2>
            </div>
            <div className="bg-red-100 p-2 sm:p-3 rounded-full">
              <FaFilm className="text-red-600 text-lg sm:text-xl" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <Link href="/movies" className="text-red-600 text-xs sm:text-sm hover:underline flex items-center">
              View all movies
            </Link>
          </div>
        </div>
        
        {/* Total Views Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Total Views</p>
              <h2 className="text-xl sm:text-3xl font-bold text-gray-800 mt-1">{formatNumber(data.contentStats.totalViews)}</h2>
            </div>
            <div className="bg-purple-100 p-2 sm:p-3 rounded-full">
              <FaEye className="text-purple-600 text-lg sm:text-xl" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <Link href="/analytics?tab=content-performance" className="text-purple-600 text-xs sm:text-sm hover:underline flex items-center">
              View content performance
            </Link>
          </div>
        </div>
        
        {/* User Growth Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs sm:text-sm font-medium">User Growth</p>
              <h2 className="text-xl sm:text-3xl font-bold text-gray-800 mt-1">
                {data.userGrowth.length > 1 ? (
                  <>
                    {data.userGrowth[data.userGrowth.length - 1].count > data.userGrowth[data.userGrowth.length - 2].count ? (
                      <span className="text-green-500 flex items-center">
                        <FaArrowUp className="mr-1" />
                        {formatNumber(data.userGrowth[data.userGrowth.length - 1].count)}
                      </span>
                    ) : (
                      <span className="text-red-500 flex items-center">
                        <FaArrowDown className="mr-1" />
                        {formatNumber(data.userGrowth[data.userGrowth.length - 1].count)}
                      </span>
                    )}
                  </>
                ) : (
                  formatNumber(data.userGrowth[0]?.count || 0)
                )}
              </h2>
            </div>
            <div className="bg-green-100 p-2 sm:p-3 rounded-full">
              <FaChartLine className="text-green-600 text-lg sm:text-xl" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <Link href="/analytics?tab=user-engagement" className="text-green-600 text-xs sm:text-sm hover:underline flex items-center">
              View user engagement
            </Link>
          </div>
        </div>
      </div>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* User Growth Chart */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800">User Growth (Last 6 Months)</h3>
            <button 
              className="text-gray-400 hover:text-gray-600"
              onClick={() => setShowChartInfo(!showChartInfo)}
              aria-label="Show chart information"
            >
              <FaInfoCircle />
            </button>
          </div>
          
          {showChartInfo && (
            <div className="mb-4 p-3 bg-blue-50 text-blue-800 text-xs sm:text-sm rounded-lg">
              <p>This chart shows the number of new users who joined each month over the last 6 months.</p>
            </div>
          )}
          
          <div className="h-60 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={formattedUserGrowth}
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis width={40} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="users" stroke="#8884d8" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Genre Distribution Chart */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Genre Distribution</h3>
          <div className="h-60 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={formattedGenreDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {formattedGenreDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px', width: '100%' }} layout="horizontal" verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Top Movies Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Top Performing Movies</h3>
        
        {/* Mobile View - Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
          {data.topMovies.slice(0, 4).map((movie, index) => (
            <div key={movie._id} className="bg-gray-50 rounded-lg p-3 flex flex-col">
              <div className="flex items-center mb-2">
                <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded overflow-hidden mr-3">
                  {movie.img ? (
                    <Image 
                      src={movie.img} 
                      alt={movie.title} 
                      width={40} 
                      height={40} 
                      className="object-cover h-full w-full"
                    />
                  ) : (
                    <div className="h-10 w-10 flex items-center justify-center bg-gray-300">
                      <FaFilm className="text-gray-500" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-900 line-clamp-1">{movie.title}</div>
                  <div className="text-xs text-gray-500">{movie.views.toLocaleString()} views</div>
                </div>
              </div>
              <div className="mt-auto pt-2 flex justify-between text-xs">
                <Link href={`/movies/${movie._id}`} className="text-indigo-600 hover:text-indigo-900">
                  View
                </Link>
                <Link href={`/movies/edit/${movie._id}`} className="text-indigo-600 hover:text-indigo-900">
                  Edit
                </Link>
              </div>
            </div>
          ))}
          {data.topMovies.length > 4 && (
            <div className="sm:col-span-2 text-center py-3">
              <button className="text-red-600 text-sm font-medium">
                View all top movies
              </button>
            </div>
          )}
        </div>
        
        {/* Desktop View - Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Movie
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
              {data.topMovies.map((movie) => (
                <tr key={movie._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded overflow-hidden">
                        {movie.img ? (
                          <Image 
                            src={movie.img} 
                            alt={movie.title} 
                            width={40} 
                            height={40} 
                            className="object-cover h-full w-full"
                          />
                        ) : (
                          <div className="h-10 w-10 flex items-center justify-center bg-gray-300">
                            <FaFilm className="text-gray-500" />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{movie.title}</div>
                      </div>
                    </div>
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
    </div>
  );
};

export default AnalyticsDashboard; 