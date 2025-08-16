"use client";

import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import VideoUploader from "@/components/VideoUploader";

export default function NewTVShowPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [genres, setGenres] = useState("");
  const [published, setPublished] = useState(false);
  const [poster, setPoster] = useState("");
  const [backdrop, setBackdrop] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isValidUrl = (u: string) => {
    try { if (!u) return true; new URL(u); return true; } catch { return false; }
  };

  const handleCreate = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!title.trim()) {
        setError("Title is required");
        return;
      }
      if (trailerUrl && !isValidUrl(trailerUrl)) {
        setError("Trailer URL is invalid");
        return;
      }
      const payload: any = {
        title,
        overview,
        genres: genres
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean),
        published,
        isSeries: true,
        poster,
        backdrop,
        trailerUrl,
      };
      if (slug.trim()) payload.slug = slug.trim().toLowerCase();
      const res = await api.post("/tv", payload);
      router.push(`/tv/${res.data._id}`);
    } catch (e: any) {
      const msg = e.response?.data?.message || "Failed to create show";
      if (e.response?.status === 409) {
        setError("A show with this title/slug already exists. Please choose a different title or slug.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-6">
        <div className="max-w-2xl mx-auto bg-gray-950 border border-gray-800 rounded p-4 space-y-4">
          <h1 className="text-2xl font-bold mb-2">Create TV Show</h1>
          {error && (
            <div className="mb-2 bg-red-100 text-red-700 px-3 py-2 rounded">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Show title"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Overview</label>
            <textarea
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
              rows={4}
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              placeholder="Short description"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Poster</label>
              <VideoUploader
                storagePathBuilder={(f) => `shows/${Date.now()}-${f.name}`}
                initialUrl={poster}
                onUploaded={setPoster}
                accept="image/*"
              />
              {poster && (
                <img src={poster} alt="Poster preview" className="mt-2 w-32 rounded border border-white/10" />
              )}
            </div>
            <div>
              <label className="block text-sm mb-1">Banner / Backdrop</label>
              <VideoUploader
                storagePathBuilder={(f) => `shows/${Date.now()}-banner-${f.name}`}
                initialUrl={backdrop}
                onUploaded={setBackdrop}
                accept="image/*"
              />
              {backdrop && (
                <img src={backdrop} alt="Backdrop preview" className="mt-2 w-full max-w-md rounded border border-white/10" />
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Trailer URL (optional)</label>
            <input
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
              value={trailerUrl}
              onChange={(e) => setTrailerUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <details>
              <summary className="cursor-pointer text-sm text-gray-300">Advanced (custom slug)</summary>
              <div className="mt-2">
                <label className="block text-sm mb-1">Slug (optional)</label>
                <input
                  className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="auto-generated from title if left empty"
                />
              </div>
            </details>
          </div>
          <div>
            <label className="block text-sm mb-1">
              Genres (comma-separated)
            </label>
            <input
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
              value={genres}
              onChange={(e) => setGenres(e.target.value)}
              placeholder="e.g. drama, sci-fi"
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
              onClick={handleCreate}
              disabled={loading || !title}
            >
              {loading ? "Creating..." : "Create"}
            </button>
            <button
              className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700"
              onClick={() => history.back()}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
