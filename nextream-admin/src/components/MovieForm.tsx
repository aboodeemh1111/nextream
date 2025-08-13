"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import api from "@/services/api";
import FileUpload from "./FileUpload";
import { FaSave, FaTimes, FaSpinner } from "react-icons/fa";

interface MovieFormProps {
  movieId?: string;
  isEdit?: boolean;
}

interface MovieData {
  title: string;
  desc: string;
  img: string;
  imgTitle: string;
  imgSm: string;
  trailer: string;
  video: string;
  year: string;
  limit: number;
  genre: string;
  isSeries: boolean;
  duration: string;
}

const initialMovieData: MovieData = {
  title: "",
  desc: "",
  img: "",
  imgTitle: "",
  imgSm: "",
  trailer: "",
  video: "",
  year: "",
  limit: 0,
  genre: "",
  isSeries: false,
  duration: "",
};

const MovieForm = ({ movieId, isEdit = false }: MovieFormProps) => {
  const [movieData, setMovieData] = useState<MovieData>(initialMovieData);
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isEdit && movieId) {
      const fetchMovie = async () => {
        try {
          setLoading(true);
          const res = await api.get(`/movies/find/${movieId}`, {
            headers: {
              token: `Bearer ${user?.accessToken}`,
            },
          });
          setMovieData(res.data);
        } catch (err) {
          setError("Failed to load movie data");
          console.error(err);
        } finally {
          setLoading(false);
        }
      };

      fetchMovie();
    }
  }, [isEdit, movieId, user]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checkbox = e.target as HTMLInputElement;
      setMovieData({ ...movieData, [name]: checkbox.checked });
    } else if (type === "number") {
      setMovieData({ ...movieData, [name]: parseInt(value) || 0 });
    } else {
      setMovieData({ ...movieData, [name]: value });
    }
  };

  const handleFileUpload = (field: keyof MovieData, url: string) => {
    setMovieData({ ...movieData, [field]: url });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("You must be logged in to perform this action");
      return;
    }

    // Validate required fields
    if (!movieData.title || !movieData.desc || !movieData.img) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      console.log("Submitting movie data:", movieData);

      // Log the headers being sent
      const headers = {
        token: `Bearer ${user.accessToken}`,
      };
      console.log("Request headers:", headers);

      if (isEdit && movieId) {
        // Update existing movie
        const res = await api.put(`/movies/${movieId}`, movieData, {
          headers,
        });
        console.log("Update movie response:", res.data);
        setSuccess("Movie updated successfully");
      } else {
        // Create new movie
        const res = await api.post("/movies", movieData, {
          headers,
        });
        console.log("Create movie response:", res.data);
        setSuccess("Movie created successfully");
        // Reset form after successful creation
        setMovieData(initialMovieData);
      }
    } catch (err: any) {
      console.error("Error saving movie:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to save movie");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6"
          role="alert"
        >
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {success && (
        <div
          className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6"
          role="alert"
        >
          <strong className="font-bold">Success!</strong>
          <span className="block sm:inline"> {success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="mb-4">
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={movieData.title}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              required
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="desc"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="desc"
              name="desc"
              value={movieData.desc}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              required
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="year"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Year
            </label>
            <input
              type="text"
              id="year"
              name="year"
              value={movieData.year}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="genre"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Genre
            </label>
            <select
              id="genre"
              name="genre"
              value={movieData.genre}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
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

          <div className="mb-4">
            <label
              htmlFor="duration"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Duration
            </label>
            <input
              type="text"
              id="duration"
              name="duration"
              value={movieData.duration}
              onChange={handleChange}
              placeholder="e.g. 2h 15min"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="limit"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Age Limit
            </label>
            <input
              type="number"
              id="limit"
              name="limit"
              value={movieData.limit}
              onChange={handleChange}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="isSeries"
                checked={movieData.isSeries}
                onChange={handleChange}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">
                This is a series
              </span>
            </label>
          </div>
        </div>

        <div>
          <FileUpload
            label="Main Image (Poster) *"
            onFileUpload={(url) => handleFileUpload("img", url)}
            accept="image/*"
            folder="images"
            existingUrl={movieData.img}
          />

          <FileUpload
            label="Title Image"
            onFileUpload={(url) => handleFileUpload("imgTitle", url)}
            accept="image/*"
            folder="images"
            existingUrl={movieData.imgTitle}
          />

          <FileUpload
            label="Thumbnail Image"
            onFileUpload={(url) => handleFileUpload("imgSm", url)}
            accept="image/*"
            folder="images"
            existingUrl={movieData.imgSm}
          />

          <FileUpload
            label="Trailer"
            onFileUpload={(url) => handleFileUpload("trailer", url)}
            accept="video/*"
            folder="trailers"
            existingUrl={movieData.trailer}
          />

          <FileUpload
            label="Video"
            onFileUpload={(url) => handleFileUpload("video", url)}
            accept="video/*"
            folder="videos"
            existingUrl={movieData.video}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-4 mt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <FaTimes className="-ml-1 mr-2 h-4 w-4" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <FaSpinner className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Saving...
            </>
          ) : (
            <>
              <FaSave className="-ml-1 mr-2 h-4 w-4" />
              {isEdit ? "Update Movie" : "Create Movie"}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default MovieForm;
