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

const FavoritesPage = () => {
  const [favorites, setFavorites] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

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
      setError('Failed to load your favorites');
      console.error(err);
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
    <div className="bg-main min-h-screen">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-white text-2xl md:text-3xl font-bold mb-6">Favorites</h1>
        
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div>
          </div>
        ) : error ? (
          <div className="text-white text-center p-4">{error}</div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-white text-lg mb-4">You haven't added any favorites yet</p>
            <button 
              onClick={() => router.push('/')}
              className="bg-red-600 text-white py-2 px-6 rounded hover:bg-red-700 transition"
            >
              Browse Content
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {favorites.map((movie) => (
              <div key={movie._id} className="w-full">
                <MovieCard 
                  movie={movie} 
                  inFavorites={true}
                  onListChange={handleListChange}
                  size="medium"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage; 