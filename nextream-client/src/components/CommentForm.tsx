'use client';

import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { FaPaperPlane, FaTimes } from 'react-icons/fa';

interface CommentFormProps {
  movieId: string;
  onCommentSubmitted?: (comment: any) => void;
  existingComment?: any;
  className?: string;
}

const CommentForm: React.FC<CommentFormProps> = ({
  movieId,
  onCommentSubmitted,
  existingComment,
  className = '',
}) => {
  const [commentText, setCommentText] = useState(existingComment?.comment || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to submit a comment');
      return;
    }

    if (!commentText.trim()) {
      setError('Please enter a comment');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      let response;

      if (existingComment) {
        // Update existing comment
        response = await axios.put(
          `/api/comments/${existingComment._id}`,
          {
            comment: commentText,
          },
          {
            headers: {
              token: `Bearer ${user.accessToken}`,
            },
          }
        );
        setSuccess('Your comment has been updated!');
      } else {
        // Create new comment
        response = await axios.post(
          '/api/comments',
          {
            movieId,
            comment: commentText,
          },
          {
            headers: {
              token: `Bearer ${user.accessToken}`,
            },
          }
        );
        setSuccess('Your comment has been submitted!');
      }

      setCommentText('');
      if (onCommentSubmitted) {
        onCommentSubmitted(response.data);
      }
    } catch (err: any) {
      console.error('Error submitting comment:', err.response?.data || err);
      setError(err.response?.data?.message || 'Failed to submit comment. Please try again.');
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
          <textarea
            className="w-full p-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Write your comment here..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center space-x-2 disabled:opacity-50"
            disabled={isSubmitting}
          >
            <span>{existingComment ? 'Update Comment' : 'Post Comment'}</span>
            <FaPaperPlane />
          </button>
        </div>
      </form>
    </div>
  );
};

export default CommentForm; 