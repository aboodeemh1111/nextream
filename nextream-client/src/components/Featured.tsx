'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { FaPlay, FaInfoCircle } from 'react-icons/fa';

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

const Featured = ({ type }: { type?: string }) => {
  const [content, setContent] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const getRandomContent = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/movies/random${type ? `?type=${type}` : ''}`);
        setContent(res.data[0]);
      } catch (err) {
        setError('Failed to load featured content');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getRandomContent();
  }, [type]);

  const handlePlay = () => {
    if (content?.trailer) {
      router.push(`/watch?videoId=${content._id}`);
    }
  };

  const handleMoreInfo = () => {
    if (content) {
      router.push(`/details/${content._id}`);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[90vh] bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="w-full h-[90vh] bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">{error || 'No content available'}</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[90vh]">
      {content.img && (
        <div className="absolute inset-0">
          <Image
            src={content.img}
            alt={content.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
        </div>
      )}
      
      <div className="absolute bottom-0 left-0 w-full p-8 md:p-16 z-10">
        <div className="max-w-2xl">
          {content.imgTitle ? (
            <Image
              src={content.imgTitle}
              alt={content.title}
              width={400}
              height={150}
              className="mb-6"
            />
          ) : (
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">{content.title}</h1>
          )}
          
          <div className="flex items-center space-x-4 mb-4">
            <span className="text-green-500 font-semibold">{content.year}</span>
            {content.limit && (
              <span className="border border-gray-400 text-white px-2 py-0.5 text-sm">
                {content.limit}+
              </span>
            )}
            <span className="text-white">{content.duration}</span>
            {content.genre && (
              <span className="text-white">{content.genre}</span>
            )}
          </div>
          
          <p className="text-white text-lg mb-6 line-clamp-3">{content.desc}</p>
          
          <div className="flex space-x-4">
            <button
              onClick={handlePlay}
              className="bg-white text-black px-6 py-2 rounded flex items-center hover:bg-opacity-80 transition"
            >
              <FaPlay className="mr-2" /> Play
            </button>
            <button
              onClick={handleMoreInfo}
              className="bg-gray-600 bg-opacity-70 text-white px-6 py-2 rounded flex items-center hover:bg-opacity-90 transition"
            >
              <FaInfoCircle className="mr-2" /> More Info
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Featured; 