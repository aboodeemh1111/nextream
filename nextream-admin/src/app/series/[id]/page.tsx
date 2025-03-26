"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import Image from "next/image";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import FuturisticAdminCard from "@/components/FuturisticAdminCard";
import FuturisticAdminButton from "@/components/FuturisticAdminButton";
import SeasonForm from "@/components/SeasonForm";
import EpisodeForm from "@/components/EpisodeForm";
import {
  FaArrowLeft,
  FaEdit,
  FaPlus,
  FaTrash,
  FaPlay,
  FaFilm,
  FaListOl,
  FaChevronDown,
  FaChevronUp,
  FaExclamationTriangle,
  FaPlayCircle,
  FaEye,
  FaCalendarAlt,
  FaTag,
} from "react-icons/fa";

interface SeriesDetailProps {
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
  createdAt: string;
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
}

export default function SeriesDetail({ params }: SeriesDetailProps) {
  const { id } = params;
  const { user } = useAuth();
  const router = useRouter();

  const [series, setSeries] = useState<Series | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Record<string, Episode[]>>({});
  const [expandedSeason, setExpandedSeason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI states
  const [addingSeason, setAddingSeason] = useState(false);
  const [editingSeason, setEditingSeason] = useState<string | null>(null);
  const [addingEpisode, setAddingEpisode] = useState<string | null>(null);
  const [editingEpisode, setEditingEpisode] = useState<{
    seasonId: string;
    episodeId: string;
  } | null>(null);

  useEffect(() => {
    const fetchSeriesData = async () => {
      if (!user || !id) return;

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

          // Set the first season as expanded if there are seasons
          if (sortedSeasons.length > 0) {
            setExpandedSeason(sortedSeasons[0]._id);

            // Fetch episodes for the first season
            await fetchEpisodes(sortedSeasons[0]._id);
          }
        }
      } catch (err: any) {
        console.error(
          "Error fetching series data:",
          err.response?.data || err.message
        );
        setError(err.response?.data?.message || "Failed to load series data");

        // For demo purposes, set some sample data
        const demoSeries: Series = {
          _id: id,
          title: "Stranger Things",
          desc: "When a young boy disappears, his mother, a police chief, and his friends must confront terrifying supernatural forces in order to get him back.",
          img: "https://via.placeholder.com/500x750?text=Stranger+Things",
          imgTitle:
            "https://via.placeholder.com/500x200?text=Stranger+Things+Title",
          imgSm:
            "https://via.placeholder.com/300x200?text=Stranger+Things+Thumbnail",
          trailer: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          year: "2016",
          limit: 16,
          genre: "Sci-Fi",
          status: "ongoing",
          totalSeasons: 4,
          createdAt: new Date().toISOString(),
        };
        setSeries(demoSeries);

        const demoSeasons: Season[] = [
          {
            _id: "s1",
            title: "Season 1",
            description: "The first season of Stranger Things",
            seasonNumber: 1,
            year: "2016",
            poster: "https://via.placeholder.com/300x450?text=Season+1",
            episodes: 8,
          },
          {
            _id: "s2",
            title: "Season 2",
            description: "The second season of Stranger Things",
            seasonNumber: 2,
            year: "2017",
            poster: "https://via.placeholder.com/300x450?text=Season+2",
            episodes: 9,
          },
        ];
        setSeasons(demoSeasons);
        setExpandedSeason("s1");

        const demoEpisodes: Record<string, Episode[]> = {
          s1: [
            {
              _id: "e1",
              title: "Chapter One: The Vanishing of Will Byers",
              description:
                "On his way home from a friend's house, young Will sees something terrifying. Nearby, a sinister secret lurks in the depths of a government lab.",
              episodeNumber: 1,
              duration: "47 min",
              thumbnail: "https://via.placeholder.com/300x169?text=S01E01",
              video: "https://example.com/episode1.mp4",
            },
            {
              _id: "e2",
              title: "Chapter Two: The Weirdo on Maple Street",
              description:
                "Lucas, Mike and Dustin try to talk to the girl they found in the woods. Hopper questions an anxious Joyce about an unsettling phone call.",
              episodeNumber: 2,
              duration: "55 min",
              thumbnail: "https://via.placeholder.com/300x169?text=S01E02",
              video: "https://example.com/episode2.mp4",
            },
          ],
        };
        setEpisodes(demoEpisodes);
      } finally {
        setLoading(false);
      }
    };

    fetchSeriesData();
  }, [id, user]);

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
      // No need to set an error as this is a sub-request
    }
  };

  const toggleSeason = async (seasonId: string) => {
    if (expandedSeason === seasonId) {
      setExpandedSeason(null);
    } else {
      setExpandedSeason(seasonId);

      // Fetch episodes if we haven't already
      if (!episodes[seasonId]) {
        await fetchEpisodes(seasonId);
      }
    }
  };

  const deleteSeason = async (seasonId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this season? This will also delete all episodes."
      )
    )
      return;

    try {
      await axios.delete(`/api/series/${id}/seasons/${seasonId}`, {
        headers: { token: `Bearer ${user?.accessToken}` },
      });

      // Remove the deleted season from state
      setSeasons((prev) => prev.filter((s) => s._id !== seasonId));
      // Also remove its episodes
      setEpisodes((prev) => {
        const newEpisodes = { ...prev };
        delete newEpisodes[seasonId];
        return newEpisodes;
      });

      // If the deleted season was expanded, collapse it
      if (expandedSeason === seasonId) {
        setExpandedSeason(null);
      }
    } catch (err: any) {
      console.error(
        "Error deleting season:",
        err.response?.data || err.message
      );
      alert(
        "Failed to delete season: " +
          (err.response?.data?.message || err.message)
      );
    }
  };

  const deleteEpisode = async (seasonId: string, episodeId: string) => {
    if (!confirm("Are you sure you want to delete this episode?")) return;

    try {
      await axios.delete(
        `/api/series/${id}/seasons/${seasonId}/episodes/${episodeId}`,
        {
          headers: { token: `Bearer ${user?.accessToken}` },
        }
      );

      // Remove the deleted episode from state
      setEpisodes((prev) => ({
        ...prev,
        [seasonId]: prev[seasonId].filter((e) => e._id !== episodeId),
      }));
    } catch (err: any) {
      console.error(
        "Error deleting episode:",
        err.response?.data || err.message
      );
      alert(
        "Failed to delete episode: " +
          (err.response?.data?.message || err.message)
      );
    }
  };

  const handleSeasonSuccess = () => {
    // Refresh the seasons list
    const fetchSeasons = async () => {
      try {
        const res = await axios.get(`/api/series/${id}/seasons`, {
          headers: { token: `Bearer ${user?.accessToken}` },
        });
        if (Array.isArray(res.data)) {
          const sortedSeasons = [...res.data].sort(
            (a: Season, b: Season) => a.seasonNumber - b.seasonNumber
          );
          setSeasons(sortedSeasons);
        }
      } catch (err) {
        console.error("Error refreshing seasons:", err);
      }
    };

    fetchSeasons();
    setAddingSeason(false);
    setEditingSeason(null);
  };

  const handleEpisodeSuccess = (seasonId: string) => {
    // Refresh the episodes list for this season
    fetchEpisodes(seasonId);
    setAddingEpisode(null);
    setEditingEpisode(null);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 rounded-full border-t-4 border-b-4 border-blue-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-t-4 border-b-4 border-indigo-500 animate-spin animation-delay-500"></div>
          </div>
          <p className="ml-4 text-slate-300">Loading series data...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error || !series) {
    return (
      <AdminLayout>
        <div className="mb-6">
          <Link
            href="/series"
            className="inline-flex items-center text-slate-400 hover:text-white transition-colors"
          >
            <FaArrowLeft className="mr-2" /> Back to Series
          </Link>
        </div>

        <FuturisticAdminCard
          className="mb-6 border-red-500/50 bg-red-900/20"
          icon={<FaExclamationTriangle className="text-red-400" />}
          title="Error Loading Series"
        >
          <p className="text-red-200">
            {error || "Failed to load series data"}
          </p>
          <div className="mt-4">
            <FuturisticAdminButton
              variant="secondary"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Try Again
            </FuturisticAdminButton>
          </div>
        </FuturisticAdminCard>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Navigation */}
      <div className="mb-6">
        <Link
          href="/series"
          className="inline-flex items-center text-slate-400 hover:text-white transition-colors"
        >
          <FaArrowLeft className="mr-2" /> Back to Series
        </Link>
      </div>

      {/* Series Header */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Poster */}
        <div className="relative h-96 md:h-auto overflow-hidden rounded-xl">
          <Image
            src={
              series.img || "https://via.placeholder.com/500x750?text=No+Image"
            }
            alt={series.title}
            fill
            className="object-cover"
          />
        </div>

        {/* Series Details */}
        <div className="md:col-span-2">
          <FuturisticAdminCard
            title={series.title}
            icon={<FaFilm />}
            glowColor="blue"
            headerAction={
              <Link href={`/series/edit/${id}`}>
                <FuturisticAdminButton
                  variant="secondary"
                  size="sm"
                  icon={<FaEdit />}
                >
                  Edit Series
                </FuturisticAdminButton>
              </Link>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                {series.year && (
                  <div className="flex items-center px-3 py-1 bg-slate-800/50 rounded-full">
                    <FaCalendarAlt className="mr-2 text-slate-400" />
                    <span>{series.year}</span>
                  </div>
                )}
                {series.genre && (
                  <div className="flex items-center px-3 py-1 bg-indigo-900/30 text-indigo-300 border border-indigo-500/30 rounded-full">
                    <FaTag className="mr-2 text-indigo-400" />
                    <span>{series.genre}</span>
                  </div>
                )}
                {series.limit > 0 && (
                  <div className="flex items-center px-3 py-1 bg-red-900/30 text-red-300 border border-red-500/30 rounded-full">
                    <span>{series.limit}+</span>
                  </div>
                )}
                <div
                  className={`flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    series.status === "ongoing"
                      ? "bg-emerald-900/50 text-emerald-300 border border-emerald-500/30"
                      : series.status === "completed"
                      ? "bg-blue-900/50 text-blue-300 border border-blue-500/30"
                      : series.status === "cancelled"
                      ? "bg-red-900/50 text-red-300 border border-red-500/30"
                      : "bg-amber-900/50 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  <span>
                    {series.status.charAt(0).toUpperCase() +
                      series.status.slice(1)}
                  </span>
                </div>
              </div>

              <p className="text-slate-300">{series.desc}</p>

              {series.trailer && (
                <div className="pt-2">
                  <a
                    href={series.trailer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    <FaPlayCircle className="mr-2" /> Watch Trailer
                  </a>
                </div>
              )}
            </div>
          </FuturisticAdminCard>
        </div>
      </div>

      {/* Seasons & Episodes */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Seasons & Episodes</h2>
          {!addingSeason && (
            <FuturisticAdminButton
              variant="primary"
              size="sm"
              icon={<FaPlus />}
              onClick={() => setAddingSeason(true)}
            >
              Add Season
            </FuturisticAdminButton>
          )}
        </div>

        {/* Add Season Form */}
        {addingSeason && (
          <div className="mb-6">
            <SeasonForm
              seriesId={id}
              seasonNumber={
                seasons.length > 0
                  ? Math.max(...seasons.map((s) => s.seasonNumber)) + 1
                  : 1
              }
              onSuccess={handleSeasonSuccess}
              onCancel={() => setAddingSeason(false)}
            />
          </div>
        )}

        {/* Seasons List */}
        {seasons.length === 0 ? (
          <FuturisticAdminCard glowColor="teal" className="text-center p-8">
            <div className="flex flex-col items-center justify-center">
              <FaListOl className="text-4xl text-slate-400 mb-4" />
              <h3 className="text-xl text-slate-200 mb-2">No Seasons Yet</h3>
              <p className="text-slate-400 mb-6">
                Add your first season to start organizing episodes
              </p>
              {!addingSeason && (
                <FuturisticAdminButton
                  variant="primary"
                  icon={<FaPlus />}
                  onClick={() => setAddingSeason(true)}
                >
                  Add First Season
                </FuturisticAdminButton>
              )}
            </div>
          </FuturisticAdminCard>
        ) : (
          <div className="space-y-6">
            {seasons.map((season) => (
              <FuturisticAdminCard
                key={season._id}
                title={`Season ${season.seasonNumber}: ${season.title}`}
                subtitle={season.year}
                icon={<FaListOl />}
                glowColor={expandedSeason === season._id ? "blue" : "default"}
                headerAction={
                  <div className="flex items-center space-x-2">
                    <FuturisticAdminButton
                      variant="secondary"
                      size="sm"
                      icon={<FaEdit />}
                      onClick={() => {
                        setEditingSeason(season._id);
                        setExpandedSeason(season._id);
                      }}
                    >
                      Edit
                    </FuturisticAdminButton>
                    <FuturisticAdminButton
                      variant="danger"
                      size="sm"
                      icon={<FaTrash />}
                      onClick={() => deleteSeason(season._id)}
                    >
                      Delete
                    </FuturisticAdminButton>
                    <button
                      onClick={() => toggleSeason(season._id)}
                      className="ml-2 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      {expandedSeason === season._id ? (
                        <FaChevronUp />
                      ) : (
                        <FaChevronDown />
                      )}
                    </button>
                  </div>
                }
              >
                {/* Edit Season Form */}
                {editingSeason === season._id ? (
                  <SeasonForm
                    seriesId={id}
                    seasonId={season._id}
                    seasonNumber={season.seasonNumber}
                    onSuccess={handleSeasonSuccess}
                    onCancel={() => setEditingSeason(null)}
                    isEdit={true}
                  />
                ) : (
                  <>
                    {/* Season Info */}
                    <div className="flex items-center mb-4">
                      {season.poster && (
                        <div className="relative w-20 h-28 overflow-hidden rounded-lg mr-4">
                          <Image
                            src={season.poster}
                            alt={`Season ${season.seasonNumber}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        {season.description && (
                          <p className="text-slate-300 mb-2">
                            {season.description}
                          </p>
                        )}
                        <div className="flex items-center text-sm text-slate-400">
                          <span className="mr-4">
                            <strong>{episodes[season._id]?.length || 0}</strong>{" "}
                            Episodes
                          </span>
                          <span>
                            <strong>{season.year}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Season Content with Episodes */}
                    {expandedSeason === season._id && (
                      <div className="pt-4 border-t border-slate-700/50">
                        {/* Add Episode Button */}
                        {addingEpisode !== season._id && (
                          <div className="mb-4">
                            <FuturisticAdminButton
                              variant="primary"
                              size="sm"
                              icon={<FaPlus />}
                              onClick={() => setAddingEpisode(season._id)}
                            >
                              Add Episode
                            </FuturisticAdminButton>
                          </div>
                        )}

                        {/* Add Episode Form */}
                        {addingEpisode === season._id && (
                          <div className="mb-6">
                            <EpisodeForm
                              seriesId={id}
                              seasonId={season._id}
                              episodeNumber={
                                episodes[season._id]?.length > 0
                                  ? Math.max(
                                      ...episodes[season._id].map(
                                        (e) => e.episodeNumber
                                      )
                                    ) + 1
                                  : 1
                              }
                              onSuccess={() => handleEpisodeSuccess(season._id)}
                              onCancel={() => setAddingEpisode(null)}
                            />
                          </div>
                        )}

                        {/* Episodes List */}
                        {!episodes[season._id] ||
                        episodes[season._id].length === 0 ? (
                          <div className="bg-slate-800/50 rounded-lg p-6 text-center">
                            <FaPlay className="text-slate-500 text-3xl mx-auto mb-3" />
                            <p className="text-slate-400">
                              No episodes have been added to this season yet.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {episodes[season._id].map((episode) => (
                              <div key={episode._id}>
                                {/* Edit Episode Form */}
                                {editingEpisode?.seasonId === season._id &&
                                editingEpisode?.episodeId === episode._id ? (
                                  <EpisodeForm
                                    seriesId={id}
                                    seasonId={season._id}
                                    episodeId={episode._id}
                                    episodeNumber={episode.episodeNumber}
                                    onSuccess={() =>
                                      handleEpisodeSuccess(season._id)
                                    }
                                    onCancel={() => setEditingEpisode(null)}
                                    isEdit={true}
                                  />
                                ) : (
                                  <div className="flex items-center bg-slate-800/50 p-4 rounded-lg hover:bg-slate-800 transition-colors">
                                    {/* Episode Thumbnail */}
                                    <div className="relative flex-shrink-0 w-32 h-18 bg-slate-900 rounded overflow-hidden mr-4">
                                      {episode.thumbnail ? (
                                        <Image
                                          src={episode.thumbnail}
                                          alt={`Episode ${episode.episodeNumber}`}
                                          fill
                                          className="object-cover"
                                        />
                                      ) : (
                                        <div className="flex items-center justify-center h-full">
                                          <FaPlay className="text-slate-700" />
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-2">
                                        <span className="text-white text-xs px-2 py-1 bg-black/50 rounded">
                                          {episode.duration || "N/A"}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Episode Details */}
                                    <div className="flex-1">
                                      <div className="flex items-center">
                                        <span className="text-blue-400 mr-2">
                                          {episode.episodeNumber}.
                                        </span>
                                        <h4 className="font-medium text-white">
                                          {episode.title}
                                        </h4>
                                      </div>
                                      {episode.description && (
                                        <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                                          {episode.description}
                                        </p>
                                      )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex-shrink-0 flex items-center space-x-2 ml-4">
                                      <FuturisticAdminButton
                                        variant="secondary"
                                        size="sm"
                                        icon={<FaEdit />}
                                        onClick={() =>
                                          setEditingEpisode({
                                            seasonId: season._id,
                                            episodeId: episode._id,
                                          })
                                        }
                                      >
                                        Edit
                                      </FuturisticAdminButton>
                                      <FuturisticAdminButton
                                        variant="danger"
                                        size="sm"
                                        icon={<FaTrash />}
                                        onClick={() =>
                                          deleteEpisode(season._id, episode._id)
                                        }
                                      >
                                        Delete
                                      </FuturisticAdminButton>
                                      {episode.video && (
                                        <a
                                          href={episode.video}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          <FuturisticAdminButton
                                            variant="primary"
                                            size="sm"
                                            icon={<FaEye />}
                                          >
                                            View
                                          </FuturisticAdminButton>
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </FuturisticAdminCard>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
