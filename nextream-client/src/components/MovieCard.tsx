'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { 
  FaPlay, 
  FaPlus, 
  FaCheck, 
  FaHeart, 
  FaRegHeart, 
  FaClock, 
  FaRegClock,
  FaInfoCircle, 
  FaVolumeMute, 
  FaVolumeUp 
} from 'react-icons/fa';

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

interface MovieCardProps {
  movie: Movie;
  inMyList?: boolean;
  inFavorites?: boolean;
  inWatchlist?: boolean;
  onListChange?: () => void;
}

const MovieCard = ({ 
  movie, 
  inMyList = false, 
  inFavorites = false, 
  inWatchlist = false,
  onListChange 
}: MovieCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isInMyList, setIsInMyList] = useState(inMyList);
  const [isInFavorites, setIsInFavorites] = useState(inFavorites);
  const [isInWatchlist, setIsInWatchlist] = useState(inWatchlist);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setIsInMyList(inMyList);
    setIsInFavorites(inFavorites);
    setIsInWatchlist(inWatchlist);
  }, [inMyList, inFavorites, inWatchlist]);

  const handleMouseEnter = () => {
    // Add a small delay before showing the video to prevent flickering on quick mouse movements
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
      if (videoRef.current && movie.trailer) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(err => console.error("Video play error:", err));
      }
    }, 800);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      setIsVideoLoaded(false);
    }
  };

  const handlePlay = () => {
    router.push(`/watch?videoId=${movie._id}`);
  };

  const handleMoreInfo = () => {
    router.push(`/details/${movie._id}`);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  const handleVideoLoad = () => {
    setIsVideoLoaded(true);
  };

  const toggleMyList = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      if (isInMyList) {
        // Remove from My List
        await axios.delete(`/api/users/mylist/${movie._id}`, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        setIsInMyList(false);
      } else {
        // Add to My List
        await axios.post('/api/users/mylist', 
          { movieId: movie._id },
          {
            headers: {
              token: `Bearer ${user.accessToken}`,
            },
          }
        );
        setIsInMyList(true);
      }
      
      // Notify parent component if needed
      if (onListChange) onListChange();
      
    } catch (err) {
      console.error('Error updating My List:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorites = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      if (isInFavorites) {
        // Remove from Favorites
        await axios.delete(`/api/users/favorites/${movie._id}`, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        setIsInFavorites(false);
      } else {
        // Add to Favorites
        await axios.post('/api/users/favorites', 
          { movieId: movie._id },
          {
            headers: {
              token: `Bearer ${user.accessToken}`,
            },
          }
        );
        setIsInFavorites(true);
      }
      
      // Notify parent component if needed
      if (onListChange) onListChange();
      
    } catch (err) {
      console.error('Error updating Favorites:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleWatchlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      if (isInWatchlist) {
        // Remove from Watchlist
        await axios.delete(`/api/users/watchlist/${movie._id}`, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        setIsInWatchlist(false);
      } else {
        // Add to Watchlist
        await axios.post('/api/users/watchlist', 
          { movieId: movie._id },
          {
            headers: {
              token: `Bearer ${user.accessToken}`,
            },
          }
        );
        setIsInWatchlist(true);
      }
      
      // Notify parent component if needed
      if (onListChange) onListChange();
      
    } catch (err) {
      console.error('Error updating Watchlist:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="relative h-[200px] rounded-md overflow-hidden transition-transform duration-300 ease-in-out"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ 
        transform: isHovered ? 'scale(1.2)' : 'scale(1)', 
        zIndex: isHovered ? 10 : 0,
        transition: 'all 0.3s ease-in-out'
      }}
    >
      {/* Static Image */}
      {(!isHovered || !movie.trailer || !isVideoLoaded) && (
        <Image
          src={movie.imgSm || movie.img}
          alt={movie.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover"
        />
      )}
      
      {/* Video Trailer */}
      {isHovered && movie.trailer && (
        <div className="absolute inset-0 bg-black">
          <video
            ref={videoRef}
            src={movie.trailer}
            className={`w-full h-full object-cover ${isVideoLoaded ? 'opacity-100' : 'opacity-0'}`}
            autoPlay
            muted={isMuted}
            loop
            onLoadedData={handleVideoLoad}
          />
        </div>
      )}
      
      {/* Hover Overlay */}
      {isHovered && (
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/60 to-black flex flex-col p-3">
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
                title="Play"
              >
                <FaPlay />
              </button>
              
              <button 
                onClick={toggleMyList}
                disabled={isLoading}
                className={`${isInMyList ? 'bg-red-600 text-white' : 'border border-gray-400 text-white'} p-1 rounded-full hover:bg-gray-700`}
                title={isInMyList ? "Remove from My List" : "Add to My List"}
              >
                {isInMyList ? <FaCheck /> : <FaPlus />}
              </button>
              
              <button 
                onClick={toggleFavorites}
                disabled={isLoading}
                className="border border-gray-400 text-white p-1 rounded-full hover:bg-gray-700"
                title={isInFavorites ? "Remove from Favorites" : "Add to Favorites"}
              >
                {isInFavorites ? <FaHeart className="text-red-500" /> : <FaRegHeart />}
              </button>
              
              <button 
                onClick={toggleWatchlist}
                disabled={isLoading}
                className="border border-gray-400 text-white p-1 rounded-full hover:bg-gray-700"
                title={isInWatchlist ? "Remove from Want to Watch" : "Add to Want to Watch"}
              >
                {isInWatchlist ? <FaClock className="text-blue-400" /> : <FaRegClock />}
              </button>
              
              {movie.trailer && (
                <button 
                  onClick={toggleMute} 
                  className="border border-gray-400 text-white p-1 rounded-full hover:bg-gray-700"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
                </button>
              )}
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