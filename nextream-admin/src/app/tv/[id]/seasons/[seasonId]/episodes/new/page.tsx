"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import api from "@/services/api";
import VideoUploader from "@/components/VideoUploader";
import SubtitleUploader from "@/components/SubtitleUploader";

export default function NewEpisodePage() {
  const params = useParams();
  const router = useRouter();
  const showId = params?.id as string;
  const seasonId = params?.seasonId as string;

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
  const [error, setError] = useState<string | null>(null);

  const buildVideoPath = (file: File) => `episodes/${showId}/seasons/${seasonId}/temp/${Date.now()}-${file.name}`;
  const buildSubPath = (file: File) => `episodes/${showId}/seasons/${seasonId}/temp/sub-${Date.now()}-${file.name}`;

  const create = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload: any = {
        title,
        episodeNumber,
        overview,
        duration,
        published,
      };
      if (videoUrl) payload.videoSources = [{ label: 'HD', url: videoUrl }];
      if (subtitleUrl) payload.subtitles = [{ lang: subtitleLang, url: subtitleUrl }];
      const res = await api.post(`/tv/${showId}/seasons/${seasonId}/episodes`, payload);
      router.push(`/tv/${showId}`);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-6">
        <div className="max-w-3xl mx-auto bg-gray-950 border border-gray-800 rounded p-4 space-y-4">
          <h1 className="text-2xl font-bold">New Episode</h1>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>
          )}
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Episode Number</label>
              <input type="number" className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800" value={episodeNumber} onChange={(e) => setEpisodeNumber(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm mb-1">Duration (sec)</label>
              <input type="number" className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800" value={duration ?? ''} onChange={(e) => setDuration(Number(e.target.value) || undefined)} />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Overview</label>
            <textarea className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800" rows={4} value={overview} onChange={(e) => setOverview(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input id="published" type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            <label htmlFor="published">Published</label>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <h2 className="text-lg font-semibold mb-2">Video Upload</h2>
            <VideoUploader
              storagePathBuilder={buildVideoPath}
              initialUrl={videoUrl}
              onUploaded={(u) => setVideoUrl(u)}
              onError={(e) => setError(e.message)}
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Subtitles (optional)</h2>
            <div className="flex items-center gap-2 mb-2">
              <input className="w-24 px-2 py-1 rounded bg-gray-900 border border-gray-800" value={subtitleLang} onChange={(e) => setSubtitleLang(e.target.value)} placeholder="en" />
              <SubtitleUploader
                storagePathBuilder={buildSubPath}
                initialUrl={subtitleUrl}
                onUploaded={(u) => setSubtitleUrl(u)}
                onError={(e) => setError(e.message)}
              />
            </div>
            {subtitleUrl && (
              <div className="text-sm text-green-400 mt-1 break-all">Subtitle uploaded</div>
            )}
          </div>

          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-60" disabled={saving || !title} onClick={create}>{saving ? 'Creating...' : 'Create'}</button>
            <button className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700" onClick={() => router.push(`/tv/${showId}`)}>Cancel</button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}


