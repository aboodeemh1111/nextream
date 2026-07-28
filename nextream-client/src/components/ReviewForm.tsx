'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import RatingStars from './RatingStars';
import { FaPaperPlane, FaTimes } from 'react-icons/fa';

interface ReviewFormProps {
  movieId: string;
  onReviewSubmitted?: (review: any) => void;
  existingReview?: any;
  className?: string;
}

const ReviewForm: React.FC<ReviewFormProps> = ({
  movieId,
  onReviewSubmitted,
  existingReview,
  className = '',
}) => {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [reviewText, setReviewText] = useState(existingReview?.review || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating || 0);
      setReviewText(existingReview.review || '');
    }
  }, [existingReview]);

  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to submit a rating');
      return;
    }

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      let response;

      if (existingReview) {
        // Update existing review
        response = await axios.put(
          `/api/reviews/${existingReview._id}`,
          {
            rating,
            review: reviewText,
          },
          {
            headers: {
              token: `Bearer ${user.accessToken}`,
            },
          }
        );
        setSuccess('Your rating has been updated!');
      } else {
        // Create new review
        response = await axios.post(
          '/api/reviews',
          {
            movieId,
            rating,
            review: reviewText,
          },
          {
            headers: {
              token: `Bearer ${user.accessToken}`,
            },
          }
        );
        setSuccess('Your rating has been submitted!');
      }

      if (onReviewSubmitted) {
        onReviewSubmitted(response.data.review || response.data);
      }
    } catch (err: any) {
      console.error('Error submitting review:', err.response?.data || err);
      if (err.response?.status === 400 && err.response?.data === "You have already reviewed this movie") {
        setError('You have already rated this movie. You can edit your existing rating above.');
      } else {
        setError(err.response?.data?.message || 'Failed to submit rating. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`rounded-xl border border-nx-line bg-nx-surface p-5 ${className}`}>
      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-nx-accent/40 bg-nx-accent/10 p-3 text-sm text-nx-ink">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-nx-muted transition hover:text-nx-ink" aria-label="Dismiss">
            <FaTimes />
          </button>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-nx-ink">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-nx-muted transition hover:text-nx-ink" aria-label="Dismiss">
            <FaTimes />
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold text-nx-ink">Your rating</label>
          <div className="flex flex-wrap items-center gap-3">
            <RatingStars
              rating={rating}
              interactive={true}
              size={32}
              onRatingChange={handleRatingChange}
              className="transition-transform duration-200 hover:scale-105"
            />
            <span className="text-sm text-nx-muted">
              {rating > 0 ? `${rating}/5` : 'Select a rating'}
            </span>
          </div>
          <p className="mt-2 text-xs text-nx-dim">
            You can only rate a movie once, but you can edit your rating anytime.
          </p>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-nx-ink">
            Your review <span className="font-normal text-nx-dim">(optional)</span>
          </label>
          <textarea
            className="w-full rounded-lg border border-nx-line bg-nx-elevated p-3 text-sm text-nx-ink placeholder:text-nx-dim focus:outline-none focus-visible:nx-focus"
            rows={3}
            placeholder="Share your thoughts about this movie..."
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-nx-ink px-5 py-2.5 text-sm font-bold text-nx-black transition duration-200 hover:scale-[1.03] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:nx-focus"
            disabled={isSubmitting}
          >
            <span>{isSubmitting ? 'Submitting...' : existingReview ? 'Update rating' : 'Submit rating'}</span>
            <FaPaperPlane className="text-xs" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReviewForm; 