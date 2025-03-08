'use client';

import { useState } from 'react';
import { 
  FaFilm, 
  FaEye, 
  FaChartBar, 
  FaStopwatch,
  FaChartPie,
  FaChartLine,
  FaInfoCircle
} from 'react-icons/fa';
import Image from 'next/image';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

interface ContentPerformanceInsightsProps {
  data: {
    topTitles: Array<{
      _id: string;
      title: string;
      views: number;
      img?: string;
      genre?: string;
    }>;
    bingeWatchingData: {
      topUsers: Array<{
        _id: string;
        sessionCount: number;
      }>;
      avgBingeLength: number;
    };
    dropOffPoints: Array<{
      _id: string;
      title: string;
      avgDropOffPoint: number;
      count: number;
    }>;
    genrePerformance: Array<{
      _id: string;
      totalViews: number;
      avgViews: number;
      count: number;
    }>;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B', '#6B66FF'];

const ContentPerformanceInsights: React.FC<ContentPerformanceInsightsProps> = ({ data }) => {
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [showChartInfo, setShowChartInfo] = useState(false);
  
  // Format genre performance data for chart
  const formattedGenrePerformance = data.genrePerformance.map(genre => ({
    name: genre._id || 'Unknown',
    totalViews: genre.totalViews,
    avgViews: Math.round(genre.avgViews),
    count: genre.count
  }));
  
  // Format drop-off points data for chart
  const formattedDropOffPoints = data.dropOffPoints
    .filter(item => item.count > 5) // Only include items with significant data
    .map(item => ({
      name: item.title.length > 15 ? item.title.substring(0, 15) + '...' : item.title,
      fullTitle: item.title,
      dropOffPoint: Math.round(item.avgDropOffPoint),
      count: item.count
    }))
    .slice(0, 10); // Limit to top 10 for readability
  
  // Calculate average drop-off percentage
  const avgDropOffPercentage = data.dropOffPoints.length > 0
    ? data.dropOffPoints.reduce((sum, item) => sum + item.avgDropOffPoint, 0) / data.dropOffPoints.length
    : 0;
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-lg sm:text-xl font-bold text-gray-800">Content Performance Insights</h2>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {/* Top Movie Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Top Movie</p>
              <h2 className="text-base sm:text-xl font-bold text-gray-800 mt-1 truncate">
                {data.topTitles.length > 0 ? data.topTitles[0].title : 'N/A'}
              </h2>
            </div>
            <div className="bg-red-100 p-2 sm:p-3 rounded-full">
              <FaFilm className="text-red-600 text-lg sm:text-xl" />
            </div>
          </div>
          {data.topTitles.length > 0 && (
            <div className="mt-3 sm:mt-4 flex items-center">
              <FaEye className="text-gray-400 mr-1" />
              <span className="text-xs sm:text-sm text-gray-500">{data.topTitles[0].views.toLocaleString()} views</span>
            </div>
          )}
        </div>
        
        {/* Top Genre Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Top Genre</p>
              <h2 className="text-base sm:text-xl font-bold text-gray-800 mt-1 truncate">
                {data.genrePerformance.length > 0 ? data.genrePerformance[0]._id || 'Unknown' : 'N/A'}
              </h2>
            </div>
            <div className="bg-blue-100 p-2 sm:p-3 rounded-full">
              <FaChartPie className="text-blue-600 text-lg sm:text-xl" />
            </div>
          </div>
          {data.genrePerformance.length > 0 && (
            <div className="mt-3 sm:mt-4 flex items-center">
              <FaEye className="text-gray-400 mr-1" />
              <span className="text-xs sm:text-sm text-gray-500">{data.genrePerformance[0].totalViews.toLocaleString()} total views</span>
            </div>
          )}
        </div>
        
        {/* Binge Watching Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Avg. Binge Length</p>
              <h2 className="text-base sm:text-xl font-bold text-gray-800 mt-1">
                {data.bingeWatchingData.avgBingeLength.toFixed(1)} movies
              </h2>
            </div>
            <div className="bg-green-100 p-2 sm:p-3 rounded-full">
              <FaChartLine className="text-green-600 text-lg sm:text-xl" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <span className="text-xs sm:text-sm text-gray-500">
              Average number of movies watched in a session
            </span>
          </div>
        </div>
        
        {/* Drop-off Point Card */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Avg. Drop-off Point</p>
              <h2 className="text-base sm:text-xl font-bold text-gray-800 mt-1">
                {avgDropOffPercentage.toFixed(1)}%
              </h2>
            </div>
            <div className="bg-purple-100 p-2 sm:p-3 rounded-full">
              <FaStopwatch className="text-purple-600 text-lg sm:text-xl" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <span className="text-xs sm:text-sm text-gray-500">
              Average point where viewers stop watching
            </span>
          </div>
        </div>
      </div>
      
      {/* Top Movies Section - Mobile View */}
      <div className="md:hidden bg-white rounded-lg shadow-sm p-4 border border-gray-100">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Top Movies</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.topTitles.slice(0, 6).map((movie, index) => (
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
                  <div className="font-medium text-sm text-gray-900 line-clamp-1">
                    #{index + 1} {movie.title}
                  </div>
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
        </div>
      </div>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Genre Performance Chart */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800">Genre Performance</h3>
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
              <p>This chart shows the total views and average views per title for each genre.</p>
            </div>
          )}
          
          <div className="h-60 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={formattedGenrePerformance}
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis width={40} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="totalViews" name="Total Views" fill="#8884d8" />
                <Bar dataKey="avgViews" name="Average Views" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Drop-off Points Chart */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Drop-off Points</h3>
          <div className="h-60 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={formattedDropOffPoints}
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                />
                <Tooltip 
                  contentStyle={{ fontSize: '12px' }} 
                  formatter={(value, name, props) => [`${value}%`, 'Drop-off Point']}
                  labelFormatter={(label, props) => {
                    const payload = (props?.payload as any[])[0]?.payload;
                    return payload?.fullTitle || label;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="dropOffPoint" name="Avg. Drop-off Point (%)" fill="#ff7675" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Top Movies Section - Desktop View */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Top 10 Most-Watched Titles</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Genre
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
              {data.topTitles.map((movie, index) => (
                <tr key={movie._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">#{index + 1}</div>
                  </td>
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
                    <div className="text-sm text-gray-500">{movie.genre || 'Unknown'}</div>
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
      
      {/* Content Performance Insights */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Content Performance Insights</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2 text-sm sm:text-base">Key Findings</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-red-500 mr-2 mt-0.5">•</span>
                <span>
                  {data.topTitles.length > 0 
                    ? `"${data.topTitles[0].title}" is your most popular title with ${data.topTitles[0].views.toLocaleString()} views.` 
                    : 'No data available for top titles.'}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2 mt-0.5">•</span>
                <span>
                  {data.genrePerformance.length > 0 
                    ? `${data.genrePerformance[0]._id || 'Unknown'} is the most popular genre with ${data.genrePerformance[0].totalViews.toLocaleString()} total views.` 
                    : 'No genre performance data available.'}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2 mt-0.5">•</span>
                <span>
                  {data.bingeWatchingData.avgBingeLength > 2 
                    ? `Strong binge-watching behavior with users watching an average of ${data.bingeWatchingData.avgBingeLength.toFixed(1)} movies in a session.` 
                    : `Users watch an average of ${data.bingeWatchingData.avgBingeLength.toFixed(1)} movies in a session.`}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2 mt-0.5">•</span>
                <span>
                  {avgDropOffPercentage > 75 
                    ? `Users typically watch ${avgDropOffPercentage.toFixed(1)}% of content before dropping off, indicating strong content engagement.` 
                    : avgDropOffPercentage > 50 
                      ? `Users typically watch ${avgDropOffPercentage.toFixed(1)}% of content before dropping off, indicating moderate engagement.` 
                      : `Users typically drop off after watching only ${avgDropOffPercentage.toFixed(1)}% of content, suggesting potential engagement issues.`}
                </span>
              </li>
            </ul>
          </div>
          
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2 text-sm sm:text-base">Recommendations</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-red-500 mr-2 mt-0.5">•</span>
                <span>
                  {data.topTitles.length > 0 
                    ? `Promote similar content to "${data.topTitles[0].title}" to capitalize on its popularity.` 
                    : 'Start tracking content popularity to identify top performers.'}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2 mt-0.5">•</span>
                <span>
                  {data.genrePerformance.length > 0 
                    ? `Acquire more ${data.genrePerformance[0]._id || 'Unknown'} content to meet user preferences.` 
                    : 'Implement genre tracking to better understand content performance by category.'}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2 mt-0.5">•</span>
                <span>
                  {data.bingeWatchingData.avgBingeLength < 2 
                    ? 'Improve content recommendations to encourage longer viewing sessions.' 
                    : 'Continue to optimize the recommendation algorithm to maintain strong binge-watching behavior.'}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2 mt-0.5">•</span>
                <span>
                  {avgDropOffPercentage < 50 
                    ? 'Investigate common drop-off points and consider content editing or improvements.' 
                    : 'Analyze the most successful content to understand what drives higher completion rates.'}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentPerformanceInsights; 