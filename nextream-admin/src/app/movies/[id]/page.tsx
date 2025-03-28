"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import {
  FaEdit,
  FaTrash,
  FaArrowLeft,
  FaPlay,
  FaFilm,
  FaCalendar,
  FaClock,
  FaTag,
  FaShieldAlt,
} from "react-icons/fa";

interface Movie {
  _id: string;
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
  createdAt: string;
}

export default function MovieDetailsPage() {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const movieId = params.id as string;
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchMovie = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const res = await axios.get(`/api/movies/find/${movieId}`, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        setMovie(res.data);
      } catch (err) {
        setError("Failed to load movie data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMovie();
  }, [movieId, user]);

  const handleDelete = async () => {
    if (!user || !movie) return;

    if (window.confirm(`Are you sure you want to delete "${movie.title}"?`)) {
      try {
        await axios.delete(`/api/movies/${movieId}`, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        router.push("/movies");
      } catch (err) {
        console.error(err);
        alert("Failed to delete movie");
      }
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !movie) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6"
            role="alert"
          >
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline">
              {" "}
              {error || "Movie not found"}
            </span>
          </div>
          <Link
            href="/movies"
            className="text-blue-600 hover:underline flex items-center"
          >
            <FaArrowLeft className="mr-2" /> Back to Movies
          </Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/movies"
            className="text-blue-600 hover:underline flex items-center"
          >
            <FaArrowLeft className="mr-2" /> Back to Movies
          </Link>

          <div className="flex space-x-4">
            <Link
              href={`/movies/edit/${movieId}`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <FaEdit className="mr-2" /> Edit
            </Link>
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <FaTrash className="mr-2" /> Delete
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Hero Section */}
          <div className="relative h-64 md:h-96">
            <Image
              src={movie.img}
              alt={movie.title}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>

            <div className="absolute bottom-0 left-0 p-6">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                {movie.title}
              </h1>
              <div className="flex flex-wrap items-center text-white gap-4">
                {movie.year && (
                  <div className="flex items-center">
                    <FaCalendar className="mr-1" /> {movie.year}
                  </div>
                )}
                {movie.duration && (
                  <div className="flex items-center">
                    <FaClock className="mr-1" /> {movie.duration}
                  </div>
                )}
                {movie.genre && (
                  <div className="flex items-center">
                    <FaTag className="mr-1" /> {movie.genre}
                  </div>
                )}
                {movie.limit > 0 && (
                  <div className="flex items-center">
                    <FaShieldAlt className="mr-1" /> {movie.limit}+
                  </div>
                )}
                <div className="flex items-center">
                  <FaFilm className="mr-1" />{" "}
                  {movie.isSeries ? "Series" : "Movie"}
                </div>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <h2 className="text-xl font-semibold mb-4">Overview</h2>
                <p className="text-gray-700 mb-6">{movie.desc}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Media Preview Section */}
                  {movie.trailer && (
                    <div>
                      <h3 className="text-lg font-medium mb-2">Trailer</h3>
                      <div className="aspect-video bg-gray-100 rounded-md overflow-hidden relative">
                        {movie.trailer.includes("youtube") ? (
                          <iframe
                            src={movie.trailer}
                            title="Trailer"
                            className="w-full h-full"
                            allowFullScreen
                          ></iframe>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <a
                              href={movie.trailer}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-blue-600 hover:underline"
                            >
                              <FaPlay className="mr-2" /> Play Trailer
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {movie.video && (
                    <div>
                      <h3 className="text-lg font-medium mb-2">Video</h3>
                      <div className="aspect-video bg-gray-100 rounded-md overflow-hidden relative">
                        <div className="flex items-center justify-center h-full">
                          <a
                            href={movie.video}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-blue-600 hover:underline"
                          >
                            <FaPlay className="mr-2" /> Play Video
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">Media</h2>

                <div className="space-y-4">
                  {movie.imgSm && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">
                        Thumbnail Image
                      </h3>
                      <div className="relative h-40 bg-gray-100 rounded-md overflow-hidden">
                        <Image
                          src={movie.imgSm}
                          alt={`${movie.title} thumbnail`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </div>
                  )}

                  {movie.imgTitle && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">
                        Title Image
                      </h3>
                      <div className="relative h-40 bg-gray-100 rounded-md overflow-hidden">
                        <Image
                          src={movie.imgTitle}
                          alt={`${movie.title} title image`}
                          fill
                          className="object-contain"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      Storage URLs
                    </h3>
                    <div className="space-y-2">
                      {movie.img && (
                        <div className="text-xs text-gray-500 truncate">
                          <span className="font-semibold">Main Image:</span>{" "}
                          {movie.img}
                        </div>
                      )}
                      {movie.imgTitle && (
                        <div className="text-xs text-gray-500 truncate">
                          <span className="font-semibold">Title Image:</span>{" "}
                          {movie.imgTitle}
                        </div>
                      )}
                      {movie.imgSm && (
                        <div className="text-xs text-gray-500 truncate">
                          <span className="font-semibold">Thumbnail:</span>{" "}
                          {movie.imgSm}
                        </div>
                      )}
                      {movie.trailer && (
                        <div className="text-xs text-gray-500 truncate">
                          <span className="font-semibold">Trailer:</span>{" "}
                          {movie.trailer}
                        </div>
                      )}
                      {movie.video && (
                        <div className="text-xs text-gray-500 truncate">
                          <span className="font-semibold">Video:</span>{" "}
                          {movie.video}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
