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
    <div className={`space-y-6 ${className}`}>
      <h3 className="text-xl font-semibold text-white">Comments</h3>
      
      <CommentForm movieId={movieId} onCommentSubmitted={handleCommentSubmitted} />
      
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-900 text-white p-4 rounded">{error}</div>
      ) : comments.length === 0 ? (
        <div className="text-gray-400 text-center py-8">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment._id} className="bg-gray-800 rounded-lg p-4">
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
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-white">{comment.username}</h4>
                      <div className="flex items-center text-gray-400 text-sm">
                        <FaClock className="mr-1" />
                        <span>
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    {user && user.id === comment.userId && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingCommentId(comment._id)}
                          className="text-blue-400 hover:text-blue-300"
                          title="Edit comment"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment._id)}
                          className="text-red-400 hover:text-red-300"
                          title="Delete comment"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-gray-300">{comment.comment}</p>
                  <div className="mt-3 flex items-center">
                    <button
                      onClick={() => handleLikeComment(comment._id)}
                      className={`flex items-center space-x-1 ${
                        user && comment.likedBy.includes(user.id)
                          ? 'text-blue-500'
                          : 'text-gray-400 hover:text-blue-400'
                      }`}
                      disabled={!user}
                      title={user ? 'Like this comment' : 'Sign in to like comments'}
                    >
                      <FaThumbsUp />
                      <span>{comment.likes}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentList; 