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
}

const initialEpisodeData: EpisodeData = {
  title: "",
  description: "",
  episodeNumber: 1,
  duration: "",
  thumbnail: "",
  video: "",
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
    if (!episodeData.title || !episodeData.video) {
      setError("Please provide at least a title and video URL");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const headers = {
        token: `Bearer ${user.accessToken}`,
      };

      if (isEdit && episodeId) {
        // Update existing episode
        await axios.put(
          `/api/series/${seriesId}/seasons/${seasonId}/episodes/${episodeId}`,
          episodeData,
          { headers }
        );
        setSuccess("Episode updated successfully");
      } else {
        // Create new episode
        await axios.post(
          `/api/series/${seriesId}/seasons/${seasonId}/episodes`,
          episodeData,
          { headers }
        );
        setSuccess("Episode created successfully");
      }

      // Call onSuccess if provided
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

      <FuturisticAdminCard
        title={isEdit ? "Edit Episode" : "Add New Episode"}
        icon={<FaPlay />}
        glowColor="purple"
      >
        <div className="space-y-5">
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
                Duration
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
          </div>

          <div>
            <FileUpload
              onFileUpload={(url) =>
                setEpisodeData({ ...episodeData, video: url })
              }
              label="Episode Video File or URL"
              existingUrl={episodeData.video}
              folder="series/episodes/videos"
              accept="video/*"
            />
            <p className="text-xs text-slate-400 mt-1">
              You can upload a video file or provide a direct link to the video
              source
            </p>
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
    </form>
  );
};

export default EpisodeForm;
