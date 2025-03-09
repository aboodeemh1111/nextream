'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { FaPlay, FaPlus, FaMinus, FaHeart, FaRegHeart, FaClock, FaRegClock, FaArrowLeft, FaStar, FaCheck } from 'react-icons/fa';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import RatingStars from '@/components/RatingStars';

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
  avgRating?: number;
  numRatings?: number;
}

interface UserReview {
  _id: string;
  rating: number;
  review: string;
  createdAt: string;
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
  const [progress, setProgress] = useState(0);
  const [watchTime, setWatchTime] = useState(0);
  const [watchStartTime, setWatchStartTime] = useState<number | null>(null);
  const [pausePoints, setPausePoints] = useState<number[]>([]);
  const [userRating, setUserRating] = useState<number>(0);
  const [userReview, setUserReview] = useState<UserReview | null>(null);
  const [isRating, setIsRating] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(false);

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

    const fetchUserReview = async () => {
      if (!user) return;
      
      try {
        const res = await axios.get(
          `/api/reviews/user/${user.id}/movie/${id}`,
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
      // Set watch start time
      setWatchStartTime(Date.now());
      
      // Add to currently watching list
      axios.put(`/api/users/currently-watching/add/${id}`, {
        progress: progress,
        watchTime: watchTime
      }, {
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
    } else {
      // Calculate watch time when pausing
      if (watchStartTime) {
        const newWatchTime = watchTime + (Date.now() - watchStartTime) / 1000;
        setWatchTime(newWatchTime);
        setWatchStartTime(null);
        
        // Record pause point
        setPausePoints([...pausePoints, progress]);
        
        // Update currently watching with progress
        axios.put(`/api/users/currently-watching/update/${id}`, {
          progress: progress,
          watchTime: newWatchTime,
          pausePoints: [...pausePoints, progress]
        }, {
          headers: {
            token: `Bearer ${user?.accessToken}`,
          },
        }).catch(err => console.error('Error updating watch progress:', err));
      }
    }
    
    setIsPlaying(!isPlaying);
  };

  // Track video progress
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    // This is a simplified example - in a real implementation, you would need to
    // communicate with the iframe to get the current time and duration
    // For demonstration purposes, we'll simulate progress
    
    // Simulate progress increasing over time when playing
    if (isPlaying && progress < 100) {
      const newProgress = Math.min(progress + 0.5, 100);
      setProgress(newProgress);
      
      // If completed, record in watch history
      if (newProgress >= 100) {
        handleCompletion();
      }
    }
  };
  
  // Handle video completion
  const handleCompletion = () => {
    // Calculate final watch time
    const finalWatchTime = watchStartTime 
      ? watchTime + (Date.now() - watchStartTime) / 1000
      : watchTime;
    
    // Add to watch history
    axios.put(`/api/users/watch-history/add/${id}`, {
      progress: 100,
      watchTime: finalWatchTime,
      completed: true
    }, {
      headers: {
        token: `Bearer ${user?.accessToken}`,
      },
    }).then(() => {
      // Remove from currently watching
      return axios.put(`/api/users/currently-watching/remove/${id}`, {}, {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      });
    }).catch(err => console.error('Error recording watch history:', err));
  };

  const handleBack = () => {
    router.back();
  };

  const handleRatingChange = async (rating: number) => {
    if (!user || !movie) return;
    
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
            movieId: id,
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
                onTimeUpdate={handleTimeUpdate}
              ></iframe>
            </div>
            
            {/* Progress bar */}
            <div className="mt-4 bg-gray-700 rounded-full h-2.5 w-full">
              <div 
                className="bg-red-600 h-2.5 rounded-full" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="mt-2 text-gray-400 text-sm">
              {progress < 100 ? `${progress.toFixed(0)}% complete` : 'Completed'}
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
      
      {/* Rating Component */}
      <div className="p-4 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex justify-between items-center">
          <Link href={`/details/${id}`} className="text-white flex items-center hover:text-gray-300">
            <FaArrowLeft className="mr-2" /> Back to Details
          </Link>
          
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
    </div>
  );
} 