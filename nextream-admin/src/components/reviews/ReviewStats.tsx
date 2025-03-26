"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  FaStar,
  FaThumbsUp,
  FaComment,
  FaChartBar,
  FaExclamationTriangle,
  FaSyncAlt,
  FaChartLine,
  FaCalendarAlt,
  FaFilter,
  FaUsers,
  FaFilm,
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import RatingStars from "../RatingStars";
import { useAuth } from "@/context/AuthContext";
import FuturisticAdminCard from "../FuturisticAdminCard";
import FuturisticAdminButton from "../FuturisticAdminButton";

interface ReviewStatsProps {
  className?: string;
}

interface ReviewStats {
  totalReviews: number;
  pendingReviews: number;
  approvedReviews: number;
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
  reviewsOverTime: Array<{
    date: string;
    count: number;
  }>;
  recentReviews: Array<any>;
  topReviewers: Array<{
    _id: string;
    username: string;
    reviewCount: number;
  }>;
}

const ReviewStats: React.FC<ReviewStatsProps> = ({ className = "" }) => {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">(
    "month"
  );
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user, timeRange]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const response = await axios.get(
        `/api/reviews/stats?timeRange=${timeRange}`,
        {
          headers: {
            token: `Bearer ${user?.accessToken}`,
          },
        }
      );

      setStats(response.data);
    } catch (err: any) {
      console.error("Error fetching review stats:", err);
      setError(
        err.response?.status === 403
          ? "Authentication error: You do not have permission to access review statistics."
          : "Failed to load review statistics: " +
              (err.response?.data?.message || err.message)
      );

      // Use fallback data if API call fails
      setStats({
        totalReviews: 1250,
        pendingReviews: 58,
        approvedReviews: 1192,
        averageRating: 4.2,
        ratingDistribution: [
          { _id: 1, count: 42 },
          { _id: 2, count: 98 },
          { _id: 3, count: 285 },
          { _id: 4, count: 487 },
          { _id: 5, count: 338 },
        ],
        topRatedMovies: [
          {
            _id: "1",
            title: "Interstellar",
            averageRating: 4.8,
            reviewCount: 312,
          },
          {
            _id: "2",
            title: "The Matrix",
            averageRating: 4.7,
            reviewCount: 285,
          },
          {
            _id: "3",
            title: "Inception",
            averageRating: 4.6,
            reviewCount: 264,
          },
        ],
        mostReviewedMovies: [
          {
            _id: "1",
            title: "Avengers: Endgame",
            reviewCount: 425,
            averageRating: 4.5,
          },
          {
            _id: "2",
            title: "The Dark Knight",
            reviewCount: 384,
            averageRating: 4.6,
          },
          {
            _id: "3",
            title: "Interstellar",
            reviewCount: 312,
            averageRating: 4.8,
          },
        ],
        reviewsOverTime: [
          { date: "2023-06", count: 85 },
          { date: "2023-07", count: 92 },
          { date: "2023-08", count: 103 },
          { date: "2023-09", count: 118 },
          { date: "2023-10", count: 132 },
          { date: "2023-11", count: 145 },
        ],
        recentReviews: [],
        topReviewers: [
          { _id: "1", username: "moviebuff42", reviewCount: 32 },
          { _id: "2", username: "cinephile99", reviewCount: 28 },
          { _id: "3", username: "filmfanatic", reviewCount: 25 },
        ],
      });
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
      name: `${i + 1} ${i === 0 ? "Star" : "Stars"}`,
    }));

    // Fill in the actual counts
    stats.ratingDistribution.forEach((item) => {
      distribution[item._id - 1].count = item.count;
    });

    return distribution;
  };

  const getApprovalRateData = () => {
    if (!stats) return [];

    return [
      { name: "Approved", value: stats.approvedReviews, fill: "#4F46E5" },
      { name: "Pending", value: stats.pendingReviews, fill: "#F59E0B" },
    ];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-t-4 border-b-4 border-blue-500 animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-t-4 border-b-4 border-indigo-500 animate-spin animation-delay-500"></div>
        </div>
        <p className="ml-4 text-slate-300">Loading review statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <FuturisticAdminCard
        className="border-red-500/50 bg-red-900/20"
        icon={<FaExclamationTriangle />}
        title="Error Loading Statistics"
      >
        <p className="text-slate-300">{error}</p>
        <div className="mt-4">
          <FuturisticAdminButton
            variant="secondary"
            size="sm"
            onClick={() => {
              setError(null);
              fetchStats();
            }}
            icon={<FaSyncAlt />}
          >
            Retry
          </FuturisticAdminButton>
        </div>
      </FuturisticAdminCard>
    );
  }

  if (!stats) {
    return (
      <FuturisticAdminCard
        className="border-blue-500/50 bg-blue-900/10"
        icon={<FaChartBar />}
        title="No Statistics Available"
      >
        <p className="text-slate-300">No review statistics available.</p>
      </FuturisticAdminCard>
    );
  }

  const COLORS = ["#4F46E5", "#6366F1", "#818CF8", "#A5B4FC", "#C7D2FE"];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Time Range Selector */}
      <div className="flex justify-end mb-4">
        <div className="flex space-x-2 bg-slate-800/50 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setTimeRange("week")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              timeRange === "week"
                ? "bg-indigo-600 text-white"
                : "text-slate-300 hover:bg-slate-700/50"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setTimeRange("month")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              timeRange === "month"
                ? "bg-indigo-600 text-white"
                : "text-slate-300 hover:bg-slate-700/50"
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setTimeRange("year")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              timeRange === "year"
                ? "bg-indigo-600 text-white"
                : "text-slate-300 hover:bg-slate-700/50"
            }`}
          >
            Year
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FuturisticAdminCard
          title="Total Reviews"
          icon={<FaComment />}
          glowColor="blue"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white">
                {stats.totalReviews.toLocaleString()}
              </h2>
              <div className="flex items-center mt-1">
                <span className="text-sm text-slate-400">
                  {stats.pendingReviews} pending approval
                </span>
              </div>
            </div>
          </div>

          {/* Approval visualization */}
          <div className="mt-4 h-12 bg-slate-800/50 rounded-md relative overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400"
              style={{
                width: `${(stats.approvedReviews / stats.totalReviews) * 100}%`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                {((stats.approvedReviews / stats.totalReviews) * 100).toFixed(
                  1
                )}
                % Approved
              </div>
            </div>
          </div>
        </FuturisticAdminCard>

        <FuturisticAdminCard
          title="Average Rating"
          icon={<FaStar />}
          glowColor="purple"
        >
          <div className="flex items-center">
            <h2 className="text-3xl font-bold text-white mr-2">
              {stats.averageRating.toFixed(1)}
            </h2>
            <RatingStars rating={stats.averageRating} size={20} />
          </div>

          <div className="mt-2 text-sm text-slate-400">
            Based on {stats.totalReviews.toLocaleString()} reviews
          </div>

          {/* Mini rating distribution */}
          <div className="mt-4 flex items-end justify-between h-12 gap-1">
            {formatRatingDistribution().map((item, index) => (
              <div key={item.rating} className="w-full">
                <div
                  className="bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-sm"
                  style={{
                    height: `${Math.max(
                      5,
                      (item.count / stats.totalReviews) * 100
                    )}%`,
                    opacity: 0.3 + index * 0.15,
                  }}
                ></div>
                <div className="text-center text-xs text-slate-400 mt-1">
                  {item.rating}★
                </div>
              </div>
            ))}
          </div>
        </FuturisticAdminCard>

        <FuturisticAdminCard
          title="Most Active Reviewers"
          icon={<FaUsers />}
          glowColor="teal"
        >
          <div className="space-y-2">
            {stats.topReviewers.slice(0, 3).map((reviewer, index) => (
              <div
                key={reviewer._id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                    {reviewer.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="ml-2">
                    <div className="text-sm font-medium text-slate-200 truncate max-w-[140px]">
                      {reviewer.username}
                    </div>
                  </div>
                </div>
                <div className="text-sm bg-slate-800/50 rounded-full px-2 py-0.5 text-slate-300">
                  {reviewer.reviewCount} reviews
                </div>
              </div>
            ))}
          </div>
        </FuturisticAdminCard>
      </div>

      {/* Rating Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FuturisticAdminCard
          title="Rating Distribution"
          subtitle="Review ratings breakdown"
          icon={<FaChartBar />}
          glowColor="blue"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={formatRatingDistribution()}
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis dataKey="rating" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderColor: "#475569",
                    color: "#e2e8f0",
                    borderRadius: "6px",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Bar dataKey="count" name="Number of Reviews">
                  {formatRatingDistribution().map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </FuturisticAdminCard>

        <FuturisticAdminCard
          title="Review Trends"
          subtitle="Reviews over time"
          icon={<FaChartLine />}
          glowColor="purple"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={stats.reviewsOverTime}
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderColor: "#475569",
                    color: "#e2e8f0",
                    borderRadius: "6px",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Reviews"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                  activeDot={{
                    fill: "#d8b4fe",
                    stroke: "#8b5cf6",
                    strokeWidth: 2,
                    r: 6,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </FuturisticAdminCard>
      </div>

      {/* Review Approval Ratio & Top Rated Movies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FuturisticAdminCard
          title="Review Approval Status"
          subtitle="Approved vs. pending reviews"
          icon={<FaFilter />}
          glowColor="blue"
        >
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getApprovalRateData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  innerRadius={40}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {getApprovalRateData().map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.fill || COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderColor: "#475569",
                    color: "#e2e8f0",
                    borderRadius: "6px",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </FuturisticAdminCard>

        <FuturisticAdminCard
          title="Top Rated Movies"
          subtitle="Highest-rated content"
          icon={<FaFilm />}
          glowColor="purple"
        >
          <div className="space-y-3">
            {stats.topRatedMovies.slice(0, 3).map((movie, index) => (
              <div
                key={movie._id}
                className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors border border-slate-700/50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-slate-300 font-medium">
                      {movie.title}
                    </div>
                    <div className="flex items-center mt-1">
                      <span className="text-amber-400 font-semibold mr-2">
                        {movie.averageRating.toFixed(1)}
                      </span>
                      <RatingStars rating={movie.averageRating} size={14} />
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {movie.reviewCount} reviews
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FuturisticAdminCard>
      </div>

      {/* Most Reviewed Movies */}
      <FuturisticAdminCard
        title="Most Reviewed Movies"
        subtitle="Popular films with most feedback"
        icon={<FaCalendarAlt />}
        glowColor="purple"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800/50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
                >
                  Rank
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
                >
                  Movie
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
                >
                  Reviews
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
                >
                  Rating
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800/30 divide-y divide-slate-700">
              {stats.mostReviewedMovies.slice(0, 5).map((movie, idx) => (
                <tr
                  key={movie._id}
                  className="hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                      {idx + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-200">
                      {movie.title}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {movie.reviewCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-slate-300 mr-2">
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
      </FuturisticAdminCard>
    </div>
  );
};

export default ReviewStats;
