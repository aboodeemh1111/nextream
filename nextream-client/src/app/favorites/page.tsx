'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import MovieCard from '@/components/MovieCard';
import { useAuth } from '@/context/AuthContext';
import { FaHeart } from 'react-icons/fa';

interface Movie {
  _id: string;
  title: string;
  desc: string;
  img: string;
  imgTitle?: string;
  imgSm?: string;
  trailer?: string;
  year?: string;
  limit?: number;
  genre?: string;
  duration?: string;
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/users/favorites', {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      });
      setFavorites(res.data);
    } catch (err) {
      console.error('Error fetching Favorites:', err);
      setError('Failed to load your favorites');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchFavorites();
  }, [user, router]);

  const handleListChange = () => {
    fetchFavorites();
  };

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-900">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <h1 className="text-white text-3xl font-bold mb-8">Favorites</h1>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
          </div>
        ) : error ? (
          <div className="text-white text-center py-12">{error}</div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-lg">
            <FaHeart className="text-gray-500 text-5xl mx-auto mb-4" />
            <h2 className="text-white text-xl mb-2">No favorites yet</h2>
            <p className="text-gray-400 mb-6">
              Add shows and movies to your favorites to find them easily.
            </p>
            <button 
              onClick={() => router.push('/')}
              className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
            >
              Browse Content
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {favorites.map((movie) => (
              <div key={movie._id} className="h-[200px]">
                <MovieCard 
                  movie={movie} 
                  inFavorites={true}
                  onListChange={handleListChange}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
} 