'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import axios from 'axios';
import api from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';

export default function EditProfile() {
  const router = useRouter();
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [profilePic, setProfilePic] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    const load = async () => {
      try {
        const res = await axios.get('/api/users/profile', {
          headers: { token: `Bearer ${user.accessToken}` },
        });
        setUsername(res.data.username || '');
        setEmail(res.data.email || '');
        setProfilePic(res.data.profilePic || '');
      } catch (e) {
        setError('Failed to load profile');
      }
    };
    load();
  }, [user, router]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const body: any = { username, email, profilePic };
      const res = await api.put(`/users/${user._id}`, body, {
        headers: { token: `Bearer ${user.accessToken}` },
      });
      // Merge updated fields into localStorage user to keep token
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const merged = { ...parsed, ...res.data };
          localStorage.setItem('user', JSON.stringify(merged));
        } catch {}
      }
      router.push('/profile');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
        <h1 className="text-white text-3xl font-bold mb-6">Edit Profile</h1>
        {error && (
          <div className="mb-4 text-red-400 text-sm">{error}</div>
        )}
        <form onSubmit={onSave} className="bg-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-gray-300 text-sm mb-1">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-red-600"
              placeholder="Your name"
              required
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-red-600"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Profile image URL</label>
            <input
              value={profilePic}
              onChange={(e) => setProfilePic(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-red-600"
              placeholder="https://..."
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-5 py-2 rounded"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/profile')}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}


