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
  tags: string[];
  maturityRating: string;
  releaseDate: string;
  language: string;
  cast: string[];
  director: string;
  isOriginal: boolean;
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
  tags: [],
  maturityRating: "TV-14",
  releaseDate: "",
  language: "English",
  cast: [],
  director: "",
  isOriginal: false,
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
          const res = await axios.get(`/api/movies/find/${seriesId}`, {
            headers: {
              token: `Bearer ${user?.accessToken}`,
            },
          });

          const data = res.data || {};
          setSeriesData({
            ...initialSeriesData,
            ...data,
            tags: data.tags || [],
            cast: data.cast || [],
            totalSeasons: data.totalSeasons || 0,
            limit: data.limit || 0,
          });
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

    // Form validation
    if (!seriesData.title) {
      setError("Series title is required");
      return;
    }

    if (!seriesData.img) {
      setError("Main poster image is required");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const headers = {
        token: `Bearer ${user?.accessToken}`,
      };

      // Add isSeries flag to ensure it's treated as a series
      const seriesPayload = {
        ...seriesData,
        isSeries: true,
      };

      if (isEdit && seriesId) {
        await axios.put(`/api/movies/${seriesId}`, seriesPayload, { headers });
        setSuccess("Series updated successfully");
      } else {
        await axios.post("/api/movies", seriesPayload, { headers });
        setSuccess("Series created successfully");

        // Optional: Reset form after successful creation
        setTimeout(() => {
          setSeriesData(initialSeriesData);
        }, 2000);
      }

      // Navigate to series list after a delay
      setTimeout(() => {
        router.push("/series");
      }, 2000);
    } catch (err: any) {
      console.error("Error saving series:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to save series");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tagsInput = e.target.value;
    const tagsArray = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag);
    setSeriesData({ ...seriesData, tags: tagsArray });
  };

  const handleCastChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const castInput = e.target.value;
    const castArray = castInput
      .split(",")
      .map((actor) => actor.trim())
      .filter((actor) => actor);
    setSeriesData({ ...seriesData, cast: castArray });
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Information */}
        <div className="lg:col-span-2">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    Release Date
                  </label>
                  <input
                    type="date"
                    value={seriesData.releaseDate}
                    onChange={(e) =>
                      setSeriesData({
                        ...seriesData,
                        releaseDate: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Total Seasons
                  </label>
                  <input
                    type="number"
                    placeholder="Number of seasons"
                    value={(seriesData.totalSeasons ?? 0).toString()}
                    onChange={(e) =>
                      setSeriesData({
                        ...seriesData,
                        totalSeasons: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Language
                  </label>
                  <input
                    type="text"
                    placeholder="Main language"
                    value={seriesData.language}
                    onChange={(e) =>
                      setSeriesData({ ...seriesData, language: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Age Limit
                  </label>
                  <input
                    type="number"
                    placeholder="Age restriction"
                    value={(seriesData.limit ?? 0).toString()}
                    onChange={(e) =>
                      setSeriesData({
                        ...seriesData,
                        limit: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Maturity Rating
                  </label>
                  <select
                    value={seriesData.maturityRating}
                    onChange={(e) =>
                      setSeriesData({
                        ...seriesData,
                        maturityRating: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300"
                  >
                    <option value="TV-Y">TV-Y (All Children)</option>
                    <option value="TV-Y7">TV-Y7 (7+ Years)</option>
                    <option value="TV-G">TV-G (General Audience)</option>
                    <option value="TV-PG">TV-PG (Parental Guidance)</option>
                    <option value="TV-14">TV-14 (14+ Years)</option>
                    <option value="TV-MA">TV-MA (Mature Audience)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="action, adventure, mystery"
                    value={seriesData.tags.join(", ")}
                    onChange={handleTagsChange}
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                  />
                  {seriesData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {seriesData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-600/30 text-blue-300 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Original Series
                  </label>
                  <div className="mt-2 flex items-center">
                    <input
                      type="checkbox"
                      id="isOriginal"
                      checked={seriesData.isOriginal}
                      onChange={(e) =>
                        setSeriesData({
                          ...seriesData,
                          isOriginal: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="isOriginal" className="ml-2 text-slate-300">
                      Mark as platform original series
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Cast (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="John Doe, Jane Smith"
                  value={seriesData.cast.join(", ")}
                  onChange={handleCastChange}
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Director
                </label>
                <input
                  type="text"
                  placeholder="Director name"
                  value={seriesData.director}
                  onChange={(e) =>
                    setSeriesData({ ...seriesData, director: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                />
              </div>
            </div>
          </FuturisticAdminCard>
        </div>

        {/* Media Assets */}
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
                <p className="text-xs text-slate-400 mt-1">
                  This is the primary poster shown in browse views (Recommended:
                  500x750px)
                </p>
              </div>

              <div>
                <FileUpload
                  onFileUpload={(url) => handleFileUpload("imgTitle", url)}
                  label="Title Image"
                  existingUrl={seriesData.imgTitle}
                  folder="series/title-images"
                  accept="image/*"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Image with the series title/logo (Recommended: 500x200px)
                </p>
              </div>

              <div>
                <FileUpload
                  onFileUpload={(url) => handleFileUpload("imgSm", url)}
                  label="Thumbnail Image"
                  existingUrl={seriesData.imgSm}
                  folder="series/thumbnails"
                  accept="image/*"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Smaller thumbnail for lists and recommendations (Recommended:
                  300x200px)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Trailer URL
                </label>
                <input
                  type="text"
                  placeholder="YouTube or other video URL"
                  value={seriesData.trailer}
                  onChange={(e) =>
                    setSeriesData({ ...seriesData, trailer: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                />
                {seriesData.trailer && (
                  <div className="mt-3 bg-slate-900 p-2 rounded">
                    <p className="text-xs text-slate-400 mb-2">
                      Trailer Preview:
                    </p>
                    <div className="relative aspect-video w-full overflow-hidden rounded">
                      <iframe
                        src={seriesData.trailer.replace("watch?v=", "embed/")}
                        className="absolute inset-0 w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </FuturisticAdminCard>

          <div className="mt-6 flex justify-end space-x-3">
            <FuturisticAdminButton
              type="button"
              variant="secondary"
              onClick={() => router.push("/series")}
            >
              Cancel
            </FuturisticAdminButton>
            <FuturisticAdminButton
              type="submit"
              variant="primary"
              loading={submitting}
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
