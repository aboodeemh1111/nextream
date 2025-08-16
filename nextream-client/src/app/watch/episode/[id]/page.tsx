"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import Navbar from "@/components/Navbar";

interface Episode {
  _id: string;
  title: string;
  videoSources?: Array<{ label: string; url: string }>;
  seasonNumber: number;
  episodeNumber: number;
}

export default function WatchEpisodePage() {
  const { id } = useParams();
  const episodeId = Array.isArray(id) ? id[0] : (id as string);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/tv/episodes/${episodeId}`);
        setEpisode(res.data);
      } catch (e: any) {
        setError("Failed to load episode");
      } finally {
        setLoading(false);
      }
    })();
  }, [episodeId]);

  // minimal progress save (future: backend endpoint)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !episode) return;
    const onTime = () => {
      const key = `ep:${episode._id}:progress`;
      localStorage.setItem(key, String(video.currentTime));
    };
    const onLoaded = () => {
      const key = `ep:${episode._id}:progress`;
      const v = Number(localStorage.getItem(key) || 0);
      if (v && video.duration && v < video.duration - 2) video.currentTime = v;
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onLoaded);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [episode]);

  return (
    <div className="bg-main min-h-screen text-white">
      <Navbar />
      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div>{error}</div>
        ) : !episode ? (
          <div>Not found</div>
        ) : (
          <div>
            <h1 className="text-xl md:text-2xl font-semibold mb-3">
              S{episode.seasonNumber} • E{episode.episodeNumber} —{" "}
              {episode.title}
            </h1>
            <div className="w-full bg-black rounded overflow-hidden border border-white/10">
              <video
                ref={videoRef}
                controls
                preload="metadata"
                className="w-full h-auto"
              >
                {(episode.videoSources || []).map((s, i) => (
                  <source key={i} src={s.url} />
                ))}
              </video>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
