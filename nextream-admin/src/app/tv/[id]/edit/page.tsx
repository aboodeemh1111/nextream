"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import api from "@/services/api";
import VideoUploader from "@/components/VideoUploader";

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

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/tv/admin/show/${id}`);
        const s = res.data || {};
        setTitle(s.title || "");
        setOverview(s.overview || "");
        setSlug(s.slug || "");
        setPublished(!!s.published);
        setPoster(s.poster || "");
        setBackdrop(s.backdrop || "");
        setTrailerUrl(s.trailerUrl || "");
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

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto bg-gray-950 border border-gray-800 rounded p-4 space-y-4">
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
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
