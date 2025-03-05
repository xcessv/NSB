import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ThumbsUp, Reply, Trash2, Check, MoreVertical, ExternalLink, X, Image, Flag, Loader } from 'lucide-react';
import ProfileImage from '../user/ProfileImage';
import CommentForm from './CommentForm';
import { getMediaUrl, isVideo, isGif } from '../../utils/MediaUtils';
import config from '../../config';
import LikesListModal from '../likes/LikesListModal';
import ReportModal from '../report/ReportModal';
import { activityService, refreshActivities } from '../../services/api';

const DEBUG = true; // Enable verbose debugging

// Helper to safely stringify objects for logging
const safeStringify = (obj) => {
  try {
    return JSON.stringify(obj, (key, value) => {
      if (key === 'children' || key === 'media') return '[truncated]';
      return value;
    }, 2);
  } catch (e) {
    return String(obj);
  }
};

// Helper to inspect IDs in various formats
const debugId = (id) => {
  if (!DEBUG) return;
  
  try {
    if (id === null || id === undefined) {
      console.log('ID is null or undefined');
      return;
    }
    
    console.log('ID inspection:');
    console.log('- Raw:', id);
    console.log('- Type:', typeof id);
    console.log('- toString():', String(id));
    
    if (typeof id === 'object') {
      console.log('- Object properties:', Object.keys(id));
      if (id._id) {
        console.log('- _id property:', id._id);
        console.log('- _id type:', typeof id._id);
      }
    }
  } catch (e) {
    console.error('Error inspecting ID:', e);
  }
};

