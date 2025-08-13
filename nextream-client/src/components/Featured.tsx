'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { FaPlay, FaInfoCircle, FaVolumeMute, FaVolumeUp, FaRobot, FaFire, FaStar } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';

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
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [recommendationType, setRecommendationType] = useState<'personalized' | 'trending' | 'random'>('personalized');
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const getPersonalizedContent = async () => {
      try {
        setLoading(true);
        
        // Try to get personalized content first
        try {
          const res = await axios.get(`/api/movies/featured${type ? `?type=${type}` : ''}`, {
            // Send token only if we have one
            headers: user?.accessToken ? { token: `Bearer ${user.accessToken}` } : undefined
          });
          setContent(res.data[0]);
          setRecommendationType('personalized');
          setLoading(false);
          return;
        } catch (personalizedErr) {
          console.error("Personalized content error:", personalizedErr);
          // Fall back to trending/random if personalized fails
        }
        
        // Try to get trending content as fallback
        try {
          const trendingRes = await axios.get(`/api/movies/random${type ? `?type=${type}` : ''}`, {
            headers: {
              token: `Bearer ${user?.accessToken}`
            }
          });
          setContent(trendingRes.data[0]);
          setRecommendationType('trending');
        } catch (trendingErr) {
          console.error("Trending content error:", trendingErr);
          setError('Failed to load featured content');
        }
      } catch (err) {
        setError('Failed to load featured content');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getPersonalizedContent();
  }, [type, user?.accessToken]);

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

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  const playTrailer = () => {
    if (content?.trailer) {
      setIsPlayingTrailer(true);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(err => console.error("Video play error:", err));
      }
    }
  };

  const stopTrailer = () => {
    setIsPlayingTrailer(false);
    if (videoRef.current) {
      videoRef.current.pause();
      setIsVideoLoaded(false);
    }
  };

  const handleVideoLoad = () => {
    setIsVideoLoaded(true);
  };

  const getRecommendationLabel = () => {
    switch (recommendationType) {
      case 'personalized':
        return (
          <div className="flex items-center text-sm bg-black/40 px-3 py-1 rounded-full">
            <FaRobot className="text-blue-400 mr-2" />
            <span>Recommended for you</span>
          </div>
        );
      case 'trending':
        return (
          <div className="flex items-center text-sm bg-black/40 px-3 py-1 rounded-full">
            <FaFire className="text-orange-500 mr-2" />
            <span>Trending now</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center text-sm bg-black/40 px-3 py-1 rounded-full">
            <FaStar className="text-yellow-500 mr-2" />
            <span>Featured title</span>
          </div>
        );
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
      {/* Background Image or Video */}
      {!isPlayingTrailer && content.img && (
        <div className="absolute inset-0">
          <Image
            src={content.img}
            alt={content.title}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
        </div>
      )}

      {/* Trailer Video */}
      {isPlayingTrailer && content.trailer && (
        <div className="absolute inset-0 bg-black">
          <video
            ref={videoRef}
            src={content.trailer}
            className={`w-full h-full object-cover ${isVideoLoaded ? 'opacity-100' : 'opacity-0'}`}
            autoPlay
            muted={isMuted}
            loop
            onLoadedData={handleVideoLoad}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
        </div>
      )}
      
      <div className="absolute bottom-0 left-0 w-full p-8 md:p-16 z-10">
        <div className="max-w-2xl">
          {/* Recommendation Label */}
          <div className="mb-4">
            {getRecommendationLabel()}
          </div>
          
            {content.imgTitle ? (
            <div className="relative w-full max-w-[400px] h-auto mb-6">
              <Image
                src={content.imgTitle}
                alt={content.title}
                width={400}
                height={150}
                sizes="(max-width: 420px) 90vw, 400px"
                style={{ width: 'auto', height: 'auto', maxWidth: '100%' }}
                priority
              />
            </div>
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
          
          <div className="flex space-x-4 items-center">
            <button
              onClick={handlePlay}
              onMouseEnter={playTrailer}
              onMouseLeave={stopTrailer}
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
            
            {isPlayingTrailer && content.trailer && (
              <button 
                onClick={toggleMute} 
                className="bg-gray-800 bg-opacity-70 text-white p-2 rounded-full hover:bg-opacity-90 transition"
              >
                {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Featured; 