'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { FaArrowLeft } from 'react-icons/fa';
import Link from 'next/link';

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
}

export default function Watch() {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const videoId = searchParams.get('videoId');
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (!videoId) {
      setError('No video selected');
      setLoading(false);
      return;
    }

    const getMovie = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/movies/find/${videoId}`, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        setMovie(res.data);
      } catch (err) {
        setError('Failed to load video');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getMovie();
  }, [videoId, user, router]);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <div className="text-white text-xl mb-4">{error || 'Video not found'}</div>
        <Link href="/" className="text-red-600 hover:underline">
          Go back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black">
      <div className="absolute top-0 left-0 w-full p-4 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <Link href="/" className="text-white flex items-center hover:text-gray-300">
          <FaArrowLeft className="mr-2" /> Back to Home
        </Link>
      </div>
      
      <div className="h-full w-full flex items-center justify-center">
        {movie.video ? (
          <video
            className="w-full h-full object-contain"
            autoPlay
            controls
            src={movie.video}
          />
        ) : movie.trailer ? (
          <iframe
            className="w-full h-full"
            src={movie.trailer}
            title={movie.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        ) : (
          <div className="text-white text-xl">No video available</div>
        )}
      </div>
    </div>
  );
} 