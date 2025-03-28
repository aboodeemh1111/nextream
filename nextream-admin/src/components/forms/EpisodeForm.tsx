import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Button,
  TextField,
  Grid,
  Typography,
  Paper,
  FormControlLabel,
  Checkbox,
  Box,
  InputAdornment,
  IconButton,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";

interface EpisodeData {
  _id?: string;
  title: string;
  description: string;
  episodeNumber: number;
  duration: string;
  thumbnail: string;
  video: string;
  trailer?: string;
  releaseDate?: Date | null;
  director?: string;
  isPreview?: boolean;
  subtitles?: boolean;
  featured?: boolean;
  seasonId?: string;
  seriesId?: string;
}

interface EpisodeFormProps {
  initialData: EpisodeData;
  seasonId: string;
  seriesId: string;
  user: any;
  onSave: () => void;
  onClose: () => void;
  isEdit: boolean;
}

const initialEpisodeData: EpisodeData = {
  title: "",
  description: "",
  episodeNumber: 1,
  duration: "",
  thumbnail: "",
  video: "",
  trailer: "",
  releaseDate: new Date(),
  director: "",
  isPreview: false,
  subtitles: false,
  featured: false,
};

// Helper function to get video type
const getVideoType = (url: string): "youtube" | "external" | "none" => {
  if (!url) return "none";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  return "external";
};

// Helper function to format YouTube URL for embedding
const formatYoutubeUrl = (url: string): string => {
  if (!url) return "";

  // Convert youtube.com/watch?v=VIDEO_ID to youtube.com/embed/VIDEO_ID
  if (url.includes("youtube.com/watch")) {
    const videoId = new URL(url).searchParams.get("v");
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  }

  // Convert youtu.be/VIDEO_ID to youtube.com/embed/VIDEO_ID
  if (url.includes("youtu.be")) {
    const videoId = url.split("/").pop();
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  }

  return url;
};

