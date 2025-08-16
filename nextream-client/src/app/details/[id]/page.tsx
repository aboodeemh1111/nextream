"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import Navbar from "@/components/Navbar";

interface Season {
  _id: string;
  seasonNumber: number;
  name?: string;
}
interface ShowDetails {
  show: { _id: string; title: string; overview?: string };
  seasons: Season[];
}
interface Episode {
  _id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
}

export default function DetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const [details, setDetails] = useState<ShowDetails | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeSeason, setActiveSeason] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/tv/${id}`);
        setDetails(res.data);
        const first = res.data?.seasons?.[0]?.seasonNumber;
        if (first != null) {
          setActiveSeason(first);
          const eps = await axios.get(
            `/api/tv/${id}/seasons/${first}/episodes`
          );
          setEpisodes(eps.data || []);
        }
      } catch (e: any) {
        setError("Failed to load details");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const loadSeason = async (sn: number) => {
    setActiveSeason(sn);
    try {
      const eps = await axios.get(`/api/tv/${id}/seasons/${sn}/episodes`);
      setEpisodes(eps.data || []);
    } catch {}
  };

  return (
    <div className="bg-main min-h-screen">
      <Navbar />
      <div className="container mx-auto px-4 py-8 text-white">
        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div>{error}</div>
        ) : !details ? (
          <div>Not found</div>
        ) : (
          <>
            <h1 className="text-2xl md:text-3xl font-bold">
              {details.show.title}
            </h1>
            {details.show.overview && (
              <p className="text-gray-300 mt-2 max-w-3xl">
                {details.show.overview}
              </p>
            )}

            <div className="mt-6">
              <div className="flex gap-2 flex-wrap">
                {details.seasons.map((s) => (
                  <button
                    key={s._id}
                    className={`px-3 py-1 rounded border ${
                      activeSeason === s.seasonNumber
                        ? "bg-red-600 border-red-600"
                        : "border-white/20"
                    }`}
                    onClick={() => loadSeason(s.seasonNumber)}
                  >
                    Season {s.seasonNumber}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-2">
                {episodes.map((e) => (
                  <a
                    key={e._id}
                    href={`/watch/episode/${e._id}`}
                    className="block p-3 bg-black/40 rounded border border-white/10 hover:bg-black/60"
                  >
                    <div className="font-medium">
                      S{e.seasonNumber} • E{e.episodeNumber} — {e.title}
                    </div>
                  </a>
                ))}
                {episodes.length === 0 && (
                  <div className="text-gray-400">No episodes</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

("use client");

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Image from "next/image";
import {
  FaPlay,
  FaPlus,
  FaCheck,
  FaHeart,
  FaRegHeart,
  FaClock,
  FaRegClock,
  FaStar,
} from "react-icons/fa";
import Link from "next/link";
import RatingStars from "@/components/RatingStars";
import ReviewList from "@/components/ReviewList";

interface Movie {
  _id: string;
  title: string;
  desc: string;
  img: string;
  imgTitle?: string;
  imgSm?: string;
  trailer: string;
  video?: string;
  year?: string;
  limit?: number;
  genre?: string;
  duration?: string;
  isSeries?: boolean;
  avgRating?: number;
  numRatings?: number;
}

interface UserLists {
  myList: boolean;
  favorites: boolean;
  watchlist: boolean;
}

export default function MovieDetails() {
  const { id } = useParams();
  const movieId = Array.isArray(id) ? id[0] : id || "";
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLists, setUserLists] = useState<UserLists>({
    myList: false,
    favorites: false,
    watchlist: false,
  });
  const [updatingList, setUpdatingList] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchMovie = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/movies/find/${movieId}`, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        setMovie(res.data);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load movie details");
      } finally {
        setLoading(false);
      }
    };

    const fetchUserLists = async () => {
      try {
        const res = await axios.get("/api/users/profile", {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });

        const userData = res.data;
        setUserLists({
          myList:
            userData.myList?.some(
              (item: any) => (item._id || item)?.toString() === movieId
            ) || false,
          favorites:
            userData.favorites?.some(
              (item: any) => (item._id || item)?.toString() === movieId
            ) || false,
          watchlist:
            userData.watchlist?.some(
              (item: any) => (item._id || item)?.toString() === movieId
            ) || false,
        });
      } catch (err) {
        console.error("Error fetching user lists:", err);
      }
    };

    fetchMovie();
    fetchUserLists();
  }, [movieId, user, router]);

  const handleListUpdate = async (
    listType: "myList" | "favorites" | "watchlist"
  ) => {
    if (!user || !movie) return;

    try {
      setUpdatingList(listType);
      const isAdding = !userLists[listType];
      const headers = { token: `Bearer ${user.accessToken}` };
      if (listType === "myList") {
        if (isAdding) {
          await axios.post("/api/users/mylist", { movieId }, { headers });
        } else {
          await axios.delete(`/api/users/mylist/${movieId}`, { headers });
        }
      } else if (listType === "favorites") {
        if (isAdding) {
          await axios.post("/api/users/favorites", { movieId }, { headers });
        } else {
          await axios.delete(`/api/users/favorites/${movieId}`, { headers });
        }
      } else if (listType === "watchlist") {
        if (isAdding) {
          await axios.post("/api/users/watchlist", { movieId }, { headers });
        } else {
          await axios.delete(`/api/users/watchlist/${movieId}`, { headers });
        }
      }

      setUserLists((prev) => ({
        ...prev,
        [listType]: isAdding,
      }));
    } catch (err) {
      console.error(`Error updating ${listType}:`, err);
    } finally {
      setUpdatingList(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <div className="text-white text-xl mb-4">
          {error || "Movie not found"}
        </div>
        <Link href="/" className="text-red-600 hover:underline">
          Go back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      {/* Hero Section */}
      <div className="relative w-full h-[70vh]">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src={movie.img}
            alt={movie.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent"></div>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-16">
          <h1 className="text-white text-3xl md:text-5xl font-bold mb-4">
            {movie.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 mb-4">
            {movie.year && (
              <span className="text-gray-300 text-sm">{movie.year}</span>
            )}
            {movie.limit && (
              <span className="border border-gray-300 text-gray-300 text-xs px-2 py-1 rounded">
                {movie.limit}+
              </span>
            )}
            {movie.duration && (
              <span className="text-gray-300 text-sm">{movie.duration}</span>
            )}
            {movie.genre && (
              <span className="text-gray-300 text-sm">{movie.genre}</span>
            )}
            {movie.isSeries !== undefined && (
              <span className="text-gray-300 text-sm">
                {movie.isSeries ? "Series" : "Movie"}
              </span>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center mb-6">
            {movie.avgRating ? (
              <>
                <RatingStars rating={movie.avgRating} size={20} />
                <span className="text-white ml-2">
                  {movie.avgRating.toFixed(1)}
                </span>
                <span className="text-gray-400 text-sm ml-2">
                  ({movie.numRatings}{" "}
                  {movie.numRatings === 1 ? "review" : "reviews"})
                </span>
              </>
            ) : (
              <span className="text-gray-400 text-sm">No ratings yet</span>
            )}
          </div>

          <p className="text-gray-300 text-sm md:text-base mb-6 max-w-3xl">
            {movie.desc}
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/watch?videoId=${movie._id}`}
              className="bg-red-600 text-white px-6 py-2 rounded flex items-center hover:bg-red-700 transition"
            >
              <FaPlay className="mr-2" /> Play
            </Link>

            <Link
              href={`/watch/${movie._id}`}
              className="bg-gray-700 text-white px-6 py-2 rounded flex items-center hover:bg-gray-600 transition"
            >
              <FaPlay className="mr-2" /> Watch Trailer
            </Link>

            <button
              onClick={() => handleListUpdate("myList")}
              disabled={updatingList === "myList"}
              className={`px-4 py-2 rounded flex items-center transition ${
                userLists.myList
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-700 text-white hover:bg-gray-600"
              }`}
            >
              {updatingList === "myList" ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              ) : userLists.myList ? (
                <FaCheck className="mr-2" />
              ) : (
                <FaPlus className="mr-2" />
              )}
              {userLists.myList ? "Added to My List" : "Add to My List"}
            </button>

            <button
              onClick={() => handleListUpdate("favorites")}
              disabled={updatingList === "favorites"}
              className={`px-4 py-2 rounded flex items-center transition ${
                userLists.favorites
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-700 text-white hover:bg-gray-600"
              }`}
            >
              {updatingList === "favorites" ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              ) : (
                <FaHeart className="mr-2" />
              )}
              {userLists.favorites ? "In Favorites" : "Add to Favorites"}
            </button>

            <button
              onClick={() => handleListUpdate("watchlist")}
              disabled={updatingList === "watchlist"}
              className={`px-4 py-2 rounded flex items-center transition ${
                userLists.watchlist
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-700 text-white hover:bg-gray-600"
              }`}
            >
              {updatingList === "watchlist" ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              ) : (
                <FaClock className="mr-2" />
              )}
              {userLists.watchlist ? "In Watchlist" : "Add to Watchlist"}
            </button>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="container mx-auto px-4 py-12">
        <ReviewList movieId={movieId} />
      </div>
    </div>
  );
}
