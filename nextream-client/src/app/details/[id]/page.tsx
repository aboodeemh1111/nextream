'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Image from 'next/image';
import { FaPlay, FaPlus, FaThumbsUp, FaThumbsDown, FaStar } from 'react-icons/fa';

interface Movie {
  _id: string;
  title: string;
  desc: string;
  img: string;
  imgTitle?: string;
  imgSm?: string;
  trailer: string;
  video?: string;
  year?: string;
  limit?: number;
  genre?: string;
  duration?: string;
  isSeries?: boolean;
  rating?: number;
  cast?: string[];
  director?: string;
}

export default function MovieDetails() {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const movieId = params.id as string;
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const getMovie = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/movies/find/${movieId}`, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        setMovie(res.data);
      } catch (err) {
        setError('Failed to load movie details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getMovie();
  }, [movieId, user, router]);

  const handlePlay = () => {
    router.push(`/watch?videoId=${movieId}`);
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
          <div className="text-white text-xl mb-4">{error || 'Movie not found'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar />
      
      <div className="relative">
        {/* Hero Banner */}
        <div className="relative h-[70vh] w-full">
          <Image
            src={movie.img}
            alt={movie.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/70 to-transparent"></div>
          
          <div className="absolute bottom-0 left-0 w-full p-8 md:p-16">
            <div className="max-w-4xl">
              {movie.imgTitle ? (
                <Image
                  src={movie.imgTitle}
                  alt={movie.title}
                  width={400}
                  height={150}
                  className="mb-6"
                />
              ) : (
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">{movie.title}</h1>
              )}
              
              <div className="flex items-center space-x-4 mb-4">
                <span className="text-green-500 font-semibold">{movie.year}</span>
                {movie.limit && (
                  <span className="border border-gray-400 text-white px-2 py-0.5 text-sm">
                    {movie.limit}+
                  </span>
                )}
                <span className="text-white">{movie.duration}</span>
                {movie.genre && (
                  <span className="text-white">{movie.genre}</span>
                )}
                {movie.rating && (
                  <div className="flex items-center text-yellow-500">
                    <FaStar className="mr-1" />
                    <span>{movie.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              
              <div className="flex space-x-4 mb-6">
                <button
                  onClick={handlePlay}
                  className="bg-white text-black px-6 py-2 rounded flex items-center hover:bg-opacity-80 transition"
                >
                  <FaPlay className="mr-2" /> Play
                </button>
                <button className="bg-gray-600 bg-opacity-70 text-white px-6 py-2 rounded flex items-center hover:bg-opacity-90 transition">
                  <FaPlus className="mr-2" /> My List
                </button>
                <button className="bg-gray-600 bg-opacity-70 text-white p-2 rounded-full flex items-center hover:bg-opacity-90 transition">
                  <FaThumbsUp />
                </button>
                <button className="bg-gray-600 bg-opacity-70 text-white p-2 rounded-full flex items-center hover:bg-opacity-90 transition">
                  <FaThumbsDown />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Details Section */}
        <div className="container mx-auto px-4 md:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <h2 className="text-white text-2xl font-semibold mb-4">Overview</h2>
              <p className="text-gray-300 mb-6">{movie.desc}</p>
              
              {movie.director && (
                <div className="mb-4">
                  <span className="text-gray-400">Director: </span>
                  <span className="text-white">{movie.director}</span>
                </div>
              )}
              
              {movie.cast && movie.cast.length > 0 && (
                <div>
                  <span className="text-gray-400">Cast: </span>
                  <span className="text-white">{movie.cast.join(', ')}</span>
                </div>
              )}
            </div>
            
            <div>
              <h2 className="text-white text-2xl font-semibold mb-4">Details</h2>
              <div className="space-y-2">
                <div className="flex">
                  <span className="text-gray-400 w-24">Type:</span>
                  <span className="text-white">{movie.isSeries ? 'Series' : 'Movie'}</span>
                </div>
                {movie.genre && (
                  <div className="flex">
                    <span className="text-gray-400 w-24">Genre:</span>
                    <span className="text-white">{movie.genre}</span>
                  </div>
                )}
                {movie.year && (
                  <div className="flex">
                    <span className="text-gray-400 w-24">Released:</span>
                    <span className="text-white">{movie.year}</span>
                  </div>
                )}
                {movie.duration && (
                  <div className="flex">
                    <span className="text-gray-400 w-24">Duration:</span>
                    <span className="text-white">{movie.duration}</span>
                  </div>
                )}
                {movie.limit && (
                  <div className="flex">
                    <span className="text-gray-400 w-24">Age Rating:</span>
                    <span className="text-white">{movie.limit}+</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 