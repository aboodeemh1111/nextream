"use client";

import React from "react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
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
} from "react-icons/fa";
import Link from "next/link";
import Image from "next/image";

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
}

// Minimal empty state used until backend responds
const EMPTY_STATS: Stats = {
  userCount: 0,
  movieCount: 0,
  listCount: 0,
  totalViews: 0,
  newUsers: 0,
  newUsersChange: 0,
  popularMovies: [],
  recentUsers: [],
};

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const { user } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const response = await api.get("/admin/stats", {
          headers: { token: `Bearer ${user.accessToken}` },
        });
        setStats(response.data || EMPTY_STATS);
      } catch (err: any) {
        console.error(
          "Error fetching dashboard stats:",
          err.response?.data || err.message
        );
        setError(
          "Failed to load dashboard data. " +
            (err.response?.data?.message || err.message)
        );
        setStats(EMPTY_STATS);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-red-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-red-950/40 border-l border-red-700 text-red-300 p-4 rounded"
        role="alert"
      >
        <div className="flex items-center">
          <div className="py-1">
            <FaExclamationTriangle className="h-6 w-6 text-red-400 mr-4" />
          </div>
          <div>
            <p className="font-bold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <p className="text-gray-400 mt-1">
          Welcome back to your admin dashboard
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        {/* Users Card */}
        <div className="bg-gray-950 rounded-lg shadow-sm p-6 border border-gray-800 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Total Users</p>
              <h2 className="text-3xl font-bold text-gray-100 mt-1">
                {stats.userCount.toLocaleString()}
              </h2>
            </div>
            <div className="bg-blue-950/40 p-3 rounded-full">
              <FaUsers className="text-blue-400 text-xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span
              className={`text-sm ${
                stats.newUsersChange >= 0 ? "text-green-400" : "text-red-400"
              } flex items-center font-medium`}
            >
              {stats.newUsersChange >= 0 ? (
                <FaArrowUp className="mr-1" />
              ) : (
                <FaArrowDown className="mr-1" />
              )}
              {Math.abs(stats.newUsersChange).toFixed(1)}%
            </span>
            <span className="text-gray-500 text-sm ml-2">from last month</span>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <Link
              href="/users"
              className="text-blue-400 text-sm hover:underline flex items-center"
            >
              <FaUserPlus className="mr-1" /> Add new user
            </Link>
          </div>
        </div>

        {/* Movies Card */}
        <div className="bg-gray-950 rounded-lg shadow-sm p-6 border border-gray-800 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Total Movies</p>
              <h2 className="text-3xl font-bold text-gray-100 mt-1">
                {stats.movieCount.toLocaleString()}
              </h2>
            </div>
            <div className="bg-red-950/40 p-3 rounded-full">
              <FaFilm className="text-red-400 text-xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-gray-500">
              <FaCalendarAlt className="inline mr-1" /> Last updated today
            </span>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <Link
              href="/movies/new"
              className="text-red-400 text-sm hover:underline flex items-center"
            >
              <FaPlus className="mr-1" /> Add new movie
            </Link>
          </div>
        </div>

        {/* Lists Card */}
        <div className="bg-gray-950 rounded-lg shadow-sm p-6 border border-gray-800 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Total Lists</p>
              <h2 className="text-3xl font-bold text-gray-100 mt-1">
                {stats.listCount.toLocaleString()}
              </h2>
            </div>
            <div className="bg-green-950/40 p-3 rounded-full">
              <FaListUl className="text-green-400 text-xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-gray-500">
              <FaChartBar className="inline mr-1" /> Curated collections
            </span>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <Link
              href="/lists/new"
              className="text-green-400 text-sm hover:underline flex items-center"
            >
              <FaPlus className="mr-1" /> Create new list
            </Link>
          </div>
        </div>

        {/* Views Card */}
        <div className="bg-gray-950 rounded-lg shadow-sm p-6 border border-gray-800 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Total Views</p>
              <h2 className="text-3xl font-bold text-gray-100 mt-1">
                {formatNumber(stats.totalViews)}
              </h2>
            </div>
            <div className="bg-purple-950/40 p-3 rounded-full">
              <FaEye className="text-purple-400 text-xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-gray-500">Across all content</span>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <Link
              href="/analytics"
              className="text-purple-400 text-sm hover:underline flex items-center"
            >
              <FaChartBar className="mr-1" /> View analytics
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-800">
        <ul className="flex flex-wrap -mb-px text-sm font-medium text-center">
          <li className="mr-2">
            <button
              className={`inline-block p-4 rounded-t-lg border-b-2 ${
                activeTab === "overview"
                  ? "text-red-400 border-red-500"
                  : "border-transparent hover:text-gray-300 hover:border-gray-700"
              }`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 rounded-t-lg border-b-2 ${
                activeTab === "popular"
                  ? "text-red-400 border-red-500"
                  : "border-transparent hover:text-gray-300 hover:border-gray-700"
              }`}
              onClick={() => setActiveTab("popular")}
            >
              Popular Content
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 rounded-t-lg border-b-2 ${
                activeTab === "recent"
                  ? "text-red-400 border-red-500"
                  : "border-transparent hover:text-gray-300 hover:border-gray-700"
              }`}
              onClick={() => setActiveTab("recent")}
            >
              Recent Users
            </button>
          </li>
        </ul>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-950 rounded-lg shadow-sm border border-gray-800 text-gray-100">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">
              Platform Overview
            </h2>
            <p className="text-gray-400 mb-6">
              Your streaming platform is performing well. Here's a summary of
              your key metrics.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Popular Movies Preview */}
              <div>
                <h3 className="text-lg font-medium text-gray-100 mb-3">
                  Popular Movies
                </h3>
                {stats.popularMovies.length === 0 ? (
                  <div className="p-4 bg-gray-900 rounded-lg text-center">
                    <p className="text-gray-500">No movie data available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.popularMovies.slice(0, 3).map((movie) => (
                      <div
                        key={movie._id}
                        className="flex items-center p-3 bg-gray-900 rounded-lg"
                      >
                        <div className="flex-shrink-0 h-10 w-10 bg-gray-800 rounded overflow-hidden">
                          {movie.img ? (
                            <Image
                              src={movie.img}
                              alt={movie.title}
                              width={40}
                              height={40}
                              className="object-cover h-full w-full"
                            />
                          ) : (
                            <div className="h-10 w-10 flex items-center justify-center bg-gray-800">
                              <FaFilm className="text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-medium text-gray-100">
                            {movie.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {movie.views.toLocaleString()} views
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {stats.popularMovies.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setActiveTab("popular")}
                      className="text-red-400 text-sm hover:underline"
                    >
                      View all popular content
                    </button>
                  </div>
                )}
              </div>

              {/* Recent Users Preview */}
              <div>
                <h3 className="text-lg font-medium text-gray-100 mb-3">
                  Recent Users
                </h3>
                {stats.recentUsers.length === 0 ? (
                  <div className="p-4 bg-gray-900 rounded-lg text-center">
                    <p className="text-gray-500">No user data available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.recentUsers.slice(0, 3).map((user) => (
                      <div
                        key={user._id}
                        className="flex items-center p-3 bg-gray-900 rounded-lg"
                      >
                        <div className="flex-shrink-0 h-10 w-10 bg-gray-800 rounded-full overflow-hidden flex items-center justify-center">
                          {user.profilePic ? (
                            <Image
                              src={user.profilePic}
                              alt={user.username}
                              width={40}
                              height={40}
                              className="object-cover h-full w-full"
                            />
                          ) : (
                            <FaUsers className="text-gray-500" />
                          )}
                        </div>
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-medium text-gray-100">
                            {user.username}
                          </p>
                          <p className="text-xs text-gray-500">
                            Joined{" "}
                            {new Date(user.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {stats.recentUsers.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setActiveTab("recent")}
                      className="text-red-400 text-sm hover:underline"
                    >
                      View all recent users
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Popular Content Tab */}
        {activeTab === "popular" && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">
              Popular Content
            </h2>
            {stats.popularMovies.length === 0 ? (
              <div className="p-8 text-center">
                <FaFilm className="mx-auto text-gray-600 text-5xl mb-4" />
                <h3 className="text-lg font-medium text-gray-100 mb-2">
                  No movie data available
                </h3>
                <p className="text-gray-500 mb-4">
                  Try adding some movies to see them here
                </p>
                <Link
                  href="/movies/new"
                  className="text-red-400 hover:text-red-300 font-medium"
                >
                  Add a movie
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-800">
                  <thead className="bg-gray-900">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                      >
                        Movie
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                      >
                        Views
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-950 divide-y divide-gray-800">
                    {stats.popularMovies.map((movie) => (
                      <tr key={movie._id} className="hover:bg-gray-900">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gray-800 rounded overflow-hidden">
                              {movie.img ? (
                                <Image
                                  src={movie.img}
                                  alt={movie.title}
                                  width={40}
                                  height={40}
                                  className="object-cover h-full w-full"
                                />
                              ) : (
                                <div className="h-10 w-10 flex items-center justify-center bg-gray-800">
                                  <FaFilm className="text-gray-500" />
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-100">
                                {movie.title}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-400">
                            {movie.views.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/movies/${movie._id}`}
                            className="text-indigo-400 hover:text-indigo-300 mr-4"
                          >
                            View
                          </Link>
                          <Link
                            href={`/movies/edit/${movie._id}`}
                            className="text-indigo-400 hover:text-indigo-300"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Recent Users Tab */}
        {activeTab === "recent" && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">
              Recent Users
            </h2>
            {stats.recentUsers.length === 0 ? (
              <div className="p-8 text-center">
                <FaUsers className="mx-auto text-gray-600 text-5xl mb-4" />
                <h3 className="text-lg font-medium text-gray-100 mb-2">
                  No user data available
                </h3>
                <p className="text-gray-500 mb-4">
                  Users will appear here once they register
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-800">
                  <thead className="bg-gray-900">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                      >
                        User
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                      >
                        Email
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                      >
                        Role
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                      >
                        Joined
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-950 divide-y divide-gray-800">
                    {stats.recentUsers.map((user) => (
                      <tr key={user._id} className="hover:bg-gray-900">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gray-800 rounded-full overflow-hidden flex items-center justify-center">
                              {user.profilePic ? (
                                <Image
                                  className="h-10 w-10 object-cover"
                                  src={user.profilePic}
                                  alt={user.username}
                                  width={40}
                                  height={40}
                                />
                              ) : (
                                <FaUsers className="text-gray-500" />
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-100">
                                {user.username}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-400">
                            {user.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.isAdmin
                                ? "bg-red-950/40 text-red-300"
                                : "bg-green-950/40 text-green-300"
                            }`}
                          >
                            {user.isAdmin ? "Admin" : "User"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-400">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/users/${user._id}`}
                            className="text-indigo-400 hover:text-indigo-300 mr-4"
                          >
                            View
                          </Link>
                          <Link
                            href={`/users/edit/${user._id}`}
                            className="text-indigo-400 hover:text-indigo-300"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Analytics Integration */}
      <div className="bg-gray-950 rounded-lg shadow-sm p-6 mt-8 border border-gray-800">
        <h2 className="text-xl font-semibold mb-4 text-gray-100">
          Analytics Dashboard
        </h2>
        <p className="text-gray-400 mb-4">
          Get detailed insights into user engagement and content performance
          with our comprehensive analytics dashboard. Track metrics like user
          activity, watch time, completion rates, and more.
        </p>
        <Link
          href="/analytics"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <FaChartLine className="mr-2" /> View Analytics Dashboard
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
