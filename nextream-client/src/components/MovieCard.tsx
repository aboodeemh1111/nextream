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
  size?: 'small' | 'medium' | 'large';
}

const MovieCard = ({ 
  movie, 
  inMyList = false, 
  inFavorites = false, 
  inWatchlist = false,
  onListChange,
  size = 'medium'
}: MovieCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isInMyList, setIsInMyList] = useState(inMyList);
  const [isInFavorites, setIsInFavorites] = useState(inFavorites);
  const [isInWatchlist, setIsInWatchlist] = useState(inWatchlist);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user } = useAuth();

  // Determine card height based on size prop and screen size
  const getCardHeight = () => {
    if (isMobile) {
      return 'h-[140px]';
    }
    
    switch (size) {
      case 'small':
        return 'h-[160px] sm:h-[180px]';
      case 'large':
        return 'h-[200px] sm:h-[225px] md:h-[250px]';
      case 'medium':
      default:
        return 'h-[180px] sm:h-[200px] md:h-[225px]';
    }
  };

  useEffect(() => {
    // Check if we're on a mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
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
    if (isMobile) return;
    
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
    if (isMobile) return;
    
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      setIsVideoLoaded(false);
    }
  };

  const handleTouchStart = () => {
    if (!isMobile) return;
    setIsHovered(true);
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
      ref={cardRef}
      className={`relative ${getCardHeight()} rounded-md overflow-hidden transition-transform duration-300 ease-in-out`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={isMobile ? handleTouchStart : undefined}
      style={{ 
        transform: isHovered ? 'scale(1.1)' : 'scale(1)', 
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
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
          className="object-cover"
          loading="lazy"
        />
      )}
      
      {/* Video Trailer */}
      {isHovered && movie.trailer && !isMobile && (
        <div className="absolute inset-0 bg-black">
          <video
            ref={videoRef}
            src={movie.trailer}
            className={`w-full h-full object-cover ${isVideoLoaded ? 'opacity-100' : 'opacity-0'}`}
            autoPlay
            muted={isMuted}
            loop
            onLoadedData={handleVideoLoad}
            playsInline
          />
        </div>
      )}
      
      {/* Hover Overlay */}
      {isHovered && (
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/60 to-black flex flex-col p-2 sm:p-3">
          <div className="flex-1 flex flex-col">
            <h3 className="text-white font-semibold text-xs sm:text-sm md:text-base mb-0.5 sm:mb-1 line-clamp-1">{movie.title}</h3>
            
            <div className="flex items-center space-x-1 sm:space-x-2 mb-1 sm:mb-2">
              <span className="text-green-500 text-xs sm:text-sm">{movie.year}</span>
              {movie.limit && (
                <span className="border border-gray-400 text-white px-0.5 text-xs">
                  {movie.limit}+
                </span>
              )}
              <span className="text-white text-xs sm:text-sm">{movie.duration}</span>
            </div>
            
            <p className="text-gray-300 text-xs line-clamp-2 mb-1 sm:mb-2 hidden sm:block">{movie.desc}</p>
            
            <div className="flex space-x-1 sm:space-x-2 mb-1 sm:mb-2">
              <button
                onClick={handlePlay}
                className="bg-white text-black p-1 rounded-full hover:bg-opacity-80 text-xs sm:text-sm"
                title="Play"
              >
                <FaPlay />
              </button>
              
              <button 
                onClick={toggleMyList}
                disabled={isLoading}
                className={`${isInMyList ? 'bg-red-600 text-white' : 'border border-gray-400 text-white'} p-1 rounded-full hover:bg-gray-700 text-xs sm:text-sm`}
                title={isInMyList ? "Remove from My List" : "Add to My List"}
              >
                {isInMyList ? <FaCheck /> : <FaPlus />}
              </button>
              
              <button 
                onClick={toggleFavorites}
                disabled={isLoading}
                className="border border-gray-400 text-white p-1 rounded-full hover:bg-gray-700 text-xs sm:text-sm"
                title={isInFavorites ? "Remove from Favorites" : "Add to Favorites"}
              >
                {isInFavorites ? <FaHeart className="text-red-500" /> : <FaRegHeart />}
              </button>
              
              <button 
                onClick={toggleWatchlist}
                disabled={isLoading}
                className="border border-gray-400 text-white p-1 rounded-full hover:bg-gray-700 text-xs sm:text-sm"
                title={isInWatchlist ? "Remove from Want to Watch" : "Add to Want to Watch"}
              >
                {isInWatchlist ? <FaClock className="text-blue-400" /> : <FaRegClock />}
              </button>
              
              {movie.trailer && !isMobile && (
                <button 
                  onClick={toggleMute} 
                  className="border border-gray-400 text-white p-1 rounded-full hover:bg-gray-700 text-xs sm:text-sm hidden sm:block"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
                </button>
              )}
            </div>
          </div>
          
          <button
            onClick={handleMoreInfo}
            className="w-full bg-gray-600 text-white py-1 rounded flex items-center justify-center hover:bg-gray-700 text-xs sm:text-sm"
          >
            <FaInfoCircle className="mr-1" /> More Info
          </button>
        </div>
      )}
      
      {/* Non-hover indicators for list membership */}
      {!isHovered && (
        <div className="absolute top-1 right-1 flex space-x-1">
          {isInMyList && (
            <div className="bg-red-600 text-white p-1 rounded-full text-xs">
              <FaCheck />
            </div>
          )}
          {isInFavorites && (
            <div className="bg-black/60 p-1 rounded-full text-xs">
              <FaHeart className="text-red-500" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MovieCard; 