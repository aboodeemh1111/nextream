"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import {
  FaCheck,
  FaTimes,
  FaTrash,
  FaEye,
  FaThumbsUp,
  FaExclamationTriangle,
  FaSyncAlt,
} from "react-icons/fa";
import RatingStars from "../RatingStars";
import { useAuth } from "@/context/AuthContext";
import FuturisticAdminCard from "../FuturisticAdminCard";
import FuturisticAdminButton from "../FuturisticAdminButton";

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
  filter?: "all" | "approved" | "pending";
  limit?: number;
  movieId?: string;
  onReviewUpdated?: () => void;
}

const ReviewsTable: React.FC<ReviewsTableProps> = ({
  filter = "all",
  limit,
  movieId,
  onReviewUpdated,
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchReviews();
    }
  }, [filter, movieId, user]);

  const fetchReviews = async () => {
    try {
      setLoading(true);

      let url = "/api/reviews";
      const params = new URLSearchParams();

      if (filter === "approved") {
        params.append("approved", "true");
      } else if (filter === "pending") {
        params.append("approved", "false");
      }

      if (movieId) {
        params.append("movieId", movieId);
      }

      if (limit) {
        params.append("limit", limit.toString());
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      // Ensure we're using the token from the auth context
      const response = await axios.get(url, {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      });

      setReviews(response.data);
    } catch (err: any) {
      console.error("Error fetching reviews:", err);
      setError(
        err.response?.status === 403
          ? "Authentication error: You do not have permission to access reviews."
          : "Failed to load reviews: " +
              (err.response?.data?.message || err.message)
      );

      // Mock data for development
      if (process.env.NODE_ENV === "development") {
        const mockReviews: Review[] = Array.from({ length: 10 }, (_, i) => ({
          _id: `mock-${i}`,
          userId: `user-${i}`,
          movieId: `movie-${i % 3}`,
          rating: Math.floor(Math.random() * 5) + 1,
          review: `This is a mock review #${i} for testing purposes.`,
          username: `user${i}`,
          title: [`Inception`, `The Matrix`, `Interstellar`][i % 3],
          approved: i % 2 === 0,
          likes: Math.floor(Math.random() * 50),
          createdAt: new Date(Date.now() - i * 86400000).toISOString(),
        }));

        if (filter === "approved") {
          setReviews(mockReviews.filter((r) => r.approved));
        } else if (filter === "pending") {
          setReviews(mockReviews.filter((r) => !r.approved));
        } else {
          setReviews(mockReviews);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReview = async (reviewId: string, approve: boolean) => {
    try {
      setProcessingId(reviewId);

      await axios.put(
        `/api/reviews/${reviewId}/approve`,
        { approved: approve },
        {
          headers: {
            token: `Bearer ${user?.accessToken}`,
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
    } catch (err: any) {
      console.error("Error updating review:", err);
      setError(
        "Failed to update review: " +
          (err.response?.data?.message || err.message)
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm("Are you sure you want to delete this review?")) {
      return;
    }

    try {
      setProcessingId(reviewId);

      await axios.delete(`/api/reviews/${reviewId}`, {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      });

      // Update the reviews list
      setReviews((prevReviews) =>
        prevReviews.filter((review) => review._id !== reviewId)
      );

      if (onReviewUpdated) {
        onReviewUpdated();
      }
    } catch (err: any) {
      console.error("Error deleting review:", err);
      setError(
        "Failed to delete review: " +
          (err.response?.data?.message || err.message)
      );
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-t-4 border-b-4 border-blue-500 animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-t-4 border-b-4 border-indigo-500 animate-spin animation-delay-500"></div>
        </div>
        <p className="ml-4 text-slate-300">Loading reviews...</p>
      </div>
    );
  }

  if (error) {
    return (
      <FuturisticAdminCard
        className="border-red-500/50 bg-red-900/20"
        icon={<FaExclamationTriangle />}
        title="Error Loading Reviews"
      >
        <p className="text-slate-300">{error}</p>
        <div className="mt-4">
          <FuturisticAdminButton
            variant="secondary"
            size="sm"
            onClick={() => {
              setError(null);
              fetchReviews();
            }}
            icon={<FaSyncAlt />}
          >
            Retry
          </FuturisticAdminButton>
        </div>
      </FuturisticAdminCard>
    );
  }

  if (reviews.length === 0) {
    return (
      <FuturisticAdminCard
        className="border-blue-500/50 bg-blue-900/10"
        icon={<FaEye />}
        title="No Reviews Found"
      >
        <p className="text-slate-300">
          {filter === "pending"
            ? "There are no pending reviews to approve."
            : filter === "approved"
            ? "No approved reviews yet."
            : "No reviews found."}
        </p>
      </FuturisticAdminCard>
    );
  }

  return (
    <div className="overflow-x-auto bg-slate-800/20 rounded-lg border border-slate-700">
      <table className="min-w-full divide-y divide-slate-700">
        <thead className="bg-slate-800/50">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
            >
              User
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
            >
              Movie
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
            >
              Rating
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
            >
              Date
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
            >
              Likes
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {reviews.map((review) => (
            <tr
              key={review._id}
              className="hover:bg-slate-700/30 transition-colors"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-slate-200">
                  {review.username}
                </div>
                <div className="text-xs text-slate-400">
                  ID: {review.userId.substring(0, 8)}...
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-slate-200">
                  {review.title}
                </div>
                <div className="text-xs text-slate-400">
                  ID: {review.movieId.substring(0, 8)}...
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <RatingStars rating={review.rating} size={16} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                {formatDate(review.createdAt)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {review.approved ? (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-500/30">
                    Approved
                  </span>
                ) : (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-900/50 text-amber-300 border border-amber-500/30">
                    Pending
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                <div className="flex items-center">
                  <FaThumbsUp className="text-blue-400 mr-1" />
                  {review.likes}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <FuturisticAdminButton
                  variant="primary"
                  size="sm"
                  icon={<FaEye />}
                  className="inline-flex"
                  onClick={() => {
                    // In a real app, you would redirect to a detail page or show a modal
                    alert(`Review: ${review.review}`);
                  }}
                >
                  View
                </FuturisticAdminButton>

                {!review.approved && (
                  <FuturisticAdminButton
                    variant="success"
                    size="sm"
                    icon={<FaCheck />}
                    className="inline-flex"
                    loading={processingId === review._id}
                    onClick={() => handleApproveReview(review._id, true)}
                  >
                    Approve
                  </FuturisticAdminButton>
                )}

                {review.approved && (
                  <FuturisticAdminButton
                    variant="danger"
                    size="sm"
                    icon={<FaTimes />}
                    className="inline-flex"
                    loading={processingId === review._id}
                    onClick={() => handleApproveReview(review._id, false)}
                  >
                    Reject
                  </FuturisticAdminButton>
                )}

                <FuturisticAdminButton
                  variant="danger"
                  size="sm"
                  icon={<FaTrash />}
                  className="inline-flex"
                  loading={processingId === review._id}
                  onClick={() => handleDeleteReview(review._id)}
                >
                  Delete
                </FuturisticAdminButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReviewsTable;
