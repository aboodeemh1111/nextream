'use client';

import { useState } from 'react';
import { 
  FaUsers, 
  FaClock, 
  FaPercentage, 
  FaFilm,
  FaChartLine,
  FaInfoCircle
} from 'react-icons/fa';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface UserEngagementMetricsProps {
  data: {
    activeUsers: number;
    totalUsers: number;
    avgWatchTime: number;
    completionRate: number;
    mostWatchedGenres: Array<{
      _id: string;
      count: number;
    }>;
    watchTimeTrends: Array<{
      date: string;
      totalWatchTime: number;
      count: number;
    }>;
  };
  period: 'day' | 'week' | 'month' | '6months' | 'year';
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B', '#6B66FF'];

const UserEngagementMetrics: React.FC<UserEngagementMetricsProps> = ({ data, period }) => {
  const [showChartInfo, setShowChartInfo] = useState(false);
  
  // Format watch time (seconds to hours:minutes)
  const formatWatchTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };
  
  // Calculate month name from date string (YYYY-MM)
  const getMonthName = (dateStr: string): string => {
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'short' }) + ' ' + year;
  };
  
  // Format watch time trends data for chart
  const formattedWatchTimeTrends = data.watchTimeTrends.map(item => ({
    name: getMonthName(item.date),
    watchTime: Math.round(item.totalWatchTime / 3600), // Convert seconds to hours
    count: item.count
  }));
  
  // Format genre data for chart
  const formattedGenres = data.mostWatchedGenres.map(genre => ({
    name: genre._id || 'Unknown',
    value: genre.count
  }));
  
  // Calculate active user percentage
  const activeUserPercentage = data.totalUsers > 0 
    ? (data.activeUsers / data.totalUsers) * 100 
    : 0;
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-lg sm:text-xl font-bold text-gray-800">User Engagement Metrics</h2>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {/* Active Users Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Active Users</p>
              <h2 className="text-xl sm:text-3xl font-bold text-gray-800 mt-1">{data.activeUsers.toLocaleString()}</h2>
            </div>
            <div className="bg-blue-100 p-2 sm:p-3 rounded-full">
              <FaUsers className="text-blue-600 text-lg sm:text-xl" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-center">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${activeUserPercentage}%` }}
              ></div>
            </div>
            <span className="ml-2 text-xs sm:text-sm text-gray-500">{activeUserPercentage.toFixed(1)}%</span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {period === 'day' && 'Daily active users (last 24 hours)'}
            {period === 'week' && 'Weekly active users (last 7 days)'}
            {period === 'month' && 'Monthly active users (last 30 days)'}
            {period === '6months' && 'Active users in last 6 months'}
            {period === 'year' && 'Active users in last year'}
          </p>
        </div>
        
        {/* Average Watch Time Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Avg. Watch Time</p>
              <h2 className="text-xl sm:text-3xl font-bold text-gray-800 mt-1">{formatWatchTime(data.avgWatchTime)}</h2>
            </div>
            <div className="bg-green-100 p-2 sm:p-3 rounded-full">
              <FaClock className="text-green-600 text-lg sm:text-xl" />
            </div>
          </div>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-500">
            Average time spent watching content per user
          </p>
        </div>
        
        {/* Completion Rate Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Completion Rate</p>
              <h2 className="text-xl sm:text-3xl font-bold text-gray-800 mt-1">{data.completionRate.toFixed(1)}%</h2>
            </div>
            <div className="bg-purple-100 p-2 sm:p-3 rounded-full">
              <FaPercentage className="text-purple-600 text-lg sm:text-xl" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-center">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-purple-600 h-2.5 rounded-full" 
                style={{ width: `${data.completionRate}%` }}
              ></div>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Percentage of started videos that were watched to completion
          </p>
        </div>
        
        {/* Most Popular Genre Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Top Genre</p>
              <h2 className="text-xl sm:text-3xl font-bold text-gray-800 mt-1 truncate">
                {data.mostWatchedGenres.length > 0 ? data.mostWatchedGenres[0]._id || 'Unknown' : 'N/A'}
              </h2>
            </div>
            <div className="bg-red-100 p-2 sm:p-3 rounded-full">
              <FaFilm className="text-red-600 text-lg sm:text-xl" />
            </div>
          </div>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-500">
            Most popular genre among users
          </p>
        </div>
      </div>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Watch Time Trends Chart */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800">Watch Time Trends</h3>
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
              <p>This chart shows the total watch time (in hours) and number of views over time.</p>
            </div>
          )}
          
          <div className="h-60 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={formattedWatchTimeTrends}
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" width={40} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" width={40} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line yAxisId="left" type="monotone" dataKey="watchTime" name="Watch Time (hours)" stroke="#8884d8" activeDot={{ r: 8 }} />
                <Line yAxisId="right" type="monotone" dataKey="count" name="Number of Views" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Genre Distribution Chart */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Most Watched Genres</h3>
          <div className="h-60 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={formattedGenres}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {formattedGenres.map((entry, index) => (
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
      
      {/* User Engagement Insights */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">User Engagement Insights</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2 text-sm sm:text-base">Key Findings</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-blue-500 mr-2 mt-0.5">•</span>
                <span>
                  {activeUserPercentage > 50 
                    ? `Strong user engagement with ${activeUserPercentage.toFixed(1)}% of users active in the selected period.` 
                    : `Moderate user engagement with ${activeUserPercentage.toFixed(1)}% of users active in the selected period.`}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2 mt-0.5">•</span>
                <span>
                  {data.avgWatchTime > 3600 
                    ? `Users spend an average of ${formatWatchTime(data.avgWatchTime)} watching content, indicating strong engagement.` 
                    : `Users spend an average of ${formatWatchTime(data.avgWatchTime)} watching content.`}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2 mt-0.5">•</span>
                <span>
                  {data.completionRate > 75 
                    ? `Excellent completion rate of ${data.completionRate.toFixed(1)}% shows users are finding content engaging.` 
                    : data.completionRate > 50 
                      ? `Good completion rate of ${data.completionRate.toFixed(1)}% indicates reasonable content engagement.` 
                      : `Completion rate of ${data.completionRate.toFixed(1)}% suggests opportunity to improve content engagement.`}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2 mt-0.5">•</span>
                <span>
                  {data.mostWatchedGenres.length > 0 
                    ? `${data.mostWatchedGenres[0]._id || 'Unknown'} is the most popular genre, followed by ${data.mostWatchedGenres.length > 1 ? data.mostWatchedGenres[1]._id || 'Unknown' : 'none'}.` 
                    : 'No genre data available.'}
                </span>
              </li>
            </ul>
          </div>
          
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2 text-sm sm:text-base">Recommendations</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-blue-500 mr-2 mt-0.5">•</span>
                <span>
                  {activeUserPercentage < 30 
                    ? 'Consider implementing re-engagement campaigns for inactive users.' 
                    : 'Continue current user engagement strategies which are working well.'}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2 mt-0.5">•</span>
                <span>
                  {data.avgWatchTime < 1800 
                    ? 'Explore ways to increase watch time through better content recommendations.' 
                    : 'Maintain the quality of content that is driving good watch times.'}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2 mt-0.5">•</span>
                <span>
                  {data.completionRate < 50 
                    ? 'Investigate why users are not completing content and address potential issues.' 
                    : 'Continue to promote content that drives high completion rates.'}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2 mt-0.5">•</span>
                <span>
                  {data.mostWatchedGenres.length > 0 
                    ? `Consider acquiring more ${data.mostWatchedGenres[0]._id || 'Unknown'} content based on user preferences.` 
                    : 'Start tracking genre preferences to better understand user interests.'}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserEngagementMetrics; 