'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FaPlay, FaPlus, FaThumbsUp, FaThumbsDown, FaInfoCircle } from 'react-icons/fa';

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

const MovieCard = ({ movie }: { movie: Movie }) => {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  const handlePlay = () => {
    router.push(`/watch?videoId=${movie._id}`);
  };

  const handleMoreInfo = () => {
    router.push(`/details/${movie._id}`);
  };

  return (
    <div 
      className="relative h-[200px] rounded-md overflow-hidden transition-transform duration-300 ease-in-out"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ transform: isHovered ? 'scale(1.2)' : 'scale(1)', zIndex: isHovered ? 10 : 0 }}
    >
      <Image
        src={movie.imgSm || movie.img}
        alt={movie.title}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        className="object-cover"
      />
      
      {isHovered && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col p-3">
          <div className="flex-1 flex flex-col">
            <h3 className="text-white font-semibold mb-1 line-clamp-1">{movie.title}</h3>
            
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-green-500 text-sm">{movie.year}</span>
              {movie.limit && (
                <span className="border border-gray-400 text-white px-1 text-xs">
                  {movie.limit}+
                </span>
              )}
              <span className="text-white text-sm">{movie.duration}</span>
            </div>
            
            <p className="text-gray-300 text-xs line-clamp-2 mb-2">{movie.desc}</p>
            
            <div className="flex space-x-2 mb-2">
              <button
                onClick={handlePlay}
                className="bg-white text-black p-1 rounded-full hover:bg-opacity-80"
              >
                <FaPlay />
              </button>
              <button className="border border-gray-400 text-white p-1 rounded-full hover:bg-gray-700">
                <FaPlus />
              </button>
              <button className="border border-gray-400 text-white p-1 rounded-full hover:bg-gray-700">
                <FaThumbsUp />
              </button>
              <button className="border border-gray-400 text-white p-1 rounded-full hover:bg-gray-700">
                <FaThumbsDown />
              </button>
            </div>
          </div>
          
          <button
            onClick={handleMoreInfo}
            className="w-full bg-gray-600 text-white py-1 rounded flex items-center justify-center hover:bg-gray-700"
          >
            <FaInfoCircle className="mr-1" /> More Info
          </button>
        </div>
      )}
    </div>
  );
};

export default MovieCard; 