const Comment = ({
  comment,
  currentUser,
  reviewId,
  onLike = () => {},
  onReply,
  onDelete,
  depth = 0,
  nestedView = true,
  maxDepth = 5
}) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(depth < 2);
  const [isLiking, setIsLiking] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [error, setError] = useState(null);
  
  // This crucial state variable will store the likes locally
  const [localLikes, setLocalLikes] = useState([]);
  
  // Add a ref to prevent duplicate API calls
  const likeRequestInProgress = useRef(false);
  
  // Listen for tab/visibility changes to refresh data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // When tab becomes visible, refresh the parent component's data
        // This is a lightweight way to get parent to refresh without building a full event system
        onLike(comment._id);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [comment._id, onLike]);
  
  // Update local likes when comment.likes changes (from parent)
  // FIXED: Create deep copy of likes array to avoid reference issues
  useEffect(() => {
    // Only update if comment.likes exists and has changed
    if (comment?.likes) {
      // Create a deep copy of the likes array
      const freshLikes = Array.isArray(comment.likes) 
        ? comment.likes.map(like => {
            if (typeof like === 'object' && like !== null) {
              return {...like};
            }
            return like;
          }) 
        : [];
        
      setLocalLikes(freshLikes);
      console.log(`Comment ${comment._id} likes synced, count:`, freshLikes.length);
    }
  }, [comment.likes]); // Only depend on comment.likes

  // FIXED: Improved hasUserLiked implementation using string comparison
  const hasUserLiked = useMemo(() => {
    if (!currentUser || !Array.isArray(localLikes) || localLikes.length === 0) {
      return false;
    }
    
    const userId = currentUser._id;
    
    // Use string comparison to avoid reference issues
    return localLikes.some(like => {
      try {
        // If like is an object with _id
        if (typeof like === 'object' && like !== null && like._id) {
          const likeId = typeof like._id === 'string' ? like._id : like._id.toString();
          const userIdStr = typeof userId === 'string' ? userId : userId.toString();
          return likeId === userIdStr;
        }
        // If like is a string ID
        if (typeof like === 'string') {
          return like === userId.toString();
        }
        // If like is an ObjectId (toString it)
        return like.toString() === userId.toString();
      } catch (err) {
        console.error('Error in comment hasUserLiked:', err);
        return false;
      }
    });
  }, [currentUser, localLikes]);

  const canReply = depth < maxDepth;
  const hasReplies = comment.children && comment.children.length > 0;
  
  // Check if the user is the author or admin
  const isAuthor = currentUser && (
    typeof comment.userId === 'string' 
      ? comment.userId === currentUser._id
      : comment.userId?._id === currentUser._id || comment.userId?.id === currentUser._id
  );
  
  const isAdmin = currentUser && currentUser.role === 'admin';
  const canDelete = isAuthor || isAdmin;
  
  const handleLike = async () => {
  if (!currentUser) return;

  // Use ref to prevent duplicate API calls
  if (isLiking || likeRequestInProgress.current) {
    console.log('Comment like request already in progress, ignoring duplicate click');
    return;
  }

  try {
    setIsLiking(true);
    likeRequestInProgress.current = true;
    setError(null);

    // IMPORTANT: Make sure we're passing the comment ID, not the review ID
    const commentId = comment._id ? comment._id.toString() : null;
    
    // Check current like state before making request
    const isCurrentlyLiked = hasUserLiked;
    console.log('Comment.jsx - Making API call to', isCurrentlyLiked ? 'UNLIKE' : 'LIKE', 
      'comment:', commentId);
    
    // Optimistically update UI first
    if (isCurrentlyLiked) {
      const updatedLikes = localLikes.filter(like => {
        if (typeof like === 'object' && like !== null && like._id) {
          return like._id.toString() !== currentUser._id.toString();
        }
        return like.toString() !== currentUser._id.toString();
      });
      setLocalLikes(updatedLikes);
    } else {
      const newLike = {
        _id: currentUser._id,
        displayName: currentUser.displayName,
        profileImage: currentUser.profileImage
      };
      setLocalLikes([...localLikes, newLike]);
    }
    
    // IMPORTANT: Call the API directly here, don't rely on parent component
    // This ensures we're using the correct commentId and reviewId
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(
      `${config.API_URL}/reviews/${reviewId}/comments/${commentId}/like`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(errorData || 'Failed to like comment');
    }

    const updatedReview = await response.json();
    
    // Find the updated comment
    const findComment = (comments, targetId) => {
      if (!comments || !Array.isArray(comments)) return null;
      
      for (const c of comments) {
        if (c._id === targetId) return c;
        if (c.children?.length) {
          const found = findComment(c.children, targetId);
          if (found) return found;
        }
      }
      return null;
    };
    
    const updatedComment = findComment(updatedReview.comments, commentId);
    
    if (updatedComment && updatedComment.likes) {
      // Update with the server's response
      const freshLikes = Array.isArray(updatedComment.likes) 
        ? updatedComment.likes.map(like => {
            if (typeof like === 'object' && like !== null) {
              return {...like};
            }
            return like;
          }) 
        : [];
        
      setLocalLikes(freshLikes);
      
      // Update the original comment object
      if (comment) {
        comment.likes = [...freshLikes];
      }
    }
    
    // Call the parent's onLike function to update UI without making another API call
    // IMPORTANT: Use a flag to indicate the API call has already been made
    if (typeof onLike === 'function') {
      // This will now just trigger UI updates, not another API call
      try {
        onLike(commentId, true); // true = already processed
      } catch (err) {
        console.warn('Non-critical error in parent onLike:', err);
      }
    }
    
    // Try to refresh activities for consistency
    try {
      setTimeout(() => {
        if (typeof refreshActivities === 'function') {
          refreshActivities();
        }
      }, 0);
    } catch (refreshError) {
      console.warn('Failed to refresh activities:', refreshError);
    }
    
  } catch (error) {
    console.error('Comment like error:', error);
    setError(error.message || 'Failed to like comment');
    
    // Revert optimistic update on error
    setLocalLikes(comment.likes || []);
  } finally {
    setIsLiking(false);
    likeRequestInProgress.current = false;
  }
};

  const handleReply = async (formData) => {
    try {
      await onReply(formData);
      setShowReplyForm(false);
      setShowReplies(true);
      
      // Refresh activities after successful reply
      refreshActivities().catch(err => console.error('Failed to refresh activities after reply:', err));
    } catch (error) {
      console.error('Reply error:', error);
      setError('Failed to add reply');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this comment and all its replies?')) {
      try {
        await onDelete(reviewId, comment._id);
        
        // Refresh activities after successful delete
        refreshActivities().catch(err => console.error('Failed to refresh activities after delete:', err));
      } catch (error) {
        console.error('Delete error:', error);
        setError('Failed to delete comment');
      }
    }
  };

  const formatDate = (date) => {
    try {
      const now = new Date();
      const commentDate = new Date(date);
      const diffMs = now - commentDate;

      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) {
        return 'just now';
      } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
      } else if (diffDays < 7) {
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
      } else {
        return commentDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    } catch (e) {
      return 'some time ago';
    }
  };

  // Use consistent media URL function from MediaUtils
  const getCommentMediaUrl = (media) => {
    return getMediaUrl(media, 'comment');
  };

  const handleImageError = (e) => {
    console.error('Media load error:', {
      media: comment.media,
      url: e.target.src,
      error: e
    });
    setImageError(true);
  };

  const renderMedia = () => {
    if (!comment.media || imageError) return null;

    // Process media URL using our utility function
    const mediaUrl = getCommentMediaUrl(comment.media);
    if (!mediaUrl) return null;

    const isImageMedia = !isVideo(comment.media);
    const isGifMedia = isGif(comment.media);

    return (
      <div className="mt-2">
        {isImageMedia && (
          <div className="relative group">
            <img
              src={mediaUrl}
              alt={`${comment.userDisplayName}'s media`}
              className="max-h-60 rounded-lg object-contain bg-black/5 hover:bg-black/10 transition-colors cursor-pointer"
              onClick={() => setShowFullscreen(true)}
              onError={handleImageError}
              key={mediaUrl}
              loading="lazy"
            />
            <div className="absolute top-2 right-2 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(mediaUrl, '_blank');
                }}
                className="p-1 hover:bg-black/30 rounded-full"
                title="Open image in new tab"
              >
                <ExternalLink className="h-4 w-4 text-white" />
              </button>
            </div>
            {isGifMedia && (
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded-md text-white text-xs">
                GIF
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div id={`comment-${comment._id}`} className={`${depth > 0 ? 'ml-6 md:ml-12 mt-3' : 'mt-4'}`}>
      <div className="flex">
        <div className="flex-shrink-0 mr-3">
          <ProfileImage
            user={{
              _id: typeof comment.userId === 'string' ? comment.userId :
                (typeof comment.userId === 'object' ?
                  (comment.userId._id || comment.userId.id || '') : ''),
              displayName: comment.userDisplayName || 'Unknown',
              profileImage: comment.userImage
            }}
            size={depth === 0 ? "md" : "sm"}
          />
        </div>

        <div className="flex-grow">
          <div className="bg-secondary p-3 rounded-lg relative">
            <div className="flex justify-between">
              <div className="font-semibold">{comment.userDisplayName}</div>
              
              {(canDelete || currentUser) && (
                <div className="relative">
                  <button
                    onClick={() => setShowOptions(!showOptions)}
                    className="p-1 text-muted-foreground hover:text-foreground rounded-full"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {showOptions && (
                    <div className="absolute right-0 top-6 bg-card shadow-lg rounded-lg z-10 overflow-hidden">
                      {canDelete ? (
                        <button
                          onClick={handleDelete}
                          className="px-4 py-2 text-sm text-red-500 hover:bg-secondary w-full text-left flex items-center"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </button>
                      ) : currentUser && !isAuthor && !isAdmin && (
                        <button
                          onClick={() => {
                            setShowOptions(false);
                            setShowReportModal(true);
                          }}
                          className="px-4 py-2 text-sm text-muted-foreground hover:bg-secondary w-full text-left flex items-center"
                        >
                          <Flag className="h-4 w-4 mr-2" />
                          Report
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="text-foreground mt-1 whitespace-pre-line break-words">
              {comment.text}
            </div>

            {renderMedia()}

            <div className="text-xs text-muted-foreground mt-2">
              {formatDate(comment.date)}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-1 pl-1">
            <button
              onClick={handleLike}
              disabled={!currentUser || isLiking}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                hasUserLiked
                  ? 'liked-button'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isLiking ? (
                <Loader className="h-3.5 w-3.5 animate-spin" />
              ) : hasUserLiked ? (
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              ) : (
                <ThumbsUp className="h-3.5 w-3.5" />
              )}
              <span>{localLikes.length}</span>
            </button>

            {localLikes.length > 0 && (
              <button
                onClick={() => setShowLikes(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {(() => {
                  if (!currentUser || !localLikes.length) return null;
                  if (hasUserLiked) {
                    if (localLikes.length === 1) {
                      return 'You like this';
                    } else if (localLikes.length === 2) {
                      return 'You and 1 other';
                    } else {
                      return `You and ${localLikes.length - 1} others`;
                    }
                  }
                  return null;
                })()}
              </button>
            )}

            {canReply && currentUser && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Reply className="h-3.5 w-3.5" />
                <span>Reply</span>
              </button>
            )}

            {hasReplies && nestedView && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{showReplies ? 'Hide' : 'Show'}</span>
                <span>{comment.children.length}</span>
                <span>{comment.children.length === 1 ? 'reply' : 'replies'}</span>
              </button>
            )}
          </div>

          {showReplyForm && (
            <div className="mt-3">
              <CommentForm
                currentUser={currentUser}
                onSubmit={handleReply}
                placeholder={`Reply to ${comment.userDisplayName}...`}
                isReply={true}
                parentId={comment._id}
                reviewId={reviewId}
                onCancel={() => setShowReplyForm(false)}
              />
            </div>
          )}

          {hasReplies && nestedView && showReplies && (
            <div className="ml-3 border-l-2 border-border pl-3 mt-3">
              {comment.children.map(reply => (
                <Comment
                  key={reply._id}
                  comment={reply}
                  currentUser={currentUser}
                  reviewId={reviewId}
                  onLike={onLike}
                  onReply={onReply}
                  onDelete={onDelete}
                  depth={depth + 1}
                  nestedView={nestedView}
                  maxDepth={maxDepth}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Image View */}
      {showFullscreen && comment.media && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center cursor-pointer"
          onClick={() => setShowFullscreen(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={() => setShowFullscreen(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors p-2 z-50"
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={getCommentMediaUrl(comment.media)}
              alt="Comment media fullscreen"
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
              onError={handleImageError}
              key={`fullscreen-${comment.media.url || comment.media.original || Math.random()}`}
            />
          </div>
        </div>
      )}

      {showLikes && (
        <LikesListModal
          likes={localLikes}
          onClose={() => setShowLikes(false)}
          title="Comment Likes"
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          contentType="comment"
          contentId={comment._id}
          onClose={() => setShowReportModal(false)}
          onReportSubmitted={() => setShowReportModal(false)}
        />
      )}

      {error && (
        <div className="mt-2 text-sm text-red-500">{error}</div>
      )}
    </div>
  );
};

export default Comment;