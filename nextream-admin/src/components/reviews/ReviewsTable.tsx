'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { FaCheck, FaTimes, FaTrash, FaEye, FaThumbsUp } from 'react-icons/fa';
import RatingStars from '../RatingStars';

interface Review {
  _id: string;
  userId: string;
  movieId: string;
  rating: number;
  review: string;
  username: string;
  title: string;
  approved: boolean;
  likes: number;
  createdAt: string;
}

interface ReviewsTableProps {
  filter?: 'all' | 'approved' | 'pending';
  limit?: number;
  movieId?: string;
  onReviewUpdated?: () => void;
}

const ReviewsTable: React.FC<ReviewsTableProps> = ({
  filter = 'all',
  limit,
  movieId,
  onReviewUpdated,
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
  }, [filter, movieId]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      
      let url = '/api/reviews';
      const params = new URLSearchParams();
      
      if (filter === 'approved') {
        params.append('approved', 'true');
      } else if (filter === 'pending') {
        params.append('approved', 'false');
      }
      
      if (movieId) {
        params.append('movieId', movieId);
      }
      
      if (limit) {
        params.append('limit', limit.toString());
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const token = localStorage.getItem('admin-auth-token');
      const response = await axios.get(url, {
        headers: {
          token: `Bearer ${token}`,
        },
      });
      
      setReviews(response.data);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReview = async (reviewId: string, approve: boolean) => {
    try {
      setProcessingId(reviewId);
      
      const token = localStorage.getItem('admin-auth-token');
      await axios.put(
        `/api/reviews/${reviewId}/approve`,
        { approved: approve },
        {
          headers: {
            token: `Bearer ${token}`,
          },
        }
      );
      
      // Update the reviews list
      setReviews((prevReviews) =>
        prevReviews.map((review) =>
          review._id === reviewId ? { ...review, approved: approve } : review
        )
      );
      
      if (onReviewUpdated) {
        onReviewUpdated();
      }
    } catch (err) {
      console.error('Error updating review:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Are you sure you want to delete this review?')) {
      return;
    }
    
    try {
      setProcessingId(reviewId);
      
      const token = localStorage.getItem('admin-auth-token');
      await axios.delete(`/api/reviews/${reviewId}`, {
        headers: {
          token: `Bearer ${token}`,
        },
      });
      
      // Update the reviews list
      setReviews((prevReviews) =>
        prevReviews.filter((review) => review._id !== reviewId)
      );
      
      if (onReviewUpdated) {
        onReviewUpdated();
      }
    } catch (err) {
      console.error('Error deleting review:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded">
        {error}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="bg-gray-50 p-6 text-center rounded">
        <p className="text-gray-500">No reviews found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              User
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Movie
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rating
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Likes
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {reviews.map((review) => (
            <tr key={review._id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {review.username}
                </div>
                <div className="text-sm text-gray-500">
                  ID: {review.userId.substring(0, 8)}...
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {review.title}
                </div>
                <div className="text-sm text-gray-500">
                  ID: {review.movieId.substring(0, 8)}...
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <RatingStars rating={review.rating} size={16} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(review.createdAt)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {review.approved ? (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Approved
                  </span>
                ) : (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div className="flex items-center">
                  <FaThumbsUp className="text-blue-500 mr-1" />
                  {review.likes}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end space-x-2">
                  <Link
                    href={`/movies/${review.movieId}`}
                    className="text-indigo-600 hover:text-indigo-900"
                    title="View Movie"
                  >
                    <FaEye />
                  </Link>
                  
                  {review.approved ? (
                    <button
                      onClick={() => handleApproveReview(review._id, false)}
                      disabled={processingId === review._id}
                      className="text-yellow-600 hover:text-yellow-900"
                      title="Unapprove Review"
                    >
                      <FaTimes />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApproveReview(review._id, true)}
                      disabled={processingId === review._id}
                      className="text-green-600 hover:text-green-900"
                      title="Approve Review"
                    >
                      <FaCheck />
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDeleteReview(review._id)}
                    disabled={processingId === review._id}
                    className="text-red-600 hover:text-red-900"
                    title="Delete Review"
                  >
                    <FaTrash />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReviewsTable; 