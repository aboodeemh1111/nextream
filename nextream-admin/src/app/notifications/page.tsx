"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import api from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface NotificationItem {
  _id: string;
  title?: string;
  body?: string;
  icon?: string;
  image?: string;
  deepLink?: string;
  topic?: string;
  data?: Record<string, string>;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await api.get("/notifications", {
        headers: { token: `Bearer ${user?.accessToken}` },
      });
      setItems(res.data || []);
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchItems();
  }, [user]);

  const markRead = async (id: string) => {
    try {
      await api.patch(
        `/notifications/${id}/read`,
        {},
        { headers: { token: `Bearer ${user?.accessToken}` } }
      );
      setItems((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch {}
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <Link
            href="/notifications/new"
            className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white"
          >
            Compose
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
          <div className="bg-gray-950 border border-gray-800 rounded p-8 text-center text-gray-400">
            No notifications.
          </div>
        ) : (
          <div className="bg-gray-950 border border-gray-800 rounded divide-y divide-gray-800">
            {items.map((n) => (
              <div key={n._id} className="p-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {!n.read && (
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                    )}
                    <h3 className="font-semibold">
                      {n.title || "Notification"}
                    </h3>
                  </div>
                  {n.body && (
                    <p className="text-sm text-gray-300 mt-1">{n.body}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!n.read && (
                    <button
                      onClick={() => markRead(n._id)}
                      className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-sm"
                    >
                      Mark read
                    </button>
                  )}
                  {n.deepLink && (
                    <Link
                      href={n.deepLink}
                      className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-sm"
                    >
                      Open
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
