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
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <textarea
            className="w-full rounded-lg border border-nx-line bg-nx-elevated p-3 text-sm text-nx-ink placeholder:text-nx-dim focus:outline-none focus-visible:nx-focus"
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
            className="inline-flex items-center gap-2 rounded-md bg-nx-ink px-5 py-2.5 text-sm font-bold text-nx-black transition duration-200 hover:scale-[1.03] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:nx-focus"
            disabled={isSubmitting}
          >
            <span>{existingComment ? 'Update comment' : 'Post comment'}</span>
            <FaPaperPlane className="text-xs" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default CommentForm; 