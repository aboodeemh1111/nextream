"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import Link from "next/link";
import Image from "next/image";
import {
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaFilm,
  FaSortAmountDown,
  FaSortAmountUp,
  FaFilter,
  FaTimesCircle,
  FaExclamationTriangle,
  FaSpinner,
} from "react-icons/fa";
import FuturisticAdminCard from "@/components/FuturisticAdminCard";
import FuturisticAdminButton from "@/components/FuturisticAdminButton";
import AdminLayout from "@/components/AdminLayout";

interface Series {
  _id: string;
  title: string;
  img: string;
  year: string;
  genre: string;
  status: string;
  totalSeasons: number;
  createdAt: string;
}

export default function SeriesList() {
  const [series, setSeries] = useState<Series[]>([]);
  const [filteredSeries, setFilteredSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof Series>("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterGenre, setFilterGenre] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [genres, setGenres] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([
    "ongoing",
    "completed",
    "cancelled",
    "coming soon",
  ]);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchSeries = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const res = await axios.get("/api/movies?type=series", {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });

        if (Array.isArray(res.data)) {
          setSeries(res.data);
          setFilteredSeries(res.data);

          // Extract unique genres from the data
          const uniqueGenres = Array.from(
            new Set(res.data.map((s: Series) => s.genre))
          ).filter(Boolean) as string[];
          setGenres(uniqueGenres);
        } else {
          setError("Invalid response format");
        }
      } catch (err: any) {
        console.error(
          "Error fetching series:",
          err.response?.data || err.message
        );
        setError(err.response?.data?.message || "Failed to load series");

        // For demo purposes, set some sample data if API fails
        const sampleData: Series[] = [
          {
            _id: "1",
            title: "Stranger Things",
            img: "https://via.placeholder.com/300x450?text=Stranger+Things",
            year: "2016",
            genre: "Sci-Fi",
            status: "ongoing",
            totalSeasons: 4,
            createdAt: new Date().toISOString(),
          },
          {
            _id: "2",
            title: "Breaking Bad",
            img: "https://via.placeholder.com/300x450?text=Breaking+Bad",
            year: "2008",
            genre: "Drama",
            status: "completed",
            totalSeasons: 5,
            createdAt: new Date().toISOString(),
          },
          {
            _id: "3",
            title: "The Mandalorian",
            img: "https://via.placeholder.com/300x450?text=Mandalorian",
            year: "2019",
            genre: "Sci-Fi",
            status: "ongoing",
            totalSeasons: 3,
            createdAt: new Date().toISOString(),
          },
        ];
        setSeries(sampleData);
        setFilteredSeries(sampleData);
        setGenres(["Drama", "Sci-Fi", "Action", "Comedy", "Fantasy"]);
      } finally {
        setLoading(false);
      }
    };

    fetchSeries();
  }, [user]);

  useEffect(() => {
    // Apply filters, search, and sorting whenever their values change
    let result = [...series];

    // Apply search filter
    if (searchTerm) {
      result = result.filter((s) =>
        s.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply genre filter
    if (filterGenre) {
      result = result.filter((s) => s.genre === filterGenre);
    }

    // Apply status filter
    if (filterStatus) {
      result = result.filter((s) => s.status === filterStatus);
    }

    // Apply sorting
    result.sort((a, b) => {
      let valA = a[sortField] || "";
      let valB = b[sortField] || "";

      // Handle numeric values for sorting
      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      // Handle string values for sorting
      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return 0;
    });

    setFilteredSeries(result);
  }, [series, searchTerm, sortField, sortOrder, filterGenre, filterStatus]);

  const handleSort = (field: keyof Series) => {
    setSortOrder((prevOrder) =>
      sortField === field ? (prevOrder === "asc" ? "desc" : "asc") : "asc"
    );
    setSortField(field);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setFilterGenre("");
    setFilterStatus("");
    setSortField("title");
    setSortOrder("asc");
  };

  const deleteSeries = async (id: string) => {
    if (!confirm("Are you sure you want to delete this series?")) return;

    try {
      await axios.delete(`/api/movies/${id}`, {
        headers: { token: `Bearer ${user?.accessToken}` },
      });

      // Remove the deleted series from state
      setSeries((prevSeries) => prevSeries.filter((s) => s._id !== id));
    } catch (err: any) {
      console.error(
        "Error deleting series:",
        err.response?.data || err.message
      );
      alert(
        "Failed to delete series: " +
          (err.response?.data?.message || err.message)
      );
    }
  };

  return (
    <AdminLayout>
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
              TV Series Management
            </h1>
            <p className="text-slate-400 mt-1">
              Manage your series, seasons, and episodes
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link href="/series/new">
              <FuturisticAdminButton variant="primary" icon={<FaPlus />}>
                Add New Series
              </FuturisticAdminButton>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <FuturisticAdminCard
          className="mb-6 border-red-500/50 bg-red-900/20"
          icon={<FaExclamationTriangle className="text-red-400" />}
          title="Error Loading Series"
        >
          <p className="text-red-200">{error}</p>
          <div className="mt-4">
            <FuturisticAdminButton
              variant="secondary"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Try Again
            </FuturisticAdminButton>
          </div>
        </FuturisticAdminCard>
      )}

      {/* Filters and Search */}
      <FuturisticAdminCard
        className="mb-6"
        icon={<FaFilter />}
        title="Search & Filters"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400 pl-12"
              />
              <FaSearch className="absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <FaTimesCircle />
                </button>
              )}
            </div>
          </div>

          <div>
            <select
              value={filterGenre}
              onChange={(e) => setFilterGenre(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300"
            >
              <option value="">All Genres</option>
              {genres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300"
            >
              <option value="">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status
                    ? status.charAt(0).toUpperCase() + status.slice(1)
                    : "Unknown"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <div className="flex gap-2">
            <button
              onClick={() => handleSort("title")}
              className={`px-3 py-1.5 rounded text-sm ${
                sortField === "title"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              Title {sortField === "title" && (sortOrder === "asc" ? "↑" : "↓")}
            </button>
            <button
              onClick={() => handleSort("year")}
              className={`px-3 py-1.5 rounded text-sm ${
                sortField === "year"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              Year {sortField === "year" && (sortOrder === "asc" ? "↑" : "↓")}
            </button>
            <button
              onClick={() => handleSort("totalSeasons")}
              className={`px-3 py-1.5 rounded text-sm ${
                sortField === "totalSeasons"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              Seasons{" "}
              {sortField === "totalSeasons" &&
                (sortOrder === "asc" ? "↑" : "↓")}
            </button>
          </div>

          {/* Reset filters button */}
          {(searchTerm ||
            filterGenre ||
            filterStatus ||
            sortField !== "title" ||
            sortOrder !== "asc") && (
            <button
              onClick={resetFilters}
              className="px-3 py-1.5 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded text-sm flex items-center"
            >
              <FaTimesCircle className="mr-1" /> Reset Filters
            </button>
          )}
        </div>
      </FuturisticAdminCard>

      {/* Series Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 rounded-full border-t-4 border-b-4 border-blue-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-t-4 border-b-4 border-indigo-500 animate-spin animation-delay-500"></div>
          </div>
          <p className="ml-4 text-slate-300">Loading series data...</p>
        </div>
      ) : filteredSeries.length === 0 ? (
        <FuturisticAdminCard glowColor="blue" className="text-center p-8">
          <div className="flex flex-col items-center justify-center">
            <FaFilm className="text-4xl text-slate-400 mb-4" />
            <h3 className="text-xl text-slate-200 mb-2">No Series Found</h3>
            <p className="text-slate-400 mb-6">
              {searchTerm || filterGenre || filterStatus
                ? "Try adjusting your filters to see more results"
                : "Start by adding your first TV series"}
            </p>
            <Link href="/series/new">
              <FuturisticAdminButton variant="primary" icon={<FaPlus />}>
                Add New Series
              </FuturisticAdminButton>
            </Link>
          </div>
        </FuturisticAdminCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSeries.map((series) => (
            <FuturisticAdminCard
              key={series._id}
              glowColor="purple"
              className="h-full flex flex-col"
            >
              <div className="relative w-full h-56 mb-4 group overflow-hidden rounded-lg">
                <div className="relative w-full h-full">
                  <Image
                    src={
                      series.img ||
                      "https://via.placeholder.com/300x450?text=No+Image"
                    }
                    alt={series.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Overlay with actions */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <div className="space-y-3">
                      <Link href={`/series/${series._id}`}>
                        <FuturisticAdminButton
                          variant="primary"
                          size="sm"
                          fullWidth
                        >
                          Manage Series
                        </FuturisticAdminButton>
                      </Link>
                      <div className="flex space-x-2">
                        <Link
                          href={`/series/edit/${series._id}`}
                          className="flex-1"
                        >
                          <FuturisticAdminButton
                            variant="secondary"
                            size="sm"
                            fullWidth
                            icon={<FaEdit />}
                          >
                            Edit
                          </FuturisticAdminButton>
                        </Link>
                        <FuturisticAdminButton
                          variant="danger"
                          size="sm"
                          icon={<FaTrash />}
                          onClick={() => deleteSeries(series._id)}
                        >
                          Delete
                        </FuturisticAdminButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="font-bold text-lg text-white mb-1">
                {series.title}
              </h3>

              <div className="flex items-center justify-between mt-2 text-sm text-slate-400">
                <div>
                  <span className="inline-block py-1 px-2 bg-slate-800 rounded-full mr-2">
                    {series.year}
                  </span>
                  <span className="inline-block py-1 px-2 bg-slate-800 rounded-full">
                    {series.totalSeasons} Season
                    {series.totalSeasons !== 1 ? "s" : ""}
                  </span>
                </div>
                <span
                  className={`inline-block py-1 px-2 rounded-full text-xs font-medium ${
                    series.status === "ongoing"
                      ? "bg-emerald-900/50 text-emerald-300"
                      : series.status === "completed"
                      ? "bg-blue-900/50 text-blue-300"
                      : series.status === "cancelled"
                      ? "bg-red-900/50 text-red-300"
                      : "bg-amber-900/50 text-amber-300"
                  }`}
                >
                  {series.status
                    ? series.status.charAt(0).toUpperCase() +
                      series.status.slice(1)
                    : "Unknown"}
                </span>
              </div>

              {series.genre && (
                <div className="mt-2 text-sm text-slate-400">
                  <span className="inline-block py-1 px-2 bg-indigo-900/30 text-indigo-300 border border-indigo-500/30 rounded-full">
                    {series.genre}
                  </span>
                </div>
              )}
            </FuturisticAdminCard>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
