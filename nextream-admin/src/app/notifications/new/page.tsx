"use client";

import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import api from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function ComposeNotificationPage() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [image, setImage] = useState("");
  const [mode, setMode] = useState<"topic" | "users">("topic");
  const [topic, setTopic] = useState("new-releases");
  const [userIds, setUserIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSend = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const notification = { title, body } as any;
      const data: Record<string, string> = {};
      if (deepLink) data.deepLink = deepLink;
      if (image) notification.image = image;

      if (mode === "topic") {
        await api.post(
          "/notifications/send/topic",
          { topic, notification, data },
          { headers: { token: `Bearer ${user?.accessToken}` } }
        );
        setSuccess("Notification sent to topic");
      } else {
        const ids = userIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        await api.post(
          "/notifications/send/user",
          { userIds: ids, notification, data },
          { headers: { token: `Bearer ${user?.accessToken}` } }
        );
        setSuccess("Notification sent to users");
      }
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to send notification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Compose Notification</h1>
          <Link
            href="/notifications"
            className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700"
          >
            Back
          </Link>
        </div>

        {error && (
          <div className="mb-4 bg-red-100 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-100 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        <div className="bg-gray-950 border border-gray-800 rounded p-4 space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Deep Link (optional)</label>
              <input
                value={deepLink}
                onChange={(e) => setDeepLink(e.target.value)}
                placeholder="/details/123"
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Image URL (optional)</label>
              <input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="px-3 py-2 rounded bg-gray-900 border border-gray-800"
            >
              <option value="topic">Send to Topic</option>
              <option value="users">Send to Users</option>
            </select>
          </div>
          {mode === "topic" ? (
            <div>
              <label className="block text-sm mb-1">Topic</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
              />
              <p className="text-xs text-gray-500 mt-1">
                Examples: new-releases, genre:action, series:abc123
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm mb-1">
                User IDs (comma-separated)
              </label>
              <textarea
                value={userIds}
                onChange={(e) => setUserIds(e.target.value)}
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800"
                rows={3}
              />
            </div>
          )}

          <div>
            <button
              disabled={loading}
              onClick={handleSend}
              className="px-5 py-2 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
