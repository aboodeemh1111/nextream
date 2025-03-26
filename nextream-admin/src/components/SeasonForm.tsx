"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import FuturisticAdminCard from "./FuturisticAdminCard";
import FuturisticAdminButton from "./FuturisticAdminButton";
import { FaSave, FaTimes, FaListOl } from "react-icons/fa";
import FileUpload from "./FileUpload";

interface SeasonFormProps {
  seriesId: string;
  seasonId?: string;
  seasonNumber?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  isEdit?: boolean;
}

interface SeasonData {
  seasonNumber: number;
  title: string;
  description: string;
  poster: string;
  year: string;
  episodes: number;
}

const initialSeasonData: SeasonData = {
  seasonNumber: 1,
  title: "",
  description: "",
  poster: "",
  year: new Date().getFullYear().toString(),
  episodes: 0,
};

const SeasonForm = ({
  seriesId,
  seasonId,
  seasonNumber = 1,
  onSuccess,
  onCancel,
  isEdit = false,
}: SeasonFormProps) => {
  const [seasonData, setSeasonData] = useState<SeasonData>({
    ...initialSeasonData,
    seasonNumber: seasonNumber,
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
      setSeasonData({ ...seasonData, [name]: parseInt(value) || 0 });
    } else {
      setSeasonData({ ...seasonData, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("You must be logged in to perform this action");
      return;
    }

    // Validate required fields
    if (!seasonData.title) {
      setError("Please provide a season title");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const headers = {
        token: `Bearer ${user.accessToken}`,
      };

      if (isEdit && seasonId) {
        // Update existing season
        await axios.put(
          `/api/series/${seriesId}/seasons/${seasonId}`,
          seasonData,
          { headers }
        );
        setSuccess("Season updated successfully");
      } else {
        // Create new season
        await axios.post(`/api/series/${seriesId}/seasons`, seasonData, {
          headers,
        });
        setSuccess("Season created successfully");
      }

      // Call onSuccess if provided
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1000);
      }
    } catch (err: any) {
      console.error("Error saving season:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to save season");
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
        title={isEdit ? "Edit Season" : "Add New Season"}
        icon={<FaListOl />}
        glowColor="blue"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Season Number
              </label>
              <input
                type="number"
                name="seasonNumber"
                value={seasonData.seasonNumber}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Year Released
              </label>
              <input
                type="text"
                name="year"
                value={seasonData.year}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                placeholder="e.g. 2023"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Season Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={seasonData.title}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
              placeholder="e.g. Summer of Secrets"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={seasonData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
              placeholder="Brief description of the season"
            />
          </div>

          <div>
            <FileUpload
              onFileUpload={(url) =>
                setSeasonData({ ...seasonData, poster: url })
              }
              label="Season Poster"
              existingUrl={seasonData.poster}
              folder="series/seasons"
              accept="image/*"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Total Episodes
              </label>
              <input
                type="number"
                name="episodes"
                value={seasonData.episodes}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-slate-800/80 backdrop-blur-md text-white border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 placeholder:text-slate-400"
                min="0"
              />
              <p className="text-xs text-slate-400 mt-1">
                This is for informational purposes only. Episodes will be added
                separately.
              </p>
            </div>
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
              {isEdit ? "Update Season" : "Add Season"}
            </FuturisticAdminButton>
          </div>
        </div>
      </FuturisticAdminCard>
    </form>
  );
};

export default SeasonForm;
