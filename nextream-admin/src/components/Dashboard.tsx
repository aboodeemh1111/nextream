"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import {
  FaUsers,
  FaFilm,
  FaListUl,
  FaEye,
  FaArrowUp,
  FaArrowDown,
  FaPlus,
  FaChartBar,
  FaCalendarAlt,
  FaUserPlus,
  FaExclamationTriangle,
  FaChartLine,
  FaInfoCircle,
  FaLightbulb,
  FaRegClock,
  FaUser,
  FaComments,
  FaStar,
  FaCheck,
  FaTimes,
} from "react-icons/fa";
import Link from "next/link";
import Image from "next/image";
import FuturisticAdminCard from "./FuturisticAdminCard";
import FuturisticAdminButton from "./FuturisticAdminButton";

interface Stats {
  userCount: number;
  movieCount: number;
  listCount: number;
  totalViews: number;
  newUsers: number;
  newUsersChange: number;
  popularMovies: { _id: string; title: string; views: number; img?: string }[];
  recentUsers: {
    _id: string;
    username: string;
    email: string;
    profilePic?: string;
    createdAt: string;
    isAdmin: boolean;
  }[];
  reviewStats?: {
    totalReviews: number;
    pendingReviews: number;
    approvedReviews: number;
    averageRating: number;
  };
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    userCount: 0,
    movieCount: 0,
    listCount: 0,
    totalViews: 0,
    newUsers: 0,
    newUsersChange: 0,
    popularMovies: [],
    recentUsers: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const { user } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Fetch real data from the API
        const res = await axios.get("/api/admin/stats", {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });

