'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import Featured from '@/components/Featured';
import MovieList from '@/components/MovieList';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface List {
  _id: string;
  title: string;
  type: string;
  genre: string;
}

export default function Home() {
  const [lists, setLists] = useState<List[]>([]);
  const [genre, setGenre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const getRandomLists = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `/api/lists${genre ? `?genre=${genre}` : ''}`,
          {
            headers: {
              token: `Bearer ${user?.accessToken}`,
            },
          }
        );
        setLists(res.data);
      } catch (err) {
        setError('Failed to load content');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getRandomLists();
  }, [genre, user, router]);

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-900">
      <Navbar />
      <Featured />
      
      <div className="px-4 py-8">
        <div className="mb-6 flex items-center">
          <h2 className="text-white text-2xl font-bold mr-4">Movies</h2>
          <select 
            className="bg-black text-white border border-gray-600 rounded p-1"
            onChange={(e) => setGenre(e.target.value)}
          >
            <option value="">Genres</option>
            <option value="action">Action</option>
            <option value="comedy">Comedy</option>
            <option value="crime">Crime</option>
            <option value="fantasy">Fantasy</option>
            <option value="historical">Historical</option>
            <option value="horror">Horror</option>
            <option value="romance">Romance</option>
            <option value="sci-fi">Sci-fi</option>
            <option value="thriller">Thriller</option>
            <option value="western">Western</option>
            <option value="animation">Animation</option>
            <option value="drama">Drama</option>
            <option value="documentary">Documentary</option>
          </select>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
          </div>
        ) : error ? (
          <div className="text-white text-center py-12">{error}</div>
        ) : (
          <div className="space-y-8">
            {lists.map((list) => (
              <MovieList key={list._id} listId={list._id} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
