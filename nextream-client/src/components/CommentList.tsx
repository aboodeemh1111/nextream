'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import CommentForm from './CommentForm';
import { FaThumbsUp, FaEdit, FaTrash, FaClock } from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  _id: string;
  userId: string;
  movieId: string;
  comment: string;
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
  [key: string]: any; // Allow for other properties
}

interface CommentListProps {
  movieId: string;
  className?: string;
}

const CommentList: React.FC<CommentListProps> = ({ movieId, className = '' }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const { user } = useAuth() as { user: User | null };

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/comments/movie/${movieId}`);
      setComments(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching comments:', err);
      setError('Failed to load comments. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [movieId]);

  const handleCommentSubmitted = (newComment: Comment) => {
    setComments((prevComments) => [newComment, ...prevComments]);
    setEditingCommentId(null);
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;

    try {
      await axios.put(
        `/api/comments/${commentId}/like`,
        {},
        {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        }
      );
      fetchComments(); // Refresh comments to get updated likes
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;

    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        await axios.delete(`/api/comments/${commentId}`, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        setComments((prevComments) => prevComments.filter((comment) => comment._id !== commentId));
      } catch (err) {
        console.error('Error deleting comment:', err);
      }
    }
  };

  return (
    <div className={`space-y-5 ${className}`}>
      <h3 className="text-lg font-semibold text-nx-ink">
        Comments
        {comments.length > 0 && (
          <span className="ml-2 text-sm font-normal text-nx-dim">{comments.length}</span>
        )}
      </h3>

      <CommentForm movieId={movieId} onCommentSubmitted={handleCommentSubmitted} />

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((row) => (
            <div key={row} className="nx-skeleton h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-nx-accent/40 bg-nx-accent/10 p-4 text-sm text-nx-ink">
          {error}
        </div>
      ) : comments.length === 0 ? (
        <p className="py-10 text-center text-sm text-nx-muted">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const liked = Boolean(user && comment.likedBy.includes(user.id));

            return (
              <div
                key={comment._id}
                className="rounded-xl border border-nx-line bg-nx-surface p-5 transition duration-300 hover:border-white/20 hover:bg-nx-elevated"
              >
                {editingCommentId === comment._id ? (
                  <CommentForm
                    movieId={movieId}
                    existingComment={comment}
                    onCommentSubmitted={(updatedComment) => {
                      setComments((prevComments) =>
                        prevComments.map((c) => (c._id === updatedComment._id ? updatedComment : c))
                      );
                      setEditingCommentId(null);
                    }}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 gap-3">
                        <span
                          aria-hidden
                          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nx-elevated text-sm font-bold uppercase text-nx-muted"
                        >
                          {comment.username?.charAt(0) || '?'}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-nx-ink">{comment.username}</p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-nx-dim">
                            <FaClock className="text-[10px]" />
                            <span>
                              {formatDistanceToNow(new Date(comment.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      {user && user.id === comment.userId && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingCommentId(comment._id)}
                            className="rounded-md p-2 text-nx-muted transition hover:bg-white/10 hover:text-nx-ink"
                            title="Edit comment"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDeleteComment(comment._id)}
                            className="rounded-md p-2 text-nx-muted transition hover:bg-nx-accent/15 hover:text-nx-accent-soft"
                            title="Delete comment"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-nx-muted">{comment.comment}</p>

                    <div className="mt-4 flex items-center">
                      <button
                        onClick={() => handleLikeComment(comment._id)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          liked
                            ? 'border-nx-cyan/50 bg-nx-cyan/10 text-nx-cyan'
                            : 'border-nx-line text-nx-muted hover:border-white/25 hover:text-nx-ink'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                        disabled={!user}
                        title={user ? 'Like this comment' : 'Sign in to like comments'}
                      >
                        <FaThumbsUp className="text-[11px]" />
                        <span>{comment.likes}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommentList; 