'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { FaPlay, FaInfoCircle, FaTrash } from 'react-icons/fa';

interface Movie {
  _id: string;
  title: string;
  desc: string;
  img: string;
  imgSm?: string;
  year?: string;
  limit?: number;
  genre?: string;
  duration?: string;
  isSeries?: boolean;
}

export default function MyList() {
  const [myList, setMyList] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const getMyList = async () => {
      try {
        setLoading(true);
        // This is a mock API call - in a real app, you would have an endpoint to get the user's list
        const res = await axios.get(
          `/api/users/favorites/${user._id}`,
          {
            headers: {
              token: `Bearer ${user.accessToken}`,
            },
          }
        );
        setMyList(res.data);
      } catch (err) {
        setError('Failed to load your list');
        console.error(err);
        // For demo purposes, set some mock data if the API fails
        setMyList([]);
      } finally {
        setLoading(false);
      }
    };

    getMyList();
  }, [user, router]);

  const handleRemoveFromList = async (movieId: string) => {
    try {
      // This is a mock API call - in a real app, you would have an endpoint to remove from the user's list
      await axios.delete(
        `/api/users/favorites/${user?._id}/${movieId}`,
        {
          headers: {
            token: `Bearer ${user?.accessToken}`,
          },
        }
      );
      setMyList(myList.filter((movie) => movie._id !== movieId));
    } catch (err) {
      console.error(err);
      // For demo purposes, remove from the local state even if the API fails
      setMyList(myList.filter((movie) => movie._id !== movieId));
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar />
      
      <div className="container mx-auto px-4 py-20">
        <h1 className="text-white text-3xl font-bold mb-8">My List</h1>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
          </div>
        ) : error ? (
          <div className="text-white text-center py-12">{error}</div>
        ) : myList.length === 0 ? (
          <div className="text-white text-center py-12">
            <p className="mb-4">Your list is empty</p>
            <Link href="/" className="text-red-600 hover:underline">
              Browse content to add to your list
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {myList.map((movie) => (
              <div key={movie._id} className="bg-gray-800 rounded-md overflow-hidden group">
                <div className="relative h-48">
                  <Image
                    src={movie.imgSm || movie.img}
                    alt={movie.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-70 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex space-x-3">
                      <Link 
                        href={`/watch?videoId=${movie._id}`}
                        className="bg-white text-black p-2 rounded-full hover:bg-opacity-80"
                      >
                        <FaPlay />
                      </Link>
                      <Link 
                        href={`/details/${movie._id}`}
                        className="bg-gray-600 text-white p-2 rounded-full hover:bg-opacity-80"
                      >
                        <FaInfoCircle />
                      </Link>
                      <button 
                        onClick={() => handleRemoveFromList(movie._id)}
                        className="bg-red-600 text-white p-2 rounded-full hover:bg-opacity-80"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-white font-semibold mb-1 truncate">{movie.title}</h3>
                  <div className="flex items-center text-sm text-gray-400 mb-2">
                    <span>{movie.year}</span>
                    {movie.limit && (
                      <span className="mx-2 border border-gray-500 px-1 text-xs">
                        {movie.limit}+
                      </span>
                    )}
                    <span>{movie.isSeries ? 'Series' : 'Movie'}</span>
                  </div>
                  <p className="text-gray-400 text-sm line-clamp-2">{movie.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 