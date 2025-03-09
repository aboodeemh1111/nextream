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
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      {error && (
        <div className="bg-red-900 text-white p-2 rounded mb-4 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-white">
            <FaTimes />
          </button>
        </div>
      )}
      {success && (
        <div className="bg-green-900 text-white p-2 rounded mb-4 flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-white">
            <FaTimes />
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-white mb-2">Your Rating</label>
          <div className="flex items-center">
            <RatingStars 
              rating={rating} 
              interactive={true}
              size={32} 
              onRatingChange={handleRatingChange} 
            />
            <span className="ml-2 text-white">{rating > 0 ? `${rating}/5` : 'Select a rating'}</span>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            You can only rate a movie once, but you can edit your rating anytime.
          </p>
        </div>
        <div>
          <label className="block text-white mb-2">Your Review (Optional)</label>
          <textarea
            className="w-full p-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center space-x-2 disabled:opacity-50"
            disabled={isSubmitting}
          >
            <span>{isSubmitting ? 'Submitting...' : existingReview ? 'Update Rating' : 'Submit Rating'}</span>
            <FaPaperPlane className="ml-2" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReviewForm; 