"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import api from "@/services/api";
import VideoUploader from "@/components/VideoUploader";
import Link from "next/link";
import Toast from "@/components/Toast";

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

export default function EditShowPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [slug, setSlug] = useState("");
  const [published, setPublished] = useState(false);
  const [poster, setPoster] = useState("");
  const [backdrop, setBackdrop] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [episodes, setEpisodes] = useState<Record<string, Episode[]>>({});
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null
  );
  const [reordering, setReordering] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSeasonNumber, setNewSeasonNumber] = useState<number>(1);
  const [newSeasonNumberInput, setNewSeasonNumberInput] = useState<string>("");
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

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [res, seas] = await Promise.all([
          api.get(`/tv/admin/show/${id}`),
          api.get(`/tv/admin/${id}/seasons`),
        ]);
        const s = res.data || {};
        setTitle(s.title || "");
        setOverview(s.overview || "");
        setSlug(s.slug || "");
        setPublished(!!s.published);
        setPoster(s.poster || "");
        setBackdrop(s.backdrop || "");
        setTrailerUrl(s.trailerUrl || "");
        const list: Season[] = seas.data || [];
        setSeasons(list);
        setOrder(list.map((x) => x._id));
        const next =
          (list.reduce((m, s) => Math.max(m, s.seasonNumber || 0), 0) || 0) + 1;
        setNewSeasonNumber(next);
      } catch (e: any) {
        setError(e.response?.data?.message || "Failed to load show");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload: any = {
        title,
        overview,
        slug: slug || undefined,
        published,
        poster,
        backdrop,
        trailerUrl,
      };
      await api.patch(`/tv/${id}`, payload);
      router.push(`/tv/${id}`);
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const loadEpisodes = async (seasonId: string, seasonNumber?: number) => {
    if (episodes[seasonId]) return;
    try {
      const res = await api.get(`/tv/admin/seasons/${seasonId}/episodes`);
      setEpisodes((prev) => ({ ...prev, [seasonId]: res.data || [] }));
    } catch (err) {
      if (seasonNumber != null) {
        try {
          const pub = await api.get(
            `/tv/${id}/seasons/${seasonNumber}/episodes`
          );
          setEpisodes((prev) => ({ ...prev, [seasonId]: pub.data || [] }));
        } catch (e) {
          setEpisodes((prev) => ({ ...prev, [seasonId]: [] }));
        }
      } else {
        setEpisodes((prev) => ({ ...prev, [seasonId]: [] }));
      }
    }
  };

  const createSeason = async () => {
    try {
      setCreating(true);
      const used = new Set(seasons.map((s) => s.seasonNumber));
      const desired =
        newSeasonNumberInput.trim() === ""
          ? undefined
          : Number(newSeasonNumberInput);
      let number =
        desired && !Number.isNaN(desired) ? desired : newSeasonNumber || 1;
      if (used.has(number)) {
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
      const seas = await api.get(`/tv/admin/${id}/seasons`);
      const list: Season[] = seas.data || [];
      setSeasons(list);
      setOrder(list.map((x) => x._id));
    } catch (e) {
      setToast({ msg: "Failed to create season", type: "error" });
    } finally {
      setCreating(false);
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
      setToast({ msg: "Episode created", type: "success" });
    } catch (e) {
      setToast({ msg: "Failed to create episode", type: "error" });
    }
  };

  const deleteSeason = async (seasonId: string) => {
    if (!confirm("Delete this season and its episodes?")) return;
    try {
      await api.delete(`/tv/admin/seasons/${seasonId}`);
      const seas = await api.get(`/tv/admin/${id}/seasons`);
      const list: Season[] = seas.data || [];
      setSeasons(list);
      setOrder(list.map((x) => x._id));
      setToast({ msg: "Season deleted", type: "success" });
    } catch (e) {
      setToast({ msg: "Failed to delete season", type: "error" });
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
      const seas = await api.get(`/tv/admin/${id}/seasons`);
      const list: Season[] = seas.data || [];
      setSeasons(list);
      setOrder(list.map((x) => x._id));
      setToast({ msg: "Order saved", type: "success" });
    } catch (e) {
      setToast({ msg: "Failed to save order", type: "error" });
    } finally {
      setReordering(false);
    }
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
      const seas = await api.get(`/tv/admin/${id}/seasons`);
      const list: Season[] = seas.data || [];
      setSeasons(list);
      setOrder(list.map((x) => x._id));
      setToast({ msg: "Season updated", type: "success" });
    } catch (e) {
      setToast({ msg: "Failed to update season", type: "error" });
    } finally {
      setSavingSeason(false);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto bg-gray-950 border border-gray-800 rounded p-4 space-y-4">
            <h1 className="text-2xl font-bold">Edit Show</h1>
            {error && (
              <div className="bg-red-100 text-red-700 px-3 py-2 rounded">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm mb-1">Title</label>
              <input
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Overview</label>
              <textarea
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                rows={4}
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Poster</label>
                <VideoUploader
                  storagePathBuilder={(f) =>
                    `shows/${id}/poster-${Date.now()}-${f.name}`
                  }
                  initialUrl={poster}
                  onUploaded={setPoster}
                  accept="image/*"
                />
                {poster && (
                  <img
                    src={poster}
                    className="mt-2 w-32 rounded border border-white/10"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm mb-1">Banner</label>
                <VideoUploader
                  storagePathBuilder={(f) =>
                    `shows/${id}/banner-${Date.now()}-${f.name}`
                  }
                  initialUrl={backdrop}
                  onUploaded={setBackdrop}
                  accept="image/*"
                />
                {backdrop && (
                  <img
                    src={backdrop}
                    className="mt-2 w-full max-w-md rounded border border-white/10"
                  />
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1">Trailer URL</label>
              <input
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                value={trailerUrl}
                onChange={(e) => setTrailerUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Slug</label>
              <input
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="published"
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              <label htmlFor="published">Published</label>
            </div>
            <div className="flex gap-3">
              <button
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                disabled={saving}
                onClick={save}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700"
                onClick={() => router.push(`/tv/${id}`)}
              >
                Cancel
              </button>
            </div>

            <div className="h-px bg-white/10 my-2" />

            <div className="bg-black/20 rounded p-3 border border-white/10">
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
                                  href={`/watch/episode/${e._id}`}
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
                  onClick={saveReorder}
                >
                  {reordering ? "Saving..." : "Save Order"}
                </button>
              </div>
            </div>
          </div>
        )}
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
                <div className="text-xs text-gray-400 mb-1">Poster URL</div>
                <input
                  className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                  value={editFields.poster}
                  onChange={(e) =>
                    setEditFields((f) => ({ ...f, poster: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Banner URL</div>
                <input
                  className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                  value={editFields.backdrop}
                  onChange={(e) =>
                    setEditFields((f) => ({ ...f, backdrop: e.target.value }))
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
