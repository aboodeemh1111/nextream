"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import {
  FaPlay,
  FaInfoCircle,
  FaChevronDown,
  FaChevronRight,
  FaStar,
  FaCalendarAlt,
  FaCheck,
} from "react-icons/fa";

interface SeriesDetailsProps {
  params: {
    id: string;
  };
}

interface Series {
  _id: string;
  title: string;
  desc: string;
  img: string;
  imgTitle: string;
  imgSm: string;
  trailer: string;
  year: string;
  limit: number;
  genre: string;
  status: string;
  totalSeasons: number;
  tags?: string[];
  maturityRating?: string;
  releaseDate?: string;
  language?: string;
  cast?: string[];
  director?: string;
  isOriginal?: boolean;
}

interface Season {
  _id: string;
  title: string;
  description: string;
  seasonNumber: number;
  year: string;
  poster: string;
  episodes: number;
}

interface Episode {
  _id: string;
  title: string;
  description: string;
  episodeNumber: number;
  duration: string;
  thumbnail: string;
  video: string;
  trailer?: string;
  releaseDate?: string;
  director?: string;
  isPreview?: boolean;
  subtitles?: boolean;
  featured?: boolean;
}

export default function SeriesDetails({ params }: SeriesDetailsProps) {
  const { id } = params;
  const { user } = useAuth();
  const router = useRouter();

  const [series, setSeries] = useState<Series | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Record<string, Episode[]>>({});
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [featuredEpisode, setFeaturedEpisode] = useState<Episode | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchSeriesData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch series details
        const seriesRes = await axios.get(`/api/series/find/${id}`, {
          headers: { token: `Bearer ${user.accessToken}` },
        });
        setSeries(seriesRes.data);

        // Fetch seasons
        const seasonsRes = await axios.get(`/api/series/${id}/seasons`, {
          headers: { token: `Bearer ${user.accessToken}` },
        });

        if (Array.isArray(seasonsRes.data)) {
          const sortedSeasons = [...seasonsRes.data].sort(
            (a: Season, b: Season) => a.seasonNumber - b.seasonNumber
          );
          setSeasons(sortedSeasons);

          // Set the first season as active
          if (sortedSeasons.length > 0) {
            setActiveSeasonId(sortedSeasons[0]._id);

            // Fetch episodes for first season
            await fetchEpisodes(sortedSeasons[0]._id);
          }
        }
      } catch (err: any) {
        console.error(
          "Error fetching series data:",
          err.response?.data || err.message
        );
        setError(err.response?.data?.message || "Failed to load series data");
      } finally {
        setLoading(false);
      }
    };

    fetchSeriesData();
  }, [id, user, router]);

  useEffect(() => {
    // Find a featured episode to display in the hero section
    if (Object.keys(episodes).length > 0) {
      for (const seasonId in episodes) {
        const featuredEp = episodes[seasonId].find((ep) => ep.featured);
        if (featuredEp) {
          setFeaturedEpisode(featuredEp);
          return;
        }
      }

      // If no featured episode, just use the first episode of the first season
      const firstSeasonId = Object.keys(episodes)[0];
      if (episodes[firstSeasonId] && episodes[firstSeasonId].length > 0) {
        setFeaturedEpisode(episodes[firstSeasonId][0]);
      }
    }
  }, [episodes]);

  const fetchEpisodes = async (seasonId: string) => {
    if (!user || !id) return;

    try {
      const episodesRes = await axios.get(
        `/api/series/${id}/seasons/${seasonId}/episodes`,
        {
          headers: { token: `Bearer ${user.accessToken}` },
        }
      );

      if (Array.isArray(episodesRes.data)) {
        setEpisodes((prev) => ({
          ...prev,
          [seasonId]: episodesRes.data.sort(
            (a: Episode, b: Episode) => a.episodeNumber - b.episodeNumber
          ),
        }));
      }
    } catch (err: any) {
      console.error(
        "Error fetching episodes:",
        err.response?.data || err.message
      );
      // Don't set global error for this sub-request
    }
  };

  const handleSeasonChange = async (seasonId: string) => {
    setActiveSeasonId(seasonId);

    // Fetch episodes if we haven't already
    if (!episodes[seasonId]) {
      await fetchEpisodes(seasonId);
    }
  };

  const handlePlayEpisode = (videoUrl: string) => {
    setPlayingVideo(videoUrl);
  };

  const closeVideoPlayer = () => {
    setPlayingVideo(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex justify-center items-center">
        <div className="w-16 h-16 border-t-4 border-b-4 border-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
        <h1 className="text-red-500 text-xl mb-4">Error Loading Series</h1>
        <p className="text-white text-center mb-6">
          {error || "Series not found"}
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const activeSeason = seasons.find((s) => s._id === activeSeasonId);
  const activeEpisodes = activeSeasonId ? episodes[activeSeasonId] || [] : [];

  return (
    <div className="min-h-screen bg-gray-900 overflow-x-hidden">
      <Navbar />

      {/* Video Player Modal */}
      {playingVideo && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex justify-between items-center p-4 bg-gray-900">
            <h3 className="text-white">{series.title}</h3>
            <button
              onClick={closeVideoPlayer}
              className="text-white hover:text-red-500"
            >
              Close
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <video
              src={playingVideo}
              controls
              autoPlay
              className="max-h-full max-w-full"
            />
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative h-[70vh] w-full">
        {/* Background Image */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/80 to-transparent z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent z-10"></div>
          <Image
            src={series.img || series.imgSm}
            alt={series.title}
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Content */}
        <div className="relative z-20 h-full flex flex-col justify-end px-8 pb-16 pt-32">
          {series.imgTitle ? (
            <Image
              src={series.imgTitle}
              alt={series.title}
              width={400}
              height={150}
              className="max-w-md mb-4"
            />
          ) : (
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              {series.title}
            </h1>
          )}

          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-white">
            <span className="bg-red-600 px-2 py-1 rounded">
              {series.maturityRating || `${series.limit}+`}
            </span>
            <span>{series.year}</span>
            <span className="border border-gray-700 px-2 py-1 rounded">
              {series.genre}
            </span>
            {series.status && (
              <span className="text-green-400">{series.status}</span>
            )}
            {series.isOriginal && (
              <span className="bg-blue-600 px-2 py-1 rounded">Original</span>
            )}
          </div>

          <p className="text-white text-lg max-w-2xl mb-6 line-clamp-3">
            {series.desc}
          </p>

          <div className="flex flex-wrap gap-4">
            {featuredEpisode && (
              <button
                onClick={() => handlePlayEpisode(featuredEpisode.video)}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded hover:bg-gray-200"
              >
                <FaPlay /> Play
              </button>
            )}

            {series.trailer && (
              <button
                onClick={() => handlePlayEpisode(series.trailer)}
                className="flex items-center gap-2 px-6 py-3 bg-gray-600/80 text-white rounded hover:bg-gray-700"
              >
                <FaPlay /> Watch Trailer
              </button>
            )}

            <button
              onClick={() => setShowMore(!showMore)}
              className="flex items-center gap-2 px-6 py-3 bg-gray-800/80 text-white rounded hover:bg-gray-700"
            >
              <FaInfoCircle /> More Info
            </button>
          </div>
        </div>
      </div>

      {/* Series Info */}
      {showMore && (
        <div className="px-8 py-8 bg-gray-800/50 text-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">About {series.title}</h2>
            <p className="mb-6">{series.desc}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-gray-400 mb-2">Cast</h3>
                <p>{series.cast?.join(", ") || "Information not available"}</p>
              </div>

              <div>
                <h3 className="text-gray-400 mb-2">Director</h3>
                <p>{series.director || "Information not available"}</p>
              </div>

              <div>
                <h3 className="text-gray-400 mb-2">Genres</h3>
                <p>{series.genre}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {series.tags?.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-700 text-sm rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seasons & Episodes */}
      <div className="px-8 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Episodes</h2>

            {/* Season Selector */}
            {seasons.length > 1 && (
              <div className="relative mb-6">
                <select
                  className="appearance-none w-64 px-4 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:outline-none focus:border-blue-500"
                  value={activeSeasonId || ""}
                  onChange={(e) => handleSeasonChange(e.target.value)}
                >
                  {seasons.map((season) => (
                    <option key={season._id} value={season._id}>
                      {season.title}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <FaChevronDown className="text-gray-400" />
                </div>
              </div>
            )}

            {/* Season Information */}
            {activeSeason && (
              <div className="mb-6">
                <h3 className="text-xl text-white mb-2">
                  {activeSeason.title}
                </h3>
                {activeSeason.description && (
                  <p className="text-gray-300 mb-4">
                    {activeSeason.description}
                  </p>
                )}
                <div className="flex items-center text-sm text-gray-400">
                  <span className="flex items-center mr-4">
                    <FaCalendarAlt className="mr-1" /> {activeSeason.year}
                  </span>
                  <span>{activeEpisodes.length} Episodes</span>
                </div>
              </div>
            )}

            {/* Episodes List */}
            <div className="space-y-4">
              {activeEpisodes.length === 0 ? (
                <div className="text-gray-400 text-center py-8">
                  No episodes available for this season.
                </div>
              ) : (
                activeEpisodes.map((episode) => (
                  <div
                    key={episode._id}
                    className="flex flex-col md:flex-row gap-4 bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors"
                  >
                    {/* Thumbnail */}
                    <div
                      className="relative flex-shrink-0 h-48 md:h-auto md:w-64 bg-gray-900 cursor-pointer"
                      onClick={() => handlePlayEpisode(episode.video)}
                    >
                      {episode.thumbnail ? (
                        <Image
                          src={episode.thumbnail}
                          alt={`Episode ${episode.episodeNumber}`}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <FaPlay className="text-gray-700 text-4xl" />
                        </div>
                      )}

                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                        <FaPlay className="text-white text-4xl" />
                      </div>

                      <div className="absolute bottom-0 right-0 bg-black/70 px-2 py-1 text-white text-sm">
                        {episode.duration || "N/A"}
                      </div>

                      {episode.isPreview && (
                        <div className="absolute top-0 left-0 bg-green-600/90 px-2 py-1 text-white text-xs">
                          Free Preview
                        </div>
                      )}
                    </div>

                    {/* Episode Details */}
                    <div className="flex-1 p-4">
                      <div className="flex justify-between mb-2">
                        <h4 className="font-medium text-white">
                          <span className="text-blue-400 mr-2">
                            {episode.episodeNumber}.
                          </span>
                          {episode.title}
                        </h4>
                        <span className="text-gray-400 text-sm">
                          {episode.duration}
                        </span>
                      </div>

                      <p className="text-gray-300 text-sm mb-4">
                        {episode.description}
                      </p>

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handlePlayEpisode(episode.video)}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          <FaPlay size={12} /> Play
                        </button>

                        {episode.trailer && (
                          <button
                            onClick={() => handlePlayEpisode(episode.trailer!)}
                            className="flex items-center gap-1 px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-600"
                          >
                            Watch Trailer
                          </button>
                        )}

                        {episode.subtitles && (
                          <span className="flex items-center gap-1 px-3 py-1 bg-gray-700 text-white text-sm rounded">
                            <FaCheck size={12} /> Subtitles
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
