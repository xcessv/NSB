import React, { useState, useEffect, useRef, useCallback } from 'react';
import Comment from './Comment';
import CommentForm from './CommentForm';
import { Card } from '@/components/ui/card';
import { Loader } from 'lucide-react';
import { refreshActivities } from '../../services/api';
import config from '../../config';

const CommentThread = ({
  reviewId,
  initialComments = [],
  currentUser,
  onCommentAdded = () => {},
  onCommentLike = () => {},
  onCommentDeleted = () => {},
  showReplyForm = true,
  maxDepth = 5
}) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNotification, setShowNotification] = useState(null);
  const [forceUpdate, setForceUpdate] = useState(false);
  
  // Helper function to flatten comments
  const flattenComments = (commentsArr = []) => {
    let flattened = [];
    for (const comment of commentsArr) {
      flattened.push(comment);
      if (comment.children && comment.children.length > 0) {
        flattened = flattened.concat(flattenComments(comment.children));
      }
    }
    return flattened;
  };

  // Organize comments into a tree structure (parent-child relationship)
  const organizeComments = useCallback((flatComments) => {
    if (!Array.isArray(flatComments)) {
      console.error('organizeComments received invalid comments:', flatComments);
      return [];
    }
    
    console.log('Organizing comments:', flatComments.length);
    
    const commentMap = {};
    const topLevelComments = [];

    // First pass: Create lookup map
    flatComments.forEach(comment => {
      if (!comment._id) return; // Skip invalid comments
      commentMap[comment._id] = { ...comment, children: [] };
    });

    // Second pass: Organize into tree
    flatComments.forEach(comment => {
      if (!comment._id) return; // Skip invalid comments
      
      const commentWithChildren = commentMap[comment._id];
      
      if (comment.parentId && commentMap[comment.parentId]) {
        // Add as child to parent
        commentMap[comment.parentId].children.push(commentWithChildren);
      } else {
        // Add to top level
        topLevelComments.push(commentWithChildren);
      }
    });

    // Sort comments by date (newest first)
    const sortByDate = (a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB; // Oldest first (chronological)
    };

    // Sort all levels
    const sortCommentsRecursive = (commentsArray) => {
      commentsArray.sort(sortByDate);
      commentsArray.forEach(comment => {
        if (comment.children && comment.children.length > 0) {
          sortCommentsRecursive(comment.children);
        }
      });
      return commentsArray;
    };

    return sortCommentsRecursive(topLevelComments);
  }, []);

  // Initialize comments
  useEffect(() => {
    if (initialComments && initialComments.length > 0) {
      console.log('CommentThread: initialComments changed, reorganizing', initialComments.length);
      const organized = organizeComments(initialComments);
      setComments(organized);
    }
  }, [initialComments, organizeComments, forceUpdate]);

  // Create a function to add a comment
  const handleAddComment = async (formData) => {
    try {
      if (!currentUser) {
        setShowNotification({
          type: 'info',
          message: 'You need to log in to comment'
        });
        return null;
      }

      setLoading(true);
      setError(null);

      // Create a FormData object to send to the server
      const commentFormData = new FormData();
      commentFormData.append('text', formData.text);
      
      if (formData.parentId) {
        commentFormData.append('parentId', formData.parentId);
      }
      
      if (formData.media) {
        commentFormData.append('media', formData.media);
      }

      // Call the API directly
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${config.API_URL}/reviews/${reviewId}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: commentFormData
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const updatedReview = await response.json();

      // Update local comments with the server response
      if (updatedReview && updatedReview.comments) {
        const organized = organizeComments(updatedReview.comments);
        setComments(organized);
        
        // Update local storage for persistence
        try {
          const cachedReviews = JSON.parse(localStorage.getItem('cachedReviews') || '{}');
          cachedReviews[reviewId] = {
            ...cachedReviews[reviewId],
            comments: updatedReview.comments,
            timestamp: Date.now()
          };
          localStorage.setItem('cachedReviews', JSON.stringify(cachedReviews));
        } catch (cacheError) {
          console.warn('Failed to update comment cache:', cacheError);
        }
        
        // If initialComments is present, update it as well
        if (initialComments) {
          initialComments.length = 0;
          updatedReview.comments.forEach(comment => {
            initialComments.push(comment);
          });
        }
      }

      // Call parent callback
      onCommentAdded(updatedReview);

      setShowNotification({
        type: 'success',
        message: formData.parentId ? 'Reply added successfully' : 'Comment added successfully'
      });
      
      // Refresh activities
      try {
        setTimeout(() => {
          if (typeof refreshActivities === 'function') {
            refreshActivities();
          }
        }, 0);
      } catch (refreshError) {
        console.warn('Failed to refresh activities:', refreshError);
      }

      return true;
    } catch (error) {
      console.error('Add comment error:', error);
      setError('Failed to add comment. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCommentLike = async (commentId, alreadyProcessed = false) => {
  try {
    if (!currentUser) {
      setShowNotification({
        type: 'info',
        message: 'You need to log in to like comments'
      });
      return null;
    }
    
    console.log('CommentThread: Like request for commentId:', commentId, 'alreadyProcessed:', alreadyProcessed);
    
    // Skip API call if already processed
    if (alreadyProcessed) {
      console.log('CommentThread: Like already processed, skipping API call');
      
      // Still call parent callback to update UI
      if (typeof onCommentLike === 'function') {
        onCommentLike(commentId, true);
      }
      
      return true;
    }
    
    // If not already processed, continue with normal API call
    // Ensure commentId is a string
    const commentIdStr = typeof commentId === 'string' 
      ? commentId 
      : (commentId && commentId._id 
          ? commentId._id.toString() 
          : String(commentId));
    
    const reviewIdStr = reviewId.toString();
    
    // IMPORTANT: Validate the commentId to ensure it's not the same as reviewId
    if (!commentIdStr || commentIdStr === reviewIdStr) {
      console.error('Invalid comment ID for liking. CommentId:', commentIdStr, 'ReviewId:', reviewIdStr);
      throw new Error('Invalid comment ID');
    }
    
    console.log('CommentThread: Liking comment:', commentIdStr, 'in review:', reviewIdStr);
    
    // Set loading state
    setLoading(true);
    
    // Call the API directly
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(
      `${config.API_URL}/reviews/${reviewIdStr}/comments/${commentIdStr}/like`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error('Failed to like comment');
    }
    
    const updatedReview = await response.json();
    console.log('Received updated review after comment like');
    
    // Find the updated comment in the flat comments array
    let updatedComment = null;
    if (updatedReview && updatedReview.comments) {
      // Find by commentId in flat array
      updatedComment = updatedReview.comments.find(c => c._id === commentIdStr || c._id.toString() === commentIdStr);
    }
    
    // Organize comments if we have the function available
    if (updatedReview && updatedReview.comments && typeof organizeComments === 'function') {
      const organized = organizeComments(updatedReview.comments);
      setComments(organized);
    }
    
    // If initialComments is present, update it as well to ensure consistency
    if (Array.isArray(initialComments)) {
      // Clear and update
      initialComments.length = 0;
      if (updatedReview && updatedReview.comments) {
        updatedReview.comments.forEach(comment => {
          initialComments.push(comment);
        });
      }
    }
    
    // Call parent callback for likes if provided
    if (typeof onCommentLike === 'function') {
      onCommentLike(updatedReview, true); // Mark as already processed
    }
    
    return updatedComment;
  } catch (error) {
    console.error('Like comment error in CommentThread:', error);
    setError('Failed to like the comment. Please try again.');
    return null;
  } finally {
    setLoading(false);
  }
};

  // Handle comment deletion
  const handleCommentDelete = useCallback(async (reviewId, commentId) => {
    try {
      // Call the API directly
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${config.API_URL}/reviews/${reviewId}/comments/${commentId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      const updatedReview = await response.json();

      // Update local comments with the server response
      if (updatedReview && updatedReview.comments) {
        const organized = organizeComments(updatedReview.comments);
        setComments(organized);
        
        // Update localStorage cache
        try {
          const cachedReviews = JSON.parse(localStorage.getItem('cachedReviews') || '{}');
          cachedReviews[reviewId] = {
            ...cachedReviews[reviewId],
            comments: updatedReview.comments,
            timestamp: Date.now()
          };
          localStorage.setItem('cachedReviews', JSON.stringify(cachedReviews));
          
          // Also remove the specific comment cache
          localStorage.removeItem(`comment-${reviewId}-${commentId}`);
        } catch (cacheError) {
          console.warn('Failed to update comment cache:', cacheError);
        }
        
        // If initialComments is present, update it as well
        if (initialComments) {
          initialComments.length = 0;
          updatedReview.comments.forEach(comment => {
            initialComments.push(comment);
          });
        }
      }

      // Call parent callback
      onCommentDeleted(updatedReview);

      // Refresh activities
      try {
        setTimeout(() => {
          if (typeof refreshActivities === 'function') {
            refreshActivities();
          }
        }, 0);
      } catch (refreshError) {
        console.warn('Failed to refresh activities:', refreshError);
      }

      return true;
    } catch (error) {
      console.error('Delete comment error:', error);
      setError('Failed to delete comment. Please try again.');
      return null;
    }
  }, [organizeComments, initialComments, onCommentDeleted]);

  // Reset notification after a delay
  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  return (
    <div className="space-y-4">
      {showNotification && (
        <div className={`p-2 text-sm rounded ${
          showNotification.type === 'success' 
            ? 'bg-green-500/10 text-green-500' 
            : 'bg-blue-500/10 text-blue-500'
        }`}>
          {showNotification.message}
        </div>
      )}
      
      {showReplyForm && (
        <CommentForm
          currentUser={currentUser}
          onSubmit={handleAddComment}
          reviewId={reviewId}
          isLoading={loading}
        />
      )}
      
      {loading && (
        <div className="flex justify-center p-4">
          <Loader className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
      
      {error && (
        <div className="p-2 text-sm rounded bg-red-500/10 text-red-500">
          {error}
        </div>
      )}
      
      <div className="space-y-2">
        {comments.map(comment => (
          <Comment
            key={comment._id}
            comment={comment}
            currentUser={currentUser}
            reviewId={reviewId}
            onLike={handleCommentLike}
            onReply={handleAddComment}
            onDelete={handleCommentDelete}
            depth={0}
            nestedView={true}
            maxDepth={maxDepth}
          />
        ))}
        
        {!loading && comments.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            No comments yet. Be the first to comment!
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentThread;