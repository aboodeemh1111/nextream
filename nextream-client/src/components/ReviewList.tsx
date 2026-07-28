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

// Define the User type to match what's returned from useAuth
interface User {
  id: string;
  accessToken: string;
  isAdmin?: boolean;
  [key: string]: any; // Allow for other properties
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
  const { user } = useAuth() as { user: User | null };

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
    <div className={`space-y-10 ${className}`}>
      <div>
        {/* Show user's review at the top if it exists */}
        {userReview && editingReviewId !== userReview._id && (
          <div className="mb-8">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-nx-dim">
              Your rating
            </h4>
            <div className="rounded-xl border border-nx-line bg-nx-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <RatingStars rating={userReview.rating} size={18} />
                    <span className="text-sm font-semibold text-nx-ink">
                      {userReview.rating}/5
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-nx-dim">
                    <FaClock className="text-[10px]" />
                    <span>
                      {formatDistanceToNow(new Date(userReview.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingReviewId(userReview._id)}
                    className="rounded-md p-2 text-nx-muted transition hover:bg-white/10 hover:text-nx-ink"
                    title="Edit review"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDeleteReview(userReview._id)}
                    className="rounded-md p-2 text-nx-muted transition hover:bg-nx-accent/15 hover:text-nx-accent-soft"
                    title="Delete review"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
              {userReview.review && (
                <p className="mt-3 text-sm leading-relaxed text-nx-muted">{userReview.review}</p>
              )}
            </div>
          </div>
        )}

        {/* Edit form for user's review */}
        {userReview && editingReviewId === userReview._id && (
          <div className="mb-8">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-nx-dim">
              Edit your rating
            </h4>
            <ReviewForm
              movieId={movieId}
              existingReview={userReview}
              onReviewSubmitted={handleReviewSubmitted}
            />
          </div>
        )}

        {/* Show review form only if user hasn't already reviewed */}
        {!userReview && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-nx-ink">Rate this title</h4>
            <p className="mb-4 mt-1 text-sm text-nx-muted">
              Share your rating to help others discover great content.
            </p>
            <ReviewForm movieId={movieId} onReviewSubmitted={handleReviewSubmitted} />
          </div>
        )}

        {/* Show other reviews */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((row) => (
              <div key={row} className="nx-skeleton h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-nx-accent/40 bg-nx-accent/10 p-4 text-sm text-nx-ink">
            {error}
          </div>
        ) : otherReviews.length === 0 ? (
          <p className="py-10 text-center text-sm text-nx-muted">No other reviews yet.</p>
        ) : (
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-nx-dim">
              {otherReviews.length} other {otherReviews.length === 1 ? 'rating' : 'ratings'}
            </h4>
            <div className="space-y-3">
              {otherReviews.map((review) => {
                const liked = Boolean(user && review.likedBy.includes(user.id));

                return (
                  <div
                    key={review._id}
                    className="rounded-xl border border-nx-line bg-nx-surface p-5 transition duration-300 hover:border-white/20 hover:bg-nx-elevated"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 gap-3">
                        <span
                          aria-hidden
                          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nx-elevated text-sm font-bold uppercase text-nx-muted"
                        >
                          {review.username?.charAt(0) || '?'}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-nx-ink">{review.username}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <RatingStars rating={review.rating} size={14} />
                            <span className="text-xs font-semibold text-nx-muted">
                              {review.rating}/5
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-nx-dim">
                            <FaClock className="text-[10px]" />
                            <span>
                              {formatDistanceToNow(new Date(review.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      {user?.isAdmin && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingReviewId(review._id)}
                            className="rounded-md p-2 text-nx-muted transition hover:bg-white/10 hover:text-nx-ink"
                            title="Edit review (admin)"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDeleteReview(review._id)}
                            className="rounded-md p-2 text-nx-muted transition hover:bg-nx-accent/15 hover:text-nx-accent-soft"
                            title="Delete review (admin)"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      )}
                    </div>

                    {review.review && (
                      <p className="mt-3 text-sm leading-relaxed text-nx-muted">{review.review}</p>
                    )}

                    <div className="mt-4 flex items-center">
                      <button
                        onClick={() => handleLikeReview(review._id)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          liked
                            ? 'border-nx-cyan/50 bg-nx-cyan/10 text-nx-cyan'
                            : 'border-nx-line text-nx-muted hover:border-white/25 hover:text-nx-ink'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                        disabled={!user || likingReview === review._id}
                        title={user ? 'Like this review' : 'Sign in to like reviews'}
                      >
                        {likingReview === review._id ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <FaThumbsUp className="text-[11px]" />
                        )}
                        <span>{review.likes}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Comments Section */}
      <div className="border-t border-nx-line pt-8">
        <CommentList movieId={movieId} />
      </div>
    </div>
  );
};

export default ReviewList; 