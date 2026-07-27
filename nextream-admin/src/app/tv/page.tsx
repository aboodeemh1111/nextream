"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 12;

  const fetchShows = async () => {
    try {
      setLoading(true);
      const res = await api.get("/tv", {
        params: { pageSize, page, q: q || undefined },
      });
      setItems(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to load TV shows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShows();
  }, [page, q]);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">TV Shows</h1>
          <div className="flex items-center gap-3">
            <input
              className="px-3 py-2 rounded bg-background border border-input"
              placeholder="Search title..."
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
            <Link
              href="/tv/new"
              className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white"
            >
              Create Show
            </Link>
          </div>
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
          <div className="text-muted-foreground">No TV shows found.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((s) => (
                <div
                  key={s._id}
                  className="bg-card border border-border rounded overflow-hidden"
                >
                  {(s as any)?.poster ? (
                    <img
                      src={(s as any).poster}
                      alt={s.title}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-muted flex items-center justify-center text-muted-foreground">
                      No image
                    </div>
                  )}
                  <div className="p-3">
                    <div className="text-foreground font-semibold line-clamp-1">
                      {s.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {s.published ? "Published" : "Draft"} •{" "}
                      {s.seasonsCount || 0} seasons • {s.episodesCount || 0}{" "}
                      episodes
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Link
                        href={`/tv/${s._id}`}
                        className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {total > pageSize && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  className="px-3 py-1 rounded bg-muted disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <div className="text-sm text-muted-foreground">
                  Page {page} of {Math.ceil(total / pageSize)}
                </div>
                <button
                  className="px-3 py-1 rounded bg-muted disabled:opacity-50"
                  disabled={page >= Math.ceil(total / pageSize)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
