"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import FileUpload from "./FileUpload";
import FuturisticAdminCard from "./FuturisticAdminCard";
import FuturisticAdminButton from "./FuturisticAdminButton";
import FuturisticAdminInput from "./FuturisticAdminInput";
import { FaSave, FaTimes, FaSpinner, FaFilm } from "react-icons/fa";

interface SeriesFormProps {
  seriesId?: string;
  isEdit?: boolean;
}

interface SeriesData {
  title: string;
  desc: string;
  img: string;
  imgTitle: string;
  imgSm: string;
  trailer: string;
  year: string;
  limit: number;
  genre: string;
  status: "ongoing" | "completed" | "cancelled" | "coming soon";
  totalSeasons: number;
}

const initialSeriesData: SeriesData = {
  title: "",
  desc: "",
  img: "",
  imgTitle: "",
  imgSm: "",
  trailer: "",
  year: "",
  limit: 0,
  genre: "",
  status: "ongoing",
  totalSeasons: 1,
};

const SeriesForm = ({ seriesId, isEdit = false }: SeriesFormProps) => {
  const [seriesData, setSeriesData] = useState<SeriesData>(initialSeriesData);
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isEdit && seriesId) {
      const fetchSeries = async () => {
        try {
          setLoading(true);
          const res = await axios.get(`/api/series/find/${seriesId}`, {
            headers: {
              token: `Bearer ${user?.accessToken}`,
            },
          });
          setSeriesData(res.data);
        } catch (err) {
          setError("Failed to load series data");
          console.error(err);
        } finally {
          setLoading(false);
        }
      };

      fetchSeries();
    }
  }, [isEdit, seriesId, user]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checkbox = e.target as HTMLInputElement;
      setSeriesData({ ...seriesData, [name]: checkbox.checked });
    } else if (type === "number") {
      setSeriesData({ ...seriesData, [name]: parseInt(value) || 0 });
    } else {
      setSeriesData({ ...seriesData, [name]: value });
    }
  };

  const handleFileUpload = (field: keyof SeriesData, url: string) => {
    setSeriesData({ ...seriesData, [field]: url });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("You must be logged in to perform this action");
      return;
    }

    // Validate required fields
    if (!seriesData.title || !seriesData.desc || !seriesData.img) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const headers = {
        token: `Bearer ${user.accessToken}`,
      };

      if (isEdit && seriesId) {
        // Update existing series
        const res = await axios.put(`/api/series/${seriesId}`, seriesData, {
          headers,
        });
        setSuccess("Series updated successfully");

        // Navigate to series management page after edit
        setTimeout(() => {
          router.push(`/series/${seriesId}`);
        }, 1500);
      } else {
        // Create new series
        const res = await axios.post("/api/series", seriesData, { headers });
        setSuccess("Series created successfully");

        // Navigate to series management page after creation
        setTimeout(() => {
          router.push(`/series/${res.data._id}`);
        }, 1500);
      }
    } catch (err: any) {
      console.error("Error saving series:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to save series");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 rounded-full border-t-4 border-b-4 border-blue-500 animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-t-4 border-b-4 border-indigo-500 animate-spin animation-delay-500"></div>
        </div>
        <p className="ml-4 text-slate-300">Loading series data...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <FuturisticAdminCard
          className="mb-6 border-red-500/50 bg-red-900/20"
          icon={<FaTimes className="text-red-400" />}
          title="Error"
        >
          <p className="text-red-200">{error}</p>
        </FuturisticAdminCard>
      )}

      {success && (
        <FuturisticAdminCard
          className="mb-6 border-emerald-500/50 bg-emerald-900/20"
          icon={<FaSave className="text-emerald-400" />}
          title="Success"
        >
          <p className="text-emerald-200">{success}</p>
        </FuturisticAdminCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <FuturisticAdminCard
            title="Series Information"
            icon={<FaFilm />}
            glowColor="blue"
          >
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter series title"
                  value={seriesData.title}
                  onChange={(e) =>
                    setSeriesData({ ...seriesData, title: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  name="desc"
                  value={seriesData.desc}
                  onChange={handleChange}
                  rows={5}
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                  placeholder="Enter series description"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Year
                  </label>
                  <input
                    type="text"
                    placeholder="Release year"
                    value={seriesData.year}
                    onChange={(e) =>
                      setSeriesData({ ...seriesData, year: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Age Limit
                  </label>
                  <input
                    type="number"
                    placeholder="Age restriction"
                    value={seriesData.limit.toString()}
                    onChange={(e) =>
                      setSeriesData({
                        ...seriesData,
                        limit: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Genre
                  </label>
                  <select
                    name="genre"
                    value={seriesData.genre}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300"
                  >
                    <option value="">Select Genre</option>
                    <option value="Action">Action</option>
                    <option value="Adventure">Adventure</option>
                    <option value="Comedy">Comedy</option>
                    <option value="Crime">Crime</option>
                    <option value="Drama">Drama</option>
                    <option value="Fantasy">Fantasy</option>
                    <option value="Historical">Historical</option>
                    <option value="Horror">Horror</option>
                    <option value="Romance">Romance</option>
                    <option value="Sci-Fi">Sci-Fi</option>
                    <option value="Thriller">Thriller</option>
                    <option value="Western">Western</option>
                    <option value="Animation">Animation</option>
                    <option value="Documentary">Documentary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={seriesData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300"
                  >
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="coming soon">Coming Soon</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Total Seasons
                </label>
                <input
                  type="number"
                  placeholder="Number of seasons"
                  value={seriesData.totalSeasons.toString()}
                  onChange={(e) =>
                    setSeriesData({
                      ...seriesData,
                      totalSeasons: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                />
              </div>
            </div>
          </FuturisticAdminCard>
        </div>

        <div>
          <FuturisticAdminCard
            title="Media Assets"
            icon={<FaFilm />}
            glowColor="purple"
          >
            <div className="space-y-6">
              <div>
                <FileUpload
                  onFileUpload={(url) => handleFileUpload("img", url)}
                  label="Main Poster Image *"
                  existingUrl={seriesData.img}
                  folder="series/posters"
                  accept="image/*"
                />
              </div>

              <div>
                <FileUpload
                  onFileUpload={(url) => handleFileUpload("imgTitle", url)}
                  label="Title Image"
                  existingUrl={seriesData.imgTitle}
                  folder="series/title-images"
                  accept="image/*"
                />
              </div>

              <div>
                <FileUpload
                  onFileUpload={(url) => handleFileUpload("imgSm", url)}
                  label="Thumbnail Image"
                  existingUrl={seriesData.imgSm}
                  folder="series/thumbnails"
                  accept="image/*"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Trailer URL
                </label>
                <input
                  type="text"
                  placeholder="Enter trailer URL"
                  value={seriesData.trailer}
                  onChange={(e) =>
                    setSeriesData({ ...seriesData, trailer: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                />
              </div>
            </div>
          </FuturisticAdminCard>

          <div className="mt-6 flex justify-end space-x-4">
            <FuturisticAdminButton
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Cancel
            </FuturisticAdminButton>

            <FuturisticAdminButton
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={submitting}
            >
              {isEdit ? "Update Series" : "Create Series"}
            </FuturisticAdminButton>
          </div>
        </div>
      </div>
    </form>
  );
};

export default SeriesForm;
