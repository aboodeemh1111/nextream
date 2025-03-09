'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import RatingStars from './RatingStars';
import { FaThumbsUp, FaEdit, FaTrash, FaClock } from 'react-icons/fa';
import ReviewForm from './ReviewForm';
import CommentList from './CommentList';
import { formatDistanceToNow } from 'date-fns';

interface Review {
  _id: string;
  userId: string;
  movieId: string;
  rating: number;
  review: string;
  username: string;
  createdAt: string;
  updatedAt: string;
  likes: number;
  likedBy: string[];
}

interface ReviewListProps {
  movieId: string;
  className?: string;
}

const ReviewList: React.FC<ReviewListProps> = ({ movieId, className = '' }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [likingReview, setLikingReview] = useState<string | null>(null);
  const { user } = useAuth();

  // Get all reviews for the movie
  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/reviews/movie/${movieId}`);
      setReviews(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching reviews:', err);
      setError('Failed to load reviews. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Get the user's review for this movie if it exists
  const fetchUserReview = async () => {
    if (!user || !user.id) {
      setUserReview(null);
      return;
    }

    try {
      const response = await axios.get(`/api/reviews/user/${user.id}/movie/${movieId}`, {
        headers: {
          token: `Bearer ${user.accessToken}`,
        },
      });
      setUserReview(response.data);
    } catch (err: any) {
      // 404 means the user hasn't reviewed this movie yet, which is fine
      if (err.response?.status !== 404) {
        console.error('Error fetching user review:', err);
      }
      setUserReview(null);
    }
  };

  useEffect(() => {
    fetchReviews();
    if (user && user.id) {
      fetchUserReview();
    } else {
      setUserReview(null);
    }
  }, [movieId, user]);

  const handleReviewSubmitted = (review: Review) => {
    // Update the user's review
    setUserReview(review);
    
    // Update the reviews list
    fetchReviews();
    
    // Close edit form if open
    setEditingReviewId(null);
  };

  const handleLikeReview = async (reviewId: string) => {
    if (!user) return;

    try {
      setLikingReview(reviewId);
      await axios.put(
        `/api/reviews/${reviewId}/like`,
        {},
        {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        }
      );
      fetchReviews(); // Refresh reviews to get updated likes
    } catch (err) {
      console.error('Error liking review:', err);
    } finally {
      setLikingReview(null);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!user) return;

    if (window.confirm('Are you sure you want to delete this review?')) {
      try {
        await axios.delete(`/api/reviews/${reviewId}`, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        
        // If it was the user's review, set it to null
        if (userReview && userReview._id === reviewId) {
          setUserReview(null);
        }
        
        // Update the reviews list
        setReviews((prevReviews) => prevReviews.filter((review) => review._id !== reviewId));
      } catch (err) {
        console.error('Error deleting review:', err);
      }
    }
  };

  // Filter out the user's review from the list of other reviews
  const otherReviews = reviews.filter(
    (review) => !user || review.userId !== user.id
  );

  return (
    <div className={`space-y-8 ${className}`}>
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Ratings & Reviews</h3>
        
        {/* Show user's review at the top if it exists */}
        {userReview && editingReviewId !== userReview._id && (
          <div className="mb-6">
            <h4 className="text-lg font-medium text-white mb-2">Your Rating</h4>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className="text-yellow-400 text-xl">
                          {star <= userReview.rating ? '★' : '☆'}
                        </span>
                      ))}
                    </div>
                    <span className="ml-2 text-white font-semibold">{userReview.rating}/5</span>
                  </div>
                  <div className="flex items-center text-gray-400 text-sm mt-1">
                    <FaClock className="mr-1" />
                    <span>
                      {formatDistanceToNow(new Date(userReview.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingReviewId(userReview._id)}
                    className="text-blue-400 hover:text-blue-300"
                    title="Edit review"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDeleteReview(userReview._id)}
                    className="text-red-400 hover:text-red-300"
                    title="Delete review"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
              {userReview.review && <p className="mt-2 text-gray-300">{userReview.review}</p>}
            </div>
          </div>
        )}
        
        {/* Edit form for user's review */}
        {userReview && editingReviewId === userReview._id && (
          <div className="mb-6">
            <h4 className="text-lg font-medium text-white mb-2">Edit Your Rating</h4>
            <ReviewForm 
              movieId={movieId} 
              existingReview={userReview} 
              onReviewSubmitted={handleReviewSubmitted} 
            />
          </div>
        )}
        
        {/* Show review form only if user hasn't already reviewed */}
        {!userReview && (
          <div className="mb-6">
            <h4 className="text-lg font-medium text-white mb-2">Rate this title</h4>
            <p className="text-gray-400 mb-4">
              Share your rating to help others discover great content
            </p>
            <ReviewForm movieId={movieId} onReviewSubmitted={handleReviewSubmitted} />
          </div>
        )}
        
        {/* Show other reviews */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-900 text-white p-4 rounded">{error}</div>
        ) : otherReviews.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            No other reviews yet.
          </div>
        ) : (
          <div>
            <h4 className="text-lg font-medium text-white mb-4">Other Ratings</h4>
            <div className="space-y-4">
              {otherReviews.map((review) => (
                <div key={review._id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-white">{review.username}</h4>
                      <div className="flex items-center">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span key={star} className="text-yellow-400 text-xl">
                              {star <= review.rating ? '★' : '☆'}
                            </span>
                          ))}
                        </div>
                        <span className="ml-2 text-white font-semibold">{review.rating}/5</span>
                      </div>
                      <div className="flex items-center text-gray-400 text-sm">
                        <FaClock className="mr-1" />
                        <span>
                          {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    {user?.isAdmin && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingReviewId(review._id)}
                          className="text-blue-400 hover:text-blue-300"
                          title="Edit review (admin)"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDeleteReview(review._id)}
                          className="text-red-400 hover:text-red-300"
                          title="Delete review (admin)"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    )}
                  </div>
                  {review.review && <p className="mt-2 text-gray-300">{review.review}</p>}
                  <div className="mt-3 flex items-center">
                    <button
                      onClick={() => handleLikeReview(review._id)}
                      className={`flex items-center space-x-1 ${
                        user && review.likedBy.includes(user.id)
                          ? 'text-blue-500'
                          : 'text-gray-400 hover:text-blue-400'
                      }`}
                      disabled={!user || likingReview === review._id}
                      title={user ? 'Like this review' : 'Sign in to like reviews'}
                    >
                      {likingReview === review._id ? (
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                      ) : (
                        <FaThumbsUp />
                      )}
                      <span>{review.likes}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Comments Section */}
      <div className="mt-8 border-t border-gray-700 pt-8">
        <CommentList movieId={movieId} />
      </div>
    </div>
  );
};

export default ReviewList; 