"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import api from "@/services/api";
import Link from "next/link";

interface TVShowItem {
  _id: string;
  title: string;
  published?: boolean;
  genres?: string[];
  seasonsCount?: number;
  episodesCount?: number;
}

export default function TVShowsPage() {
  const [items, setItems] = useState<TVShowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShows = async () => {
    try {
      setLoading(true);
      const res = await api.get("/tv", { params: { pageSize: 50 } });
      setItems(res.data?.data || []);
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to load TV shows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShows();
  }, []);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">TV Shows</h1>
          <Link
            href="/tv/new"
            className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white"
          >
            Create Show
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="text-gray-300">No TV shows found.</div>
        ) : (
          <div className="grid gap-4">
            {items.map((s) => (
              <Link
                key={s._id}
                href={`/tv/${s._id}`}
                className="p-4 bg-gray-950 border border-gray-800 rounded hover:bg-gray-800/50"
              >
                <div className="text-lg font-semibold">{s.title}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {s.published ? "Published" : "Draft"} • {s.seasonsCount || 0} seasons • {s.episodesCount || 0} episodes
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}


