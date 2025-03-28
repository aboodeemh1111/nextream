"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "@/components/Navbar";
import Featured from "@/components/Featured";
import MovieList from "@/components/MovieList";
import SeriesList from "@/components/SeriesList";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface List {
  _id: string;
  title: string;
  type: string;
  genre: string;
}

export default function Home() {
  const [movieLists, setMovieLists] = useState<List[]>([]);
  const [seriesLists, setSeriesLists] = useState<List[]>([]);
  const [genre, setGenre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchLists = async () => {
      try {
        setLoading(true);

        // Fetch movie lists
        const movieRes = await axios.get(
          `/api/lists${genre ? `?genre=${genre}&type=movie` : "?type=movie"}`,
          {
            headers: {
              token: `Bearer ${user?.accessToken}`,
            },
          }
        );
        setMovieLists(movieRes.data);

        // Fetch series lists
        const seriesRes = await axios.get(
          `/api/lists${genre ? `?genre=${genre}&type=series` : "?type=series"}`,
          {
            headers: {
              token: `Bearer ${user?.accessToken}`,
            },
          }
        );
        setSeriesLists(seriesRes.data);
      } catch (err) {
        setError("Failed to load content");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLists();
  }, [genre, user, router]);

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-900">
      <Navbar />
      <Featured />

      <div className="px-4 py-8">
        <div className="mb-6 flex items-center">
          <h2 className="text-white text-2xl font-bold mr-4">Browse</h2>
          <select
            className="bg-black text-white border border-gray-600 rounded p-1"
            onChange={(e) => setGenre(e.target.value)}
            value={genre || ""}
          >
            <option value="">All Genres</option>
            <option value="action">Action</option>
            <option value="comedy">Comedy</option>
            <option value="crime">Crime</option>
            <option value="fantasy">Fantasy</option>
            <option value="historical">Historical</option>
            <option value="horror">Horror</option>
            <option value="romance">Romance</option>
            <option value="sci-fi">Sci-fi</option>
            <option value="thriller">Thriller</option>
            <option value="western">Western</option>
            <option value="animation">Animation</option>
            <option value="drama">Drama</option>
            <option value="documentary">Documentary</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
          </div>
        ) : error ? (
          <div className="text-white text-center py-12">{error}</div>
        ) : (
          <div>
            {/* Featured Series - First in the list for prominence */}
            <div className="mb-10">
              <SeriesList
                title="Popular Series"
                cardSize="large"
                genreFilter={genre || undefined}
                limit={10}
              />
            </div>

            {/* Movie Lists */}
            <div className="space-y-8">
              {movieLists.map((list) => (
                <MovieList
                  key={list._id}
                  listId={list._id}
                  title={list.title}
                  cardSize="medium"
                />
              ))}
            </div>

            {/* Series Lists */}
            <div className="space-y-8 mt-8">
              {seriesLists.map((list) => (
                <SeriesList
                  key={list._id}
                  listId={list._id}
                  title={list.title}
                  cardSize="medium"
                />
              ))}

              {/* Genre-specific Series if we have a genre filter */}
              {genre && (
                <SeriesList
                  title={`${
                    genre ? genre.charAt(0).toUpperCase() + genre.slice(1) : ""
                  } Series`}
                  cardSize="medium"
                  genreFilter={genre}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