const EpisodeForm: React.FC<EpisodeFormProps> = ({
  initialData,
  seasonId,
  seriesId,
  user,
  onSave,
  onClose,
  isEdit,
}) => {
  const [episodeData, setEpisodeData] = useState<EpisodeData>(
    initialData || initialEpisodeData
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    // Reset preview when URL changes
    setShowPreview(false);
  }, [episodeData.trailer]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setEpisodeData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEpisodeData((prev) => ({
      ...prev,
      [name]: parseInt(value) || 0,
    }));
  };

  const handleDateChange = (date: Date | null) => {
    setEpisodeData((prev) => ({
      ...prev,
      releaseDate: date,
    }));
  };

  const handlePreviewClick = () => {
    const formattedUrl = formatYoutubeUrl(episodeData.trailer || "");
    setPreviewUrl(formattedUrl);
    setShowPreview(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Validate required fields
    if (!episodeData.title) {
      setValidationError("Title is required");
      return;
    }

    if (!episodeData.video && !isEdit) {
      setValidationError("Video URL is required for new episodes");
      return;
    }

    try {
      setIsSubmitting(true);
      setApiError("");
      setValidationError("");

      const dataToSend = {
        ...episodeData,
        seasonId,
        seriesId,
      };

      if (isEdit && episodeData._id) {
        // Update existing episode
        await axios.put(`/api/episodes/${episodeData._id}`, dataToSend, {
          headers: { token: `Bearer ${user?.accessToken}` },
        });
        toast.success("Episode updated successfully!");
      } else {
        // Create new episode
        await axios.post("/api/episodes", dataToSend, {
          headers: { token: `Bearer ${user?.accessToken}` },
        });
        toast.success("Episode created successfully!");
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error("Error saving episode:", err);
      setApiError(
        err.response?.data?.message ||
          "Failed to save episode. Please try again."
      );
      toast.error(
        err.response?.data?.message ||
          "Failed to save episode. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: "900px", margin: "0 auto" }}>
      <Typography variant="h5" component="h2" gutterBottom>
        {isEdit ? "Edit Episode" : "Add New Episode"}
      </Typography>

      {(validationError || apiError) && (
        <Typography color="error" sx={{ mb: 2 }}>
          {validationError || apiError}
        </Typography>
      )}

      <form onSubmit={handleSubmit}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Basic Information */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <Box sx={{ flexGrow: 1, flexBasis: "60%", minWidth: "250px" }}>
              <TextField
                required
                fullWidth
                label="Episode Title"
                name="title"
                value={episodeData.title}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </Box>

            <Box sx={{ flexGrow: 1, flexBasis: "30%", minWidth: "150px" }}>
              <TextField
                required
                fullWidth
                label="Episode Number"
                name="episodeNumber"
                type="number"
                value={episodeData.episodeNumber}
                onChange={handleNumberChange}
                disabled={isSubmitting}
                inputProps={{ min: 1 }}
              />
            </Box>
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Description"
              name="description"
              value={episodeData.description}
              onChange={handleChange}
              disabled={isSubmitting}
              multiline
              rows={4}
            />
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <Box sx={{ flexGrow: 1, flexBasis: "45%", minWidth: "200px" }}>
              <TextField
                fullWidth
                label="Duration (e.g. '45 min')"
                name="duration"
                value={episodeData.duration}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="45 min"
              />
            </Box>

            <Box sx={{ flexGrow: 1, flexBasis: "45%", minWidth: "200px" }}>
              <TextField
                fullWidth
                label="Director"
                name="director"
                value={episodeData.director}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </Box>
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <Box sx={{ flexGrow: 1, flexBasis: "45%", minWidth: "200px" }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Release Date"
                  value={episodeData.releaseDate}
                  onChange={handleDateChange}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      disabled: isSubmitting,
                    },
                  }}
                />
              </LocalizationProvider>
            </Box>

            <Box
              sx={{
                flexGrow: 1,
                flexBasis: "45%",
                minWidth: "200px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={episodeData.isPreview || false}
                    onChange={handleChange}
                    name="isPreview"
                    disabled={isSubmitting}
                  />
                }
                label="Preview Episode"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={episodeData.subtitles || false}
                    onChange={handleChange}
                    name="subtitles"
                    disabled={isSubmitting}
                  />
                }
                label="Has Subtitles"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={episodeData.featured || false}
                    onChange={handleChange}
                    name="featured"
                    disabled={isSubmitting}
                  />
                }
                label="Featured"
              />
            </Box>
          </Box>

          {/* Media Assets */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Media Assets
            </Typography>
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Thumbnail URL"
              name="thumbnail"
              value={episodeData.thumbnail}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="https://example.com/thumbnail.jpg"
            />
          </Box>

          {episodeData.thumbnail && (
            <Box sx={{ textAlign: "center", mt: 1 }}>
              <img
                src={episodeData.thumbnail}
                alt="Episode Thumbnail Preview"
                style={{ maxHeight: "169px", maxWidth: "300px" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://via.placeholder.com/300x169?text=No+Image";
                }}
              />
            </Box>
          )}

          <Box>
            <TextField
              required={!isEdit}
              fullWidth
              label="Video URL"
              name="video"
              value={episodeData.video}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="https://example.com/video.mp4 or https://youtube.com/..."
            />
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Trailer URL (YouTube)"
              name="trailer"
              value={episodeData.trailer}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="https://youtube.com/watch?v=..."
              InputProps={{
                endAdornment: episodeData.trailer ? (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handlePreviewClick}
                      edge="end"
                      title="Preview trailer"
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Box>

          {showPreview && previewUrl && (
            <Box sx={{ mt: 2, mb: 2, textAlign: "center" }}>
              <iframe
                width="560"
                height="315"
                src={previewUrl}
                title="Trailer preview"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </Box>
          )}

          {/* Form Actions */}
          <Box
            sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 2 }}
          >
            <Button
              variant="outlined"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSubmitting}
              startIcon={<PlayArrowIcon />}
            >
              {isSubmitting
                ? "Saving..."
                : isEdit
                ? "Update Episode"
                : "Add Episode"}
            </Button>
          </Box>
        </Box>
      </form>
    </Paper>
  );
};

export default EpisodeForm;
