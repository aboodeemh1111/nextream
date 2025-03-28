import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Button, TextField, Grid, Typography, Paper } from "@mui/material";
import { Box } from "@mui/system";

interface SeasonData {
  _id?: string;
  title: string;
  description: string;
  seasonNumber: number;
  year: string;
  poster: string;
  episodes?: number;
  seriesId?: string;
}

interface SeasonFormProps {
  initialData: SeasonData;
  seriesId: string;
  user: any;
  onSave: () => void;
  onClose: () => void;
  isEdit: boolean;
}

const SeasonForm: React.FC<SeasonFormProps> = ({
  initialData,
  seriesId,
  user,
  onSave,
  onClose,
  isEdit,
}) => {
  const [season, setSeason] = useState<SeasonData>(initialData);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSeason((prev) => ({
      ...prev,
      [name]: name === "seasonNumber" ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!season.title || !season.seasonNumber) {
      setError("Title and season number are required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      if (isEdit && season._id) {
        // Update existing season
        await axios.put(`/api/seasons/${season._id}`, season, {
          headers: { token: `Bearer ${user?.accessToken}` },
        });
        toast.success("Season updated successfully!");
      } else {
        // Add new season
        await axios.post(
          "/api/seasons",
          {
            ...season,
            seriesId: seriesId,
          },
          {
            headers: { token: `Bearer ${user?.accessToken}` },
          }
        );
        toast.success("Season added successfully!");
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error("Error saving season:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to save season");
      toast.error(err.response?.data?.message || "Failed to save season");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: "800px", margin: "0 auto" }}>
      <Typography variant="h5" component="h2" gutterBottom>
        {isEdit ? "Edit Season" : "Add New Season"}
      </Typography>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "24px" }}>
          <div style={{ flex: "1 1 calc(50% - 12px)", minWidth: "250px" }}>
            <TextField
              required
              fullWidth
              label="Title"
              name="title"
              value={season.title}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
          <div style={{ flex: "1 1 calc(50% - 12px)", minWidth: "250px" }}>
            <TextField
              required
              fullWidth
              label="Season Number"
              name="seasonNumber"
              type="number"
              value={season.seasonNumber}
              onChange={handleChange}
              disabled={loading}
              inputProps={{ min: 1 }}
            />
          </div>
          <div style={{ width: "100%" }}>
            <TextField
              fullWidth
              label="Description"
              name="description"
              value={season.description}
              onChange={handleChange}
              disabled={loading}
              multiline
              rows={4}
            />
          </div>
          <div style={{ flex: "1 1 calc(50% - 12px)", minWidth: "250px" }}>
            <TextField
              fullWidth
              label="Year"
              name="year"
              value={season.year}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
          <div style={{ flex: "1 1 calc(50% - 12px)", minWidth: "250px" }}>
            <TextField
              fullWidth
              label="Poster URL"
              name="poster"
              value={season.poster}
              onChange={handleChange}
              disabled={loading}
              placeholder="https://example.com/poster.jpg"
            />
          </div>

          {season.poster && (
            <div style={{ width: "100%" }}>
              <Box sx={{ textAlign: "center", mt: 2 }}>
                <img
                  src={season.poster}
                  alt="Season Poster Preview"
                  style={{ maxHeight: "200px", maxWidth: "100%" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://via.placeholder.com/300x450?text=No+Image";
                  }}
                />
              </Box>
            </div>
          )}

          <div
            style={{
              width: "100%",
              marginTop: "16px",
              display: "flex",
              justifyContent: "flex-end",
              gap: "16px",
            }}
          >
            <Button variant="outlined" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
            >
              {loading ? "Saving..." : isEdit ? "Update Season" : "Add Season"}
            </Button>
          </div>
        </div>
      </form>
    </Paper>
  );
};

export default SeasonForm;