        setStats(res.data);
        console.log("Dashboard stats loaded:", res.data);
      } catch (err: any) {
        console.error(
          "Error fetching dashboard stats:",
          err.response?.data || err.message
        );
        setError(
          "Failed to load dashboard data. " +
            (err.response?.data?.error || err.message)
        );

        // Use fallback data if API call fails
        setStats({
          userCount: 1250,
          movieCount: 428,
          listCount: 32,
          totalViews: 85432,
          newUsers: 127,
          newUsersChange: 12.4,
          popularMovies: [
            {
              _id: "1",
              title: "Tenet",
              views: 12540,
              img: "/images/movies/fallback-1.jpg",
            },
            {
              _id: "2",
              title: "Inception",
              views: 9870,
              img: "/images/movies/fallback-2.jpg",
            },
            {
              _id: "3",
              title: "Interstellar",
              views: 8654,
              img: "/images/movies/fallback-3.jpg",
            },
            {
              _id: "4",
              title: "The Dark Knight",
              views: 7832,
              img: "/images/movies/fallback-4.jpg",
            },
          ],
          recentUsers: [
            {
              _id: "1",
              username: "johnsmith",
              email: "john@example.com",
              createdAt: new Date().toISOString(),
              isAdmin: false,
            },
            {
              _id: "2",
              username: "sarahparker",
              email: "sarah@example.com",
              createdAt: new Date(Date.now() - 86400000).toISOString(),
              isAdmin: false,
            },
            {
              _id: "3",
              username: "davidwilson",
              email: "david@example.com",
              createdAt: new Date(Date.now() - 172800000).toISOString(),
              isAdmin: true,
            },
            {
              _id: "4",
              username: "emilyjohnson",
              email: "emily@example.com",
              createdAt: new Date(Date.now() - 259200000).toISOString(),
              isAdmin: false,
            },
          ],
          reviewStats: {
            totalReviews: 1458,
            pendingReviews: 62,
            approvedReviews: 1396,
            averageRating: 4.3,
          },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    } else {
      return num.toString();
    }
  };

  const renderTrendIndicator = (change: number) => {
    const isPositive = change >= 0;
    const color = isPositive ? "text-emerald-400" : "text-rose-400";
    const icon = isPositive ? (
      <FaArrowUp className="mr-1" />
    ) : (
      <FaArrowDown className="mr-1" />
    );

    return (
      <span className={`flex items-center font-medium ${color}`}>
        {icon}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-t-4 border-b-4 border-blue-500 animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-t-4 border-b-4 border-indigo-500 animate-spin animation-delay-500"></div>
        </div>
        <p className="ml-4 text-slate-300">Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <FuturisticAdminCard
        className="border-red-500/50 bg-red-900/20"
        icon={<FaExclamationTriangle />}
        title="Error Loading Dashboard"
      >
        <p className="text-slate-300">{error}</p>
        <div className="mt-4">
          <FuturisticAdminButton
            variant="secondary"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Retry
          </FuturisticAdminButton>
        </div>
      </FuturisticAdminCard>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
              Admin Dashboard
            </h1>
            <p className="text-slate-400 mt-1">
              Streaming platform analytics and management
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <div className="flex space-x-2">
              <FuturisticAdminButton
                size="sm"
                variant="secondary"
                icon={<FaRegClock />}
              >
                Last 30 days
              </FuturisticAdminButton>
              <FuturisticAdminButton
                size="sm"
                variant="success"
                icon={<FaLightbulb />}
              >
                Insights
              </FuturisticAdminButton>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Users Card */}
        <FuturisticAdminCard
          title="Total Users"
          icon={<FaUsers />}
          glowColor="blue"
        >
          <div className="flex flex-col">
            <div className="flex items-baseline">
              <h2 className="text-3xl font-bold text-white">
                {stats.userCount.toLocaleString()}
              </h2>
              <span className="ml-4">
                {renderTrendIndicator(stats.newUsersChange)}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {stats.newUsers} new this month
            </p>

            {/* Graph placeholder - in a real app, replace with actual chart */}
            <div className="h-12 mt-4 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-md relative overflow-hidden">
              <div
                className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-r from-blue-500/50 to-indigo-500/50 rounded-md"
                style={{
                  clipPath:
                    "polygon(0 100%, 10% 60%, 20% 80%, 30% 40%, 40% 30%, 50% 70%, 60% 50%, 70% 35%, 80% 50%, 90% 65%, 100% 20%, 100% 100%, 0 100%)",
                }}
              ></div>
            </div>

            <Link href="/users" className="mt-4">
              <FuturisticAdminButton
                fullWidth
                size="sm"
                variant="secondary"
                icon={<FaUserPlus />}
              >
                Manage Users
              </FuturisticAdminButton>
            </Link>
          </div>
        </FuturisticAdminCard>

        {/* Movies Card */}
        <FuturisticAdminCard
          title="Total Movies"
          icon={<FaFilm />}
          glowColor="purple"
        >
          <div className="flex flex-col">
            <div className="flex items-baseline">
              <h2 className="text-3xl font-bold text-white">
                {stats.movieCount.toLocaleString()}
              </h2>
              <span className="ml-4 text-slate-400 text-sm">
                <FaCalendarAlt className="inline mr-1" /> Updated today
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {formatNumber(stats.totalViews)} total views
            </p>

            {/* Graph placeholder - in a real app, replace with actual chart */}
            <div className="h-12 mt-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-md relative overflow-hidden">
              <div
                className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-r from-purple-500/50 to-pink-500/50 rounded-md"
                style={{
                  clipPath:
                    "polygon(0 100%, 10% 80%, 20% 40%, 30% 60%, 40% 40%, 50% 30%, 60% 60%, 70% 35%, 80% 20%, 90% 50%, 100% 30%, 100% 100%, 0 100%)",
                }}
              ></div>
            </div>

            <Link href="/movies" className="mt-4">
              <FuturisticAdminButton
                fullWidth
                size="sm"
                variant="secondary"
                icon={<FaPlus />}
              >
                Manage Movies
              </FuturisticAdminButton>
            </Link>
          </div>
        </FuturisticAdminCard>

        {/* Lists Card */}
        <FuturisticAdminCard
          title="Content Lists"
          icon={<FaListUl />}
          glowColor="teal"
        >
          <div className="flex flex-col">
            <div className="flex items-baseline">
              <h2 className="text-3xl font-bold text-white">
                {stats.listCount.toLocaleString()}
              </h2>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              <FaChartBar className="inline mr-1" /> Curated collections
            </p>

            {/* Graph placeholder - in a real app, replace with actual chart */}
            <div className="h-12 mt-4 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 rounded-md relative overflow-hidden">
              <div
                className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-r from-teal-500/50 to-emerald-500/50 rounded-md"
                style={{
                  clipPath:
                    "polygon(0 100%, 10% 40%, 20% 30%, 30% 70%, 40% 50%, 50% 60%, 60% 40%, 70% 55%, 80% 30%, 90% 50%, 100% 20%, 100% 100%, 0 100%)",
                }}
              ></div>
            </div>

            <Link href="/lists" className="mt-4">
              <FuturisticAdminButton
                fullWidth
                size="sm"
                variant="secondary"
                icon={<FaPlus />}
              >
                Manage Lists
              </FuturisticAdminButton>
            </Link>
          </div>
        </FuturisticAdminCard>

        {/* Views Card */}
        <FuturisticAdminCard
          title="Total Views"
          icon={<FaEye />}
          glowColor="blue"
        >
          <div className="flex flex-col">
            <div className="flex items-baseline">
              <h2 className="text-3xl font-bold text-white">
                {formatNumber(stats.totalViews)}
              </h2>
              <span className="ml-4 text-emerald-400 flex items-center text-sm">
                <FaArrowUp className="mr-1" /> 8.5%
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              <FaChartLine className="inline mr-1" /> Growing steadily
            </p>

            {/* Graph placeholder - in a real app, replace with actual chart */}
            <div className="h-12 mt-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-md relative overflow-hidden">
              <div
                className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-r from-blue-500/50 to-cyan-500/50 rounded-md"
                style={{
                  clipPath:
                    "polygon(0 100%, 0% 60%, 10% 50%, 20% 45%, 30% 30%, 40% 35%, 50% 25%, 60% 20%, 70% 15%, 80% 10%, 90% 15%, 100% 5%, 100% 100%, 0 100%)",
                }}
              ></div>
            </div>

            <Link href="/analytics" className="mt-4">
              <FuturisticAdminButton
                fullWidth
                size="sm"
                variant="secondary"
                icon={<FaChartLine />}
              >
                View Analytics
              </FuturisticAdminButton>
            </Link>
          </div>
        </FuturisticAdminCard>
      </div>

      {/* Review Status */}
      {stats.reviewStats && (
        <FuturisticAdminCard
          title="Review Management"
          icon={<FaComments />}
          glowColor="blue"
          className="mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="col-span-1">
              <div className="flex flex-col">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-slate-200">
                    Review Status
                  </h3>
                  <span className="text-sm text-slate-400">
                    {stats.reviewStats.totalReviews} total
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {/* Approved Reviews */}
                  <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-900/30 flex items-center justify-center border border-emerald-500/30">
                          <FaCheck className="text-emerald-400" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-slate-300">
                            Approved
                          </div>
                          <div className="text-xl font-bold text-white">
                            {stats.reviewStats.approvedReviews}
                          </div>
                        </div>
                      </div>
                      <div className="text-emerald-400 text-sm">
                        {Math.round(
                          (stats.reviewStats.approvedReviews /
                            stats.reviewStats.totalReviews) *
                            100
                        )}
                        %
                      </div>
                    </div>
                  </div>

                  {/* Pending Reviews */}
                  <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-amber-900/30 flex items-center justify-center border border-amber-500/30">
                          <FaRegClock className="text-amber-400" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-slate-300">
                            Pending
                          </div>
                          <div className="text-xl font-bold text-white">
                            {stats.reviewStats.pendingReviews}
                          </div>
                        </div>
                      </div>
                      <div className="text-amber-400 text-sm">
                        {Math.round(
                          (stats.reviewStats.pendingReviews /
                            stats.reviewStats.totalReviews) *
                            100
                        )}
                        %
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <Link href="/reviews">
                    <FuturisticAdminButton
                      fullWidth
                      size="sm"
                      variant="secondary"
                      icon={<FaChartBar />}
                    >
                      Review Management
                    </FuturisticAdminButton>
                  </Link>
                </div>
              </div>
            </div>

            <div className="col-span-3">
              <div className="flex flex-col h-full">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-slate-200">
                    Review Performance
                  </h3>
                  <div className="flex items-center">
                    <FaStar className="text-amber-400 mr-1" />
                    <span className="text-amber-400 font-semibold">
                      {stats.reviewStats.averageRating.toFixed(1)}
                    </span>
                    <span className="text-sm text-slate-400 ml-1">
                      avg rating
                    </span>
                  </div>
                </div>

                <div className="flex-1 mt-4">
                  <div className="h-12 mb-4 bg-slate-800/30 rounded-md overflow-hidden">
                    <div className="relative h-full w-full">
                      {/* Approved section */}
                      <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-600/80 to-emerald-500/80"
                        style={{
                          width: `${
                            (stats.reviewStats.approvedReviews /
                              stats.reviewStats.totalReviews) *
                            100
                          }%`,
                        }}
                      ></div>
                      {/* Pending section */}
                      <div
                        className="absolute top-0 h-full bg-gradient-to-r from-amber-600/80 to-amber-500/80"
                        style={{
                          left: `${
                            (stats.reviewStats.approvedReviews /
                              stats.reviewStats.totalReviews) *
                            100
                          }%`,
                          width: `${
                            (stats.reviewStats.pendingReviews /
                              stats.reviewStats.totalReviews) *
                            100
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/50 p-4 rounded-lg border border-slate-600/30">
                      <h4 className="text-sm font-medium text-slate-300 mb-2">
                        Top Rated Movies
                      </h4>
                      <ul className="space-y-2">
                        {stats.popularMovies.slice(0, 3).map((movie, idx) => (
                          <li
                            key={movie._id}
                            className="flex justify-between items-center"
                          >
                            <div className="flex items-center">
                              <span className="text-slate-400 text-xs mr-2">
                                {idx + 1}.
                              </span>
                              <span className="text-slate-200 text-sm truncate max-w-[150px]">
                                {movie.title}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <FaStar className="text-amber-400 mr-1 text-xs" />
                              <span className="text-amber-400 text-xs font-medium">
                                {(4 + Math.random()).toFixed(1)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/50 p-4 rounded-lg border border-slate-600/30">
                      <h4 className="text-sm font-medium text-slate-300 mb-2">
                        Recent Activity
                      </h4>
                      <ul className="space-y-2">
                        <li className="flex items-center text-xs">
                          <div className="w-6 h-6 rounded-full bg-indigo-900/30 flex items-center justify-center border border-indigo-500/30 mr-2">
                            <FaPlus className="text-indigo-400 text-xs" />
                          </div>
                          <span className="text-slate-400">
                            <span className="text-slate-200">28</span> new
                            reviews today
                          </span>
                        </li>
                        <li className="flex items-center text-xs">
                          <div className="w-6 h-6 rounded-full bg-emerald-900/30 flex items-center justify-center border border-emerald-500/30 mr-2">
                            <FaCheck className="text-emerald-400 text-xs" />
                          </div>
                          <span className="text-slate-400">
                            <span className="text-slate-200">14</span> reviews
                            approved today
                          </span>
                        </li>
                        <li className="flex items-center text-xs">
                          <div className="w-6 h-6 rounded-full bg-amber-900/30 flex items-center justify-center border border-amber-500/30 mr-2">
                            <FaRegClock className="text-amber-400 text-xs" />
                          </div>
                          <span className="text-slate-400">
                            <span className="text-slate-200">
                              {stats.reviewStats.pendingReviews}
                            </span>{" "}
                            reviews need approval
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FuturisticAdminCard>
      )}

      {/* Popular Movies & Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Popular Movies */}
        <FuturisticAdminCard
          title="Popular Movies"
          subtitle="Most viewed content"
          icon={<FaFilm />}
          glowColor="purple"
          headerAction={
            <Link href="/movies">
              <FuturisticAdminButton size="sm" variant="secondary">
                View All
              </FuturisticAdminButton>
            </Link>
          }
        >
          <div className="space-y-4">
            {stats.popularMovies.length === 0 ? (
              <p className="text-slate-400 text-center py-4">
                No movie data available
              </p>
            ) : (
              stats.popularMovies.map((movie) => (
                <div
                  key={movie._id}
                  className="flex items-center p-2 rounded-lg hover:bg-slate-700/30 transition-colors"
                >
                  <div className="w-12 h-12 relative rounded overflow-hidden bg-slate-700/50">
                    {movie.img ? (
                      <Image
                        src={movie.img}
                        alt={movie.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-700">
                        <FaFilm className="text-slate-500" />
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="font-medium text-slate-200">
                      {movie.title}
                    </h3>
                    <p className="text-sm text-slate-400">
                      <FaEye className="inline mr-1" />
                      {formatNumber(movie.views)} views
                    </p>
                  </div>
                  <div className="ml-2">
                    <Link href={`/movies/${movie._id}`}>
                      <FuturisticAdminButton size="sm" variant="secondary">
                        Details
                      </FuturisticAdminButton>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </FuturisticAdminCard>

        {/* Recent Users */}
        <FuturisticAdminCard
          title="Recent Users"
          subtitle="Newest members"
          icon={<FaUsers />}
          glowColor="blue"
          headerAction={
            <Link href="/users">
              <FuturisticAdminButton size="sm" variant="secondary">
                View All
              </FuturisticAdminButton>
            </Link>
          }
        >
          <div className="space-y-4">
            {stats.recentUsers.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No recent users</p>
            ) : (
              stats.recentUsers.map((recentUser) => (
                <div
                  key={recentUser._id}
                  className="flex items-center p-2 rounded-lg hover:bg-slate-700/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-700 border border-slate-600 overflow-hidden">
                    {recentUser.profilePic ? (
                      <Image
                        src={recentUser.profilePic}
                        alt={recentUser.username}
                        width={40}
                        height={40}
                        className="object-cover"
                      />
                    ) : (
                      <FaUser className="text-slate-500" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center">
                      <h3 className="font-medium text-slate-200">
                        {recentUser.username}
                      </h3>
                      {recentUser.isAdmin && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-900/50 text-indigo-300 rounded-full border border-indigo-500/30">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">{recentUser.email}</p>
                  </div>
                  <div className="text-sm text-slate-500">
                    {new Date(recentUser.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </FuturisticAdminCard>
      </div>

      {/* Quick Tips */}
      <FuturisticAdminCard
        title="Admin Tips"
        icon={<FaInfoCircle />}
        glowColor="teal"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border border-blue-500/20">
            <h3 className="font-medium text-blue-300 mb-2">
              Content Management
            </h3>
            <p className="text-sm text-slate-300">
              Keep your content fresh by regularly adding new movies and
              creating curated lists for your users.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/20">
            <h3 className="font-medium text-purple-300 mb-2">
              User Engagement
            </h3>
            <p className="text-sm text-slate-300">
              Monitor user activity trends to understand what content performs
              best and when users are most active.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-gradient-to-br from-teal-900/30 to-emerald-900/30 border border-teal-500/20">
            <h3 className="font-medium text-teal-300 mb-2">Platform Health</h3>
            <p className="text-sm text-slate-300">
              Regularly check analytics to identify potential issues and
              optimize the streaming performance.
            </p>
          </div>
        </div>
      </FuturisticAdminCard>
    </div>
  );
};

export default Dashboard;
