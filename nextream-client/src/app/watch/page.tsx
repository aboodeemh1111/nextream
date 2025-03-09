'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { FaArrowLeft, FaStar, FaCheck } from 'react-icons/fa';
import Link from 'next/link';
import RatingStars from '@/components/RatingStars';

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
  avgRating?: number;
  numRatings?: number;
}

interface UserReview {
  _id: string;
  rating: number;
  review: string;
  createdAt: string;
}

// Component that uses useSearchParams
function WatchContent() {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number>(0);
  const [userReview, setUserReview] = useState<UserReview | null>(null);
  const [isRating, setIsRating] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(false);
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
      } catch (err: any) {
        console.error(err);
        setError('Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    const fetchUserReview = async () => {
      if (!user || !videoId) return;
      
      try {
        const res = await axios.get(
          `/api/reviews/user/${user.id}/movie/${videoId}`,
          {
            headers: {
              token: `Bearer ${user.accessToken}`,
            },
          }
        );
        
        if (res.data) {
          setUserReview(res.data);
          setUserRating(res.data.rating);
        }
      } catch (err: any) {
        // 404 means the user hasn't reviewed this movie yet, which is fine
        if (err.response?.status !== 404) {
          console.error('Error fetching user review:', err);
        }
      }
    };

    getMovie();
    fetchUserReview();
  }, [videoId, user, router]);

  const handleRatingChange = async (rating: number) => {
    if (!user || !movie || !videoId) return;
    
    try {
      setIsRating(true);
      setUserRating(rating);
      
      if (userReview) {
        // Update existing review
        await axios.put(
          `/api/reviews/${userReview._id}`,
          {
            rating,
            review: userReview.review,
          },
          {
            headers: {
              token: `Bearer ${user.accessToken}`,
            },
          }
        );
      } else {
        // Create new review
        const res = await axios.post(
          '/api/reviews',
          {
            movieId: videoId,
            rating,
            review: '',
          },
          {
            headers: {
              token: `Bearer ${user.accessToken}`,
            },
          }
        );
        setUserReview(res.data.review);
      }
      
      // Update the movie's rating in the UI
      if (movie.avgRating && movie.numRatings) {
        // If the movie already had ratings, update the average
        const newNumRatings = userReview ? movie.numRatings : movie.numRatings + 1;
        const newTotalRating = userReview 
          ? (movie.avgRating * movie.numRatings) - userReview.rating + rating
          : (movie.avgRating * movie.numRatings) + rating;
        const newAvgRating = newTotalRating / newNumRatings;
        
        setMovie({
          ...movie,
          avgRating: newAvgRating,
          numRatings: newNumRatings,
        });
      } else {
        // If this is the first rating
        setMovie({
          ...movie,
          avgRating: rating,
          numRatings: 1,
        });
      }
      
      // Show success message
      setRatingSuccess(true);
      setTimeout(() => {
        setRatingSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error submitting rating:', err);
    } finally {
      setIsRating(false);
    }
  };

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
    <div className="h-screen w-full bg-black flex flex-col">
      {/* Top Navigation */}
      <div className="p-4 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-white flex items-center hover:text-gray-300">
            <FaArrowLeft className="mr-2" /> Back to Home
          </Link>
          
          {/* Rating Component */}
          <div className="flex items-center bg-black/50 p-2 rounded-lg">
            <div className="flex flex-col items-center mr-4">
              <div className="text-white text-sm mb-1">Your Rating</div>
              <RatingStars
                rating={userRating}
                size={24}
                interactive={!isRating}
                onChange={handleRatingChange}
              />
            </div>
            
            {movie.avgRating && (
              <div className="flex flex-col items-center">
                <div className="text-white text-sm mb-1">Average Rating</div>
                <div className="flex items-center">
                  <FaStar className="text-yellow-500 mr-1" />
                  <span className="text-white">
                    {movie.avgRating.toFixed(1)} ({movie.numRatings})
                  </span>
                </div>
              </div>
            )}
            
            {ratingSuccess && (
              <div className="ml-4 bg-green-600/70 text-white px-3 py-1 rounded-full flex items-center">
                <FaCheck className="mr-1" /> Rated
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Video Player */}
      <div className="flex-1 flex items-center justify-center">
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

// Loading fallback component
function WatchLoading() {
  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function Watch() {
  return (
    <Suspense fallback={<WatchLoading />}>
      <WatchContent />
    </Suspense>
  );
} 