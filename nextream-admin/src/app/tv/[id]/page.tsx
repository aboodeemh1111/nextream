"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import api from "@/services/api";
import Link from "next/link";

interface TVShow {
  _id: string;
  title: string;
  published?: boolean;
  overview?: string;
}
interface Season {
  _id: string;
  seasonNumber: number;
  name?: string;
  published?: boolean;
}
interface Episode {
  _id: string;
  episodeNumber: number;
  title: string;
  published?: boolean;
}

export default function TVShowDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [show, setShow] = useState<TVShow | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newSeasonNumber, setNewSeasonNumber] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Record<string, Episode[]>>({});
  const clientBase =
    process.env.NEXT_PUBLIC_CLIENT_BASE_URL || "http://localhost:3000";
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const [s, seas] = await Promise.all([
        api.get(`/tv/${id}`),
        api.get(`/tv/admin/${id}/seasons`),
      ]);
      setShow(s.data?.show || null);
      setSeasons(seas.data || []);
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to load show");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const createSeason = async () => {
    try {
      setCreating(true);
      await api.post(`/tv/${id}/seasons`, {
        seasonNumber: newSeasonNumber,
        published: true,
      });
      setNewSeasonNumber((n) => n + 1);
      await fetchData();
    } catch (e) {
      // ignore minimal
    } finally {
      setCreating(false);
    }
  };

  const loadEpisodes = async (seasonId: string, seasonNumber?: number) => {
    if (episodes[seasonId]) return;
    try {
      const res = await api.get(`/tv/admin/seasons/${seasonId}/episodes`);
      setEpisodes((prev) => ({ ...prev, [seasonId]: res.data || [] }));
    } catch (err) {
      // Fallback to public published episodes by seasonNumber
      if (seasonNumber != null) {
        try {
          const pub = await api.get(
            `/tv/${id}/seasons/${seasonNumber}/episodes`
          );
          setEpisodes((prev) => ({ ...prev, [seasonId]: pub.data || [] }));
        } catch (e) {
          console.error("Failed to load episodes for season", seasonId, e);
          setEpisodes((prev) => ({ ...prev, [seasonId]: [] }));
        }
      } else {
        setEpisodes((prev) => ({ ...prev, [seasonId]: [] }));
      }
    }
  };

  const addEpisode = async (season: Season) => {
    const title = prompt("Episode title?") || "Episode";
    const num = Number(prompt("Episode number?", "1")) || 1;
    try {
      await api.post(`/tv/${id}/seasons/${season._id}/episodes`, {
        title,
        episodeNumber: num,
        published: true,
      });
      setEpisodes({});
      await loadEpisodes(season._id);
    } catch {}
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : !show ? (
          <div className="text-gray-300">Not found</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">{show.title}</h1>
              <Link
                href="/tv"
                className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700"
              >
                Back
              </Link>
            </div>
            {show.overview && (
              <p className="text-gray-300 max-w-3xl">{show.overview}</p>
            )}

            <div className="bg-gray-950 border border-gray-800 rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Seasons</h2>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-24 px-2 py-1 rounded bg-gray-900 border border-gray-800"
                    value={newSeasonNumber}
                    onChange={(e) => setNewSeasonNumber(Number(e.target.value))}
                  />
                  <button
                    className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                    disabled={creating}
                    onClick={createSeason}
                  >
                    {creating ? "Creating..." : "Add Season"}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {seasons.map((s) => (
                  <div
                    key={s._id}
                    className="p-3 bg-black/30 rounded border border-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Season {s.seasonNumber}</div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-sm px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
                          onClick={() => loadEpisodes(s._id, s.seasonNumber)}
                        >
                          Load episodes
                        </button>
                        <button
                          className="text-sm px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => addEpisode(s)}
                        >
                          Quick add
                        </button>
                        <Link
                          href={`/tv/${id}/seasons/${s._id}/episodes/new`}
                          className="text-sm px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          New episode
                        </Link>
                      </div>
                    </div>
                    {episodes[s._id] && (
                      <ul className="mt-2 divide-y divide-white/10">
                        {episodes[s._id].map((e) => (
                          <li
                            key={e._id}
                            className="py-2 text-sm flex items-center justify-between"
                          >
                            <span>
                              E{e.episodeNumber} — {e.title}
                            </span>
                            <div className="flex items-center gap-3">
                              <button
                                className="text-sm px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
                                onClick={() => {
                                  const url = (e as any)?.videoSources?.[0]
                                    ?.url;
                                  if (url) {
                                    setPreview({
                                      url,
                                      title: `E${e.episodeNumber} — ${e.title}`,
                                    });
                                  } else {
                                    alert(
                                      "No video source found for this episode"
                                    );
                                  }
                                }}
                              >
                                Play
                              </button>
                              <a
                                className="text-red-400 hover:underline"
                                href={`${clientBase}/watch/episode/${e._id}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open
                              </a>
                              <Link
                                className="text-blue-400 hover:underline"
                                href={`/tv/${id}/seasons/${s._id}/episodes/${e._id}`}
                              >
                                Edit
                              </Link>
                            </div>
                          </li>
                        ))}
                        {episodes[s._id].length === 0 && (
                          <li className="py-2 text-gray-400">No episodes</li>
                        )}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {preview && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="bg-gray-950 border border-gray-800 rounded w-[90vw] max-w-4xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-300">{preview.title}</div>
                    <button
                      className="text-gray-400 hover:text-white"
                      onClick={() => setPreview(null)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="w-full">
                    <video controls className="w-full h-auto">
                      <source src={preview.url} />
                    </video>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
