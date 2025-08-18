"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import api from "@/services/api";
import Link from "next/link";
import Toast from "@/components/Toast";

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
  poster?: string;
  backdrop?: string;
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
  const [newSeasonNumberInput, setNewSeasonNumberInput] = useState<string>("");
  const [episodes, setEpisodes] = useState<Record<string, Episode[]>>({});
  const clientBase =
    process.env.NEXT_PUBLIC_CLIENT_BASE_URL || "http://localhost:3000";
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null
  );
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [toast, setToast] = useState<{
    msg: string;
    type?: "success" | "error" | "info";
  } | null>(null);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [editFields, setEditFields] = useState({
    name: "",
    poster: "",
    backdrop: "",
    published: false,
  });
  const [savingSeason, setSavingSeason] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [s, seas] = await Promise.all([
        api.get(`/tv/${id}`),
        api.get(`/tv/admin/${id}/seasons`),
      ]);
      setShow(s.data?.show || null);
      setSeasons(seas.data || []);
      setOrder((seas.data || []).map((s: any) => s._id));
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
      // Avoid duplicate numbers locally if possible
      const used = new Set(seasons.map((s) => s.seasonNumber));
      const desired =
        newSeasonNumberInput.trim() === ""
          ? undefined
          : Number(newSeasonNumberInput);
      let number =
        desired && !Number.isNaN(desired) ? desired : newSeasonNumber || 1;
      if (used.has(number)) {
        // find next free number
        let candidate = number + 1;
        while (used.has(candidate)) candidate++;
        number = candidate;
      }
      try {
        await api.post(`/tv/${id}/seasons?auto=1`, {
          seasonNumber: number,
          published: true,
        });
      } catch (err: any) {
        if (err?.response?.status === 409) {
          // Let backend auto-assign: retry with auto flag
          const resp = await api.post(`/tv/${id}/seasons?auto=1`, {
            published: true,
          });
          number = resp?.data?.seasonNumber || number + 1;
        } else {
          throw err;
        }
      }
      setNewSeasonNumber(number + 1);
      setNewSeasonNumberInput("");
      await fetchData();
    } catch (e) {
      console.error("Create season failed", e);
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

  const toggleEpisodePublish = async (seasonId: string, ep: Episode) => {
    try {
      const next = !ep.published;
      await api.patch(`/tv/admin/episodes/${ep._id}`, { published: next });
      setEpisodes((prev) => ({
        ...prev,
        [seasonId]: (prev[seasonId] || []).map((e) =>
          e._id === ep._id ? { ...e, published: next } : e
        ),
      }));
      setToast({
        msg: `Episode ${next ? "published" : "unpublished"}`,
        type: "success",
      });
    } catch (e) {
      setToast({ msg: "Failed to update episode", type: "error" });
    }
  };

  const deleteEpisode = async (seasonId: string, episodeId: string) => {
    if (!confirm("Delete this episode?")) return;
    try {
      await api.delete(`/tv/admin/episodes/${episodeId}`);
      setEpisodes((prev) => ({
        ...prev,
        [seasonId]: (prev[seasonId] || []).filter((e) => e._id !== episodeId),
      }));
      setToast({ msg: "Episode deleted", type: "success" });
    } catch (e) {
      setToast({ msg: "Failed to delete episode", type: "error" });
    }
  };

  const openEditSeason = (s: Season) => {
    setEditingSeason(s);
    setEditFields({
      name: s.name || "",
      poster: s.poster || "",
      backdrop: s.backdrop || "",
      published: Boolean(s.published),
    });
  };

  const saveSeason = async () => {
    if (!editingSeason) return;
    try {
      setSavingSeason(true);
      await api.patch(`/tv/admin/seasons/${editingSeason._id}`, {
        name: editFields.name || undefined,
        poster: editFields.poster || undefined,
        backdrop: editFields.backdrop || undefined,
        published: editFields.published,
      });
      setEditingSeason(null);
      await fetchData();
      setToast({ msg: "Season updated", type: "success" });
    } catch (e) {
      setToast({ msg: "Failed to update season", type: "error" });
    } finally {
      setSavingSeason(false);
    }
  };

  const deleteSeason = async (seasonId: string) => {
    if (!confirm("Delete this season and its episodes?")) return;
    try {
      await api.delete(`/tv/admin/seasons/${seasonId}`);
      await fetchData();
      setToast({ msg: "Season deleted", type: "success" });
    } catch (e) {
      setToast({ msg: "Failed to delete season", type: "error" });
      /* ignore */
    }
  };

  const moveSeason = (fromIdx: number, toIdx: number) => {
    setOrder((prev) => {
      const arr = [...prev];
      const [m] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, m);
      return arr;
    });
  };

  const saveReorder = async () => {
    try {
      setReordering(true);
      await api.post(`/tv/admin/${id}/seasons/reorder`, { seasons: order });
      await fetchData();
    } catch {
    } finally {
      setReordering(false);
    }
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
              <div className="flex items-center gap-2">
                <Link
                  href={`/tv/${id}/edit`}
                  className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700"
                >
                  Edit Show
                </Link>
                <Link
                  href="/tv"
                  className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700"
                >
                  Back
                </Link>
              </div>
            </div>
            {show.overview && (
              <p className="text-gray-300 max-w-3xl">{show.overview}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(show as any)?.poster && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Poster</div>
                  <img
                    src={(show as any).poster}
                    alt="Poster"
                    className="w-full max-w-xs rounded border border-white/10"
                  />
                </div>
              )}
              {(show as any)?.backdrop && (
                <div className="md:col-span-2">
                  <div className="text-xs text-gray-400 mb-1">Banner</div>
                  <img
                    src={(show as any).backdrop}
                    alt="Backdrop"
                    className="w-full rounded border border-white/10"
                  />
                </div>
              )}
            </div>

            <div className="bg-gray-950 border border-gray-800 rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Seasons</h2>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-24 px-2 py-1 rounded bg-gray-900 border border-gray-800"
                    value={newSeasonNumberInput}
                    placeholder={String(newSeasonNumber)}
                    onChange={(e) => setNewSeasonNumberInput(e.target.value)}
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
                {order.map((sid, idx) => {
                  const s = seasons.find((x) => x._id === sid)!;
                  if (!s) return null;
                  return (
                    <div
                      key={s._id}
                      className="p-3 bg-black/30 rounded border border-white/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          Season {s.seasonNumber}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="text-sm px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
                            disabled={idx === 0}
                            onClick={() => moveSeason(idx, idx - 1)}
                          >
                            ↑
                          </button>
                          <button
                            className="text-sm px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
                            disabled={idx === order.length - 1}
                            onClick={() => moveSeason(idx, idx + 1)}
                          >
                            ↓
                          </button>
                          <button
                            className="text-sm px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
                            onClick={() => loadEpisodes(s._id, s.seasonNumber)}
                          >
                            Load episodes
                          </button>
                          <button
                            className="text-sm px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
                            onClick={() => openEditSeason(s)}
                          >
                            Edit
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
                          <button
                            className="text-sm px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
                            onClick={() => deleteSeason(s._id)}
                          >
                            Delete
                          </button>
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
                                <button
                                  className="text-sm px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
                                  onClick={() => toggleEpisodePublish(s._id, e)}
                                >
                                  {e.published ? "Unpublish" : "Publish"}
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
                                <button
                                  className="text-sm px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => deleteEpisode(s._id, e._id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </li>
                          ))}
                          {episodes[s._id].length === 0 && (
                            <li className="py-2 text-gray-400">No episodes</li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
                  disabled={reordering}
                  onClick={async () => {
                    try {
                      await saveReorder();
                      setToast({ msg: "Order saved", type: "success" });
                    } catch {
                      setToast({ msg: "Failed to save order", type: "error" });
                    }
                  }}
                >
                  {reordering ? "Saving..." : "Save Order"}
                </button>
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

            {editingSeason && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="bg-gray-950 border border-gray-800 rounded w-[90vw] max-w-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-300">
                      Edit Season {editingSeason.seasonNumber}
                    </div>
                    <button
                      className="text-gray-400 hover:text-white"
                      onClick={() => setEditingSeason(null)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Name</div>
                      <input
                        className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                        value={editFields.name}
                        onChange={(e) =>
                          setEditFields((f) => ({ ...f, name: e.target.value }))
                        }
                        placeholder="e.g. Season 1"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">
                        Poster URL
                      </div>
                      <input
                        className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                        value={editFields.poster}
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            poster: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">
                        Banner URL
                      </div>
                      <input
                        className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                        value={editFields.backdrop}
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            backdrop: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={editFields.published}
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            published: e.target.checked,
                          }))
                        }
                      />
                      Published
                    </label>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700"
                        onClick={() => setEditingSeason(null)}
                        disabled={savingSeason}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                        onClick={saveSeason}
                        disabled={savingSeason}
                      >
                        {savingSeason ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </AdminLayout>
  );
}
