"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import api from "@/services/api";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import storage from "@/lib/firebase";

interface Episode {
  _id: string;
  title: string;
  episodeNumber: number;
  overview?: string;
  duration?: number;
  published?: boolean;
  videoSources?: Array<{ label: string; url: string }>;
  subtitles?: Array<{ lang: string; url: string }>;
}

export default function EpisodeEditorPage() {
  const params = useParams();
  const router = useRouter();
  const showId = params?.id as string;
  const seasonId = params?.seasonId as string;
  const episodeId = params?.episodeId as string;

  const [ep, setEp] = useState<Episode | null>(null);
  const [title, setTitle] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState<number>(1);
  const [overview, setOverview] = useState("");
  const [duration, setDuration] = useState<number | undefined>();
  const [published, setPublished] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [subtitleLang, setSubtitleLang] = useState("en");
  const [subtitleUrl, setSubtitleUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // We don't have a GET episode by id admin route; reuse public one
        const res = await api.get(`/tv/episodes/${episodeId}`);
        const data = res.data as Episode;
        setEp(data);
        setTitle(data.title);
        setEpisodeNumber(data.episodeNumber || 1);
        setOverview(data.overview || "");
        setDuration(data.duration);
        setPublished(!!data.published);
        setVideoUrl(data.videoSources?.[0]?.url || "");
        setSubtitleUrl(data.subtitles?.[0]?.url || "");
      } catch (e: any) {
        setError(e.response?.data?.message || "Failed to load episode");
      } finally {
        setLoading(false);
      }
    })();
  }, [episodeId]);

  const uploadFile = async (
    file: File,
    path: string,
    onProgress?: (pct: number) => void
  ) => {
    const s = getStorage();
    const r = ref(s, path);
    const task = uploadBytesResumable(r, file, { contentType: file.type });
    return await new Promise<string>((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) =>
          onProgress?.(
            Math.round((snap.bytesTransferred * 100) / snap.totalBytes)
          ),
        reject,
        async () => resolve(await getDownloadURL(task.snapshot.ref))
      );
    });
  };

  const onUploadVideo = async (file: File) => {
    const path = `episodes/${showId}/seasons/${seasonId}/episodes/${episodeId}/${Date.now()}-${
      file.name
    }`;
    const url = await uploadFile(file, path, setVideoProgress);
    setVideoUrl(url);
  };

  const onUploadSubtitle = async (file: File) => {
    const path = `episodes/${showId}/seasons/${seasonId}/episodes/${episodeId}/sub-${Date.now()}-${
      file.name
    }`;
    const url = await uploadFile(file, path);
    setSubtitleUrl(url);
  };

  const save = async () => {
    try {
      setSaving(true);
      const payload: any = {
        title,
        episodeNumber,
        overview,
        duration,
        published,
      };
      if (videoUrl) payload.videoSources = [{ label: "HD", url: videoUrl }];
      if (subtitleUrl)
        payload.subtitles = [{ lang: subtitleLang, url: subtitleUrl }];
      await api.patch(`/tv/admin/episodes/${episodeId}`, payload);
      router.push(`/tv/${showId}`);
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to save episode");
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
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto bg-gray-950 border border-gray-800 rounded p-4 space-y-4">
            <h1 className="text-2xl font-bold">Edit Episode</h1>
            <div>
              <label className="block text-sm mb-1">Title</label>
              <input
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Episode Number</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                  value={episodeNumber}
                  onChange={(e) => setEpisodeNumber(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Duration (sec)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                  value={duration ?? ""}
                  onChange={(e) =>
                    setDuration(Number(e.target.value) || undefined)
                  }
                />
              </div>
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
            <div className="flex items-center gap-2">
              <input
                id="published"
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              <label htmlFor="published">Published</label>
            </div>

            <div className="border-t border-gray-800 pt-4">
              <h2 className="text-lg font-semibold mb-2">Video Upload</h2>
              <input
                type="file"
                accept="video/*"
                onChange={(e) =>
                  e.target.files && onUploadVideo(e.target.files[0])
                }
              />
              {videoProgress > 0 && videoProgress < 100 && (
                <div className="text-sm text-gray-300 mt-1">
                  Uploading: {videoProgress}%
                </div>
              )}
              {videoUrl && (
                <div className="text-sm text-green-400 mt-1 break-all">
                  Video URL saved
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">
                Subtitles (optional)
              </h2>
              <div className="flex items-center gap-2 mb-2">
                <input
                  className="w-24 px-2 py-1 rounded bg-gray-900 border border-gray-800"
                  value={subtitleLang}
                  onChange={(e) => setSubtitleLang(e.target.value)}
                  placeholder="en"
                />
                <input
                  type="file"
                  accept="text/vtt,.vtt"
                  onChange={(e) =>
                    e.target.files && onUploadSubtitle(e.target.files[0])
                  }
                />
              </div>
              {subtitleUrl && (
                <div className="text-sm text-green-400 mt-1 break-all">
                  Subtitle uploaded
                </div>
              )}
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
                onClick={() => router.push(`/tv/${showId}`)}
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
