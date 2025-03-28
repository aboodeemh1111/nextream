"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import FuturisticAdminCard from "./FuturisticAdminCard";
import FuturisticAdminButton from "./FuturisticAdminButton";
import { FaSave, FaTimes, FaPlay, FaFilm } from "react-icons/fa";
import FileUpload from "./FileUpload";

interface EpisodeFormProps {
  seriesId: string;
  seasonId: string;
  episodeId?: string;
  episodeNumber?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  isEdit?: boolean;
}

interface EpisodeData {
  title: string;
  description: string;
  episodeNumber: number;
  duration: string;
  thumbnail: string;
  video: string;
  trailer: string;
  releaseDate: string;
  director: string;
  isPreview: boolean;
  subtitles: boolean;
  featured: boolean;
}

const initialEpisodeData: EpisodeData = {
  title: "",
  description: "",
  episodeNumber: 1,
  duration: "",
  thumbnail: "",
  video: "",
  trailer: "",
  releaseDate: "",
  director: "",
  isPreview: false,
  subtitles: false,
  featured: false,
};

const EpisodeForm = ({
  seriesId,
  seasonId,
  episodeId,
  episodeNumber = 1,
  onSuccess,
  onCancel,
  isEdit = false,
}: EpisodeFormProps) => {
  const [episodeData, setEpisodeData] = useState<EpisodeData>({
    ...initialEpisodeData,
    episodeNumber: episodeNumber,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user } = useAuth();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "number") {
      setEpisodeData({ ...episodeData, [name]: parseInt(value) || 0 });
    } else {
      setEpisodeData({ ...episodeData, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("You must be logged in to perform this action");
      return;
    }

    // Validate required fields
    if (!episodeData.title) {
      setError("Please provide at least a title for the episode");
      return;
    }

    if (!episodeData.video && !isEdit) {
      setError("Please provide a video URL for the episode");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      // For now, just simulate a successful API call
      console.log("Simulating episode save:", episodeData);

      // Set success state
      setSuccess(
        isEdit ? "Episode updated successfully" : "Episode created successfully"
      );

      // Call onSuccess if provided after a delay to show the success message
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1000);
      }
    } catch (err: any) {
      console.error("Error saving episode:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to save episode");
    } finally {
      setSubmitting(false);
    }
  };

  const getVideoType = (url: string): "youtube" | "mp4" | "other" => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return "youtube";
    } else if (url.toLowerCase().endsWith(".mp4")) {
      return "mp4";
    } else {
      return "other";
    }
  };

  const formatYoutubeUrl = (url: string) => {
    // Convert youtube watch URLs to embed URLs
    return url.replace("watch?v=", "embed/");
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <FuturisticAdminCard
          className="mb-4 border-red-500/50 bg-red-900/20"
          icon={<FaTimes className="text-red-400" />}
          title="Error"
        >
          <p className="text-red-200">{error}</p>
        </FuturisticAdminCard>
      )}

      {success && (
        <FuturisticAdminCard
          className="mb-4 border-emerald-500/50 bg-emerald-900/20"
          icon={<FaSave className="text-emerald-400" />}
          title="Success"
        >
          <p className="text-emerald-200">{success}</p>
        </FuturisticAdminCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FuturisticAdminCard
            title={isEdit ? "Edit Episode" : "Add New Episode"}
            icon={<FaPlay />}
            glowColor="purple"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Episode Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    name="episodeNumber"
                    value={episodeData.episodeNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Duration (e.g. "42 min")
                  </label>
                  <input
                    type="text"
                    name="duration"
                    value={episodeData.duration}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                    placeholder="e.g. 45 min"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Episode Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={episodeData.title}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                  placeholder="Enter episode title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={episodeData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                  placeholder="Brief description of the episode"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Release Date
                  </label>
                  <input
                    type="date"
                    name="releaseDate"
                    value={episodeData.releaseDate}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Director
                  </label>
                  <input
                    type="text"
                    name="director"
                    value={episodeData.director}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                    placeholder="Episode director"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPreview"
                    name="isPreview"
                    checked={episodeData.isPreview}
                    onChange={(e) =>
                      setEpisodeData({
                        ...episodeData,
                        isPreview: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="isPreview"
                    className="ml-2 text-sm text-slate-300"
                  >
                    Free Preview Episode (available without subscription)
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="subtitles"
                    name="subtitles"
                    checked={episodeData.subtitles}
                    onChange={(e) =>
                      setEpisodeData({
                        ...episodeData,
                        subtitles: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="subtitles"
                    className="ml-2 text-sm text-slate-300"
                  >
                    Subtitles Available
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="featured"
                    name="featured"
                    checked={episodeData.featured}
                    onChange={(e) =>
                      setEpisodeData({
                        ...episodeData,
                        featured: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="featured"
                    className="ml-2 text-sm text-slate-300"
                  >
                    Feature this episode (highlighted in series page)
                  </label>
                </div>
              </div>
            </div>
          </FuturisticAdminCard>
        </div>

        <div>
          <FuturisticAdminCard
            title="Media Assets"
            icon={<FaFilm />}
            glowColor="blue"
          >
            <div className="space-y-6">
              <div>
                <FileUpload
                  onFileUpload={(url) =>
                    setEpisodeData({ ...episodeData, thumbnail: url })
                  }
                  label="Episode Thumbnail"
                  existingUrl={episodeData.thumbnail}
                  folder="series/episodes/thumbnails"
                  accept="image/*"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Image shown in episode listings (16:9 ratio recommended)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Episode Video URL <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="video"
                  value={episodeData.video}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                  placeholder="Video URL or upload below"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Direct link to video file or streaming URL
                </p>

                {episodeData.video && (
                  <div className="mt-3 bg-slate-900 p-2 rounded">
                    <p className="text-xs text-slate-400 mb-2">
                      Video Preview:
                    </p>
                    {getVideoType(episodeData.video) === "youtube" ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded">
                        <iframe
                          src={formatYoutubeUrl(episodeData.video)}
                          className="absolute inset-0 w-full h-full"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      </div>
                    ) : getVideoType(episodeData.video) === "mp4" ? (
                      <video
                        src={episodeData.video}
                        controls
                        className="w-full aspect-video rounded"
                      />
                    ) : (
                      <div className="p-3 bg-slate-800 text-slate-400 text-sm rounded">
                        Video URL: {episodeData.video}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4">
                  <FileUpload
                    onFileUpload={(url) =>
                      setEpisodeData({ ...episodeData, video: url })
                    }
                    label="Or Upload Video"
                    existingUrl={""}
                    folder="series/episodes/videos"
                    accept="video/*"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Trailer URL
                </label>
                <input
                  type="text"
                  name="trailer"
                  value={episodeData.trailer}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                  placeholder="Episode trailer URL"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Promotional trailer for this specific episode
                </p>

                {episodeData.trailer && (
                  <div className="mt-3 bg-slate-900 p-2 rounded">
                    <p className="text-xs text-slate-400 mb-2">
                      Trailer Preview:
                    </p>
                    {getVideoType(episodeData.trailer) === "youtube" ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded">
                        <iframe
                          src={formatYoutubeUrl(episodeData.trailer)}
                          className="absolute inset-0 w-full h-full"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      </div>
                    ) : getVideoType(episodeData.trailer) === "mp4" ? (
                      <video
                        src={episodeData.trailer}
                        controls
                        className="w-full aspect-video rounded"
                      />
                    ) : (
                      <div className="p-3 bg-slate-800 text-slate-400 text-sm rounded">
                        Trailer URL: {episodeData.trailer}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <FuturisticAdminButton
                  type="button"
                  variant="secondary"
                  onClick={onCancel}
                >
                  Cancel
                </FuturisticAdminButton>
                <FuturisticAdminButton
                  type="submit"
                  variant="primary"
                  loading={submitting}
                >
                  {isEdit ? "Update Episode" : "Add Episode"}
                </FuturisticAdminButton>
              </div>
            </div>
          </FuturisticAdminCard>
        </div>
      </div>
    </form>
  );
};

export default EpisodeForm;
