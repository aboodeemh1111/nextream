'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { FaPlay, FaPlus, FaMinus, FaHeart, FaRegHeart, FaClock, FaRegClock, FaArrowLeft } from 'react-icons/fa';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';

interface Movie {
  _id: string;
  title: string;
  desc: string;
  img: string;
  imgTitle?: string;
  imgSm?: string;
  trailer?: string;
  video?: string;
  year?: string;
  limit?: number;
  genre?: string;
  duration?: string;
  isSeries?: boolean;
}

export default function Watch() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inMyList, setInMyList] = useState(false);
  const [inFavorites, setInFavorites] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const getMovie = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/movies/find/${id}`, {
          headers: {
            token: `Bearer ${user?.accessToken}`,
          },
        });
        setMovie(res.data);
        
        // Check if movie is in user's lists
        const userRes = await axios.get('/api/users/lists-status', {
          headers: {
            token: `Bearer ${user?.accessToken}`,
          },
          params: {
            movieId: id,
          },
        });
        
        setInMyList(userRes.data.inMyList);
        setInFavorites(userRes.data.inFavorites);
        setInWatchlist(userRes.data.inWatchlist);
      } catch (err) {
        setError('Failed to load movie');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getMovie();
  }, [id, user, router]);

  const handleMyList = async () => {
    try {
      const action = inMyList ? 'remove' : 'add';
      await axios.put(`/api/users/mylist/${action}/${id}`, {}, {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      });
      setInMyList(!inMyList);
    } catch (err) {
      console.error('Error updating my list:', err);
    }
  };

  const handleFavorites = async () => {
    try {
      const action = inFavorites ? 'remove' : 'add';
      await axios.put(`/api/users/favorites/${action}/${id}`, {}, {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      });
      setInFavorites(!inFavorites);
    } catch (err) {
      console.error('Error updating favorites:', err);
    }
  };

  const handleWatchlist = async () => {
    try {
      const action = inWatchlist ? 'remove' : 'add';
      await axios.put(`/api/users/watchlist/${action}/${id}`, {}, {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      });
      setInWatchlist(!inWatchlist);
    } catch (err) {
      console.error('Error updating watchlist:', err);
    }
  };

  const handlePlay = () => {
    // Record that user started watching this movie
    if (!isPlaying) {
      // Add to currently watching list
      axios.put(`/api/users/currently-watching/add/${id}`, {}, {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      }).catch(err => console.error('Error updating currently watching:', err));
      
      // Increment movie views
      axios.put(`/api/movies/views/${id}`, {}, {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      }).then(res => {
        console.log('Movie view recorded:', res.data);
      }).catch(err => console.error('Error recording movie view:', err));
    }
    
    setIsPlaying(!isPlaying);
  };

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="bg-main min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="bg-main min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">{error || 'Movie not found'}</div>
      </div>
    );
  }

  return (
    <div className="bg-main min-h-screen">
      <Navbar />
      
      <div className="relative">
        {/* Back button */}
        <button 
          onClick={handleBack}
          className="absolute top-4 left-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition"
          aria-label="Go back"
        >
          <FaArrowLeft />
        </button>
        
        {/* Hero section with movie backdrop */}
        <div className="relative h-[50vh] md:h-[70vh]">
          <div className="absolute inset-0 bg-gradient-to-t from-main via-transparent to-transparent z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-main via-transparent to-transparent z-10"></div>
          <img 
            src={movie.img} 
            alt={movie.title} 
            className="w-full h-full object-cover"
          />
          
          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 z-20 p-4 md:p-8 w-full md:w-2/3 lg:w-1/2">
            <h1 className="text-white text-2xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4">{movie.title}</h1>
            
            <div className="flex flex-wrap items-center gap-3 text-sm md:text-base text-gray-300 mb-2 md:mb-4">
              {movie.year && <span>{movie.year}</span>}
              {movie.limit && <span className="border border-gray-500 px-1 py-0.5 rounded">{movie.limit}+</span>}
              {movie.duration && <span>{movie.duration}</span>}
              {movie.genre && <span>{movie.genre}</span>}
            </div>
            
            <p className="text-gray-300 text-sm md:text-base mb-4 md:mb-6 line-clamp-3 md:line-clamp-none">
              {movie.desc}
            </p>
            
            <div className="flex flex-wrap gap-2 md:gap-4">
              <button 
                onClick={handlePlay}
                className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded font-semibold hover:bg-gray-200 transition"
              >
                <FaPlay /> {isPlaying ? 'Stop' : 'Play'}
              </button>
              
              <button 
                onClick={handleMyList}
                className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
                aria-label={inMyList ? 'Remove from My List' : 'Add to My List'}
              >
                {inMyList ? <FaMinus /> : <FaPlus />} My List
              </button>
              
              <button 
                onClick={handleFavorites}
                className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
                aria-label={inFavorites ? 'Remove from Favorites' : 'Add to Favorites'}
              >
                {inFavorites ? <FaHeart className="text-red-600" /> : <FaRegHeart />} Favorite
              </button>
              
              <button 
                onClick={handleWatchlist}
                className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
                aria-label={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
              >
                {inWatchlist ? <FaClock className="text-blue-400" /> : <FaRegClock />} Watchlist
              </button>
            </div>
          </div>
        </div>
        
        {/* Video player section */}
        {isPlaying && movie.video && (
          <div className="container mx-auto px-4 py-8">
            <div className="aspect-video bg-black rounded overflow-hidden">
              <iframe
                src={movie.video}
                title={`${movie.title} trailer`}
                className="w-full h-full"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        )}
        
        {/* Trailer section */}
        {!isPlaying && movie.trailer && (
          <div className="container mx-auto px-4 py-8">
            <h2 className="text-white text-xl md:text-2xl font-bold mb-4">Trailer</h2>
            <div className="aspect-video bg-black rounded overflow-hidden">
              <iframe
                src={movie.trailer}
                title={`${movie.title} trailer`}
                className="w-full h-full"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 