import React, { useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { 
  ThumbsUp, 
  MessageCircle, 
  MoreVertical, 
  Check, 
  Trash2, 
  Flag, 
  Star, 
  Calendar, 
  User, 
  Eye, 
  Loader, 
  MapPin, 
  X,
  Edit,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { getMediaUrl, isVideo, isGif } from '../../utils/MediaUtils';
import ProfileImage from '../user/ProfileImage';
import CommentForm from '../comment/CommentForm';
import ReportModal from '../report/ReportModal';
import { useNotifications } from '../notifications/NotificationProvider';
import CommentThread from '../comment/CommentThread';
import config from '../../config';
import LikesListModal from '../likes/LikesListModal';

// Constants
const COMMENT_PAGE_SIZE = 5;
const SORT_OPTIONS = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  MOST_LIKED: 'most_liked'
};

const DEBUG = true; // Enable verbose debugging
/**
 * ReviewCard Component
 * Displays a full review card with all interactions and UI elements
 */
 
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

const ReviewCard = ({ 
  review, 
  currentUser, 
  onLike = () => {},
  onDelete = () => {},
  onEdit = () => {},
  onComment = () => {},
  onCommentLike = () => {},
  onCommentDelete = () => {},
  isInFeed = false,
  isLiking = false,
  showFullContent = false,
  onRefreshContent = () => {},
  highlightedCommentId = null
}) => {
  // State
  const [showComments, setShowComments] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showFullMedia, setShowFullMedia] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportContentType, setReportContentType] = useState('review');
  const [reportContentId, setReportContentId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAllContent, setShowAllContent] = useState(showFullContent);
  const [loadingComments, setLoadingComments] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false); // For triggering re-renders
  const [showLikesModal, setShowLikesModal] = useState(false); // Add state for likes modal
  
  // New state for likes (with optimistic UI updates)
  const [localLikes, setLocalLikes] = useState([]);
  const [isLikingLocal, setIsLikingLocal] = useState(false);
  
  // Refs
  const actionsRef = useRef(null);
  const commentSectionRef = useRef(null);
  const likeRequestInProgress = useRef(false); // Track if a like request is in progress
  
  // Hooks
  const { showNotification } = useNotifications();

  // Log review details for debugging
  useEffect(() => {
    console.log('ReviewCard rendering review:', review._id, 'with components:', {
      hasMedia: !!review.media,
      hasComments: !!review.comments,
      title: review.title?.substring(0, 30) + '...',
      introSummary: review.introSummary?.substring(0, 30) + '...',
      introComments: review.introComments?.substring(0, 20) + '...',
      closingSummary: review.closingSummary?.substring(0, 30) + '...',
      beefery: review.beefery,
      location: review.location
    });
  }, [review, forceUpdate]); // Add forceUpdate to dependencies for re-renders

  // FIXED: Update localLikes when review.likes changes with deep copy
  useEffect(() => {
    // Create a fresh copy of the likes array whenever review.likes changes
    if (review && review.likes) {
      const freshLikes = Array.isArray(review.likes) 
        ? review.likes.map(like => {
            if (typeof like === 'object' && like !== null) {
              return {...like};
            }
            return like;
          }) 
        : [];
        
      setLocalLikes(freshLikes);
      console.log('ReviewCard: Updated localLikes from review, current count:', freshLikes.length);
    }
  }, [review.likes]);

  useEffect(() => {
    // Scroll to highlighted comment if any
    if (highlightedCommentId && commentSectionRef.current) {
      const commentElement = document.getElementById(`comment-${highlightedCommentId}`);
      if (commentElement) {
        setShowComments(true);
        setTimeout(() => {
          commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          commentElement.classList.add('highlight-animation');
        }, 300);
      }
    }

    // Add click outside handler for actions menu
    const handleClickOutside = (event) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target)) {
        setShowActions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [highlightedCommentId]);

  // FIXED: Improved hasUserLiked implementation with string comparison
  const hasUserLiked = useMemo(() => {
    if (!currentUser || !Array.isArray(localLikes) || localLikes.length === 0) {
      return false;
    }
    
    const userId = currentUser._id;
    
    // Log this for debugging
    if (localLikes.length > 0) {
      console.log('Checking if user', userId, 'has liked review with', localLikes.length, 'likes');
    }
    
    // Simple string comparison rather than object reference comparison
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
        console.error('Error in hasUserLiked:', err);
        return false;
      }
    });
  }, [currentUser, localLikes])

  // Toggle expand/collapse for review details
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Returns true if user has admin privileges or is the content owner
  const hasEditPermission = (userId) => {
    if (!currentUser) return false;
    return currentUser._id === userId || currentUser.role === 'admin';
  };

  // FIXED: Improved handleLikeClick with direct API calls and proper state updates
  const handleLikeClick = async () => {
    if (!currentUser) {
      showNotification('info', 'You need to log in to like reviews');
      return;
    }

    // Use ref to prevent duplicate API calls
    if (isLikingLocal || likeRequestInProgress.current) {
      console.log('Like request already in progress, ignoring duplicate click');
      return;
    }

    try {
      setIsLikingLocal(true);
      likeRequestInProgress.current = true;
      
      console.log('ReviewCard: Making single API call to like review:', review._id);
      
      // Make the API call directly without optimistic updates
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');
      
      const response = await fetch(`${config.API_URL}/reviews/${review._id}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to like review');
      }
      
      const updatedReview = await response.json();
      console.log('API response like count:', updatedReview.likes?.length);
      
      // Create a fresh array of likes from the server response
      const freshLikes = Array.isArray(updatedReview.likes) 
        ? updatedReview.likes.map(like => {
            if (typeof like === 'object' && like !== null) {
              return {...like};
            }
            return like;
          }) 
        : [];
          
      // Update local state with the server response
      setLocalLikes(freshLikes);
      
      // CRITICAL: Update the original review object to ensure state consistency
      if (review) {
        review.likes = freshLikes;
      }
      
      // IMPORTANT: No longer calling parent handler again
      // This was causing duplicate API calls
      
    } catch (error) {
      console.error('Review like error:', error);
      showNotification('error', 'Failed to like review');
    } finally {
      setIsLikingLocal(false);
      likeRequestInProgress.current = false;
    }
  };

  const handleDeleteClick = async () => {
    if (!currentUser) return;

    if (window.confirm('Are you sure you want to delete this review?')) {
      try {
        setIsDeleting(true);
        await onDelete(review._id);
        showNotification('success', 'Review deleted successfully');
      } catch (error) {
        console.error('Delete error:', error);
        showNotification('error', 'Failed to delete review');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleEditClick = () => {
    if (!hasEditPermission(review.userId)) return;
    onEdit(review);
  };

  const handleCommentSubmit = async (formDataOrReview) => {
    if (!currentUser) {
      showNotification('info', 'You need to log in to comment');
      return;
    }

    try {
      // Check if we received an updatedReview directly (from CommentForm's direct API call)
      if (formDataOrReview && formDataOrReview._id === review._id) {
        console.log('ReviewCard received updated review directly from CommentForm');
        
        // Update the local review's comments - process them for consistent media URLs
        review.comments = formDataOrReview.comments.map(comment => {
          // Process comment media if present
          if (comment.media) {
            comment.media = {
              ...comment.media,
              processedUrl: getMediaUrl(comment.media, 'comment')
            };
          }
          
          // Process nested comments recursively
          if (comment.children && Array.isArray(comment.children)) {
            comment.children = comment.children.map(child => {
              if (child.media) {
                child.media = {
                  ...child.media,
                  processedUrl: getMediaUrl(child.media, 'comment')
                };
              }
              return child;
            });
          }
          
          return comment;
        });
        
        // Force a re-render to update the UI
        setForceUpdate(prev => !prev);
        
        // Call parent handler (non-critical)
        try {
          await onComment(formDataOrReview);
        } catch (error) {
          console.warn('Parent comment handler error (non-critical):', error);
        }
        
        showNotification('success', 'Comment added successfully');
        return formDataOrReview;
      }
      
      // Traditional flow - we received a FormData object
      const formData = formDataOrReview;
      
      // Add the reviewId to the form data for proper handling
      formData.append('reviewId', review._id);
      
      // Extract the text from formData for logging
      const text = formData.get('text');
      console.log('Submitting comment for review:', review._id, 'Text:', text && text.substring(0, 20) + '...');
      
      // Call API to add the comment
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');
      
      const response = await fetch(`${config.API_URL}/reviews/${review._id}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to add comment');
      }

      const updatedReview = await response.json();
      console.log('Received updated review after comment:', updatedReview._id);
      
      // Update the local state first for immediate UI update - process comments for consistent media URLs
      review.comments = updatedReview.comments.map(comment => {
        // Process comment media if present
        if (comment.media) {
          comment.media = {
            ...comment.media,
            processedUrl: getMediaUrl(comment.media, 'comment')
          };
        }
        
        // Process nested comments recursively
        if (comment.children && Array.isArray(comment.children)) {
          comment.children = comment.children.map(child => {
            if (child.media) {
              child.media = {
                ...child.media,
                processedUrl: getMediaUrl(child.media, 'comment')
              };
            }
            return child;
          });
        }
        
        return comment;
      });
      
      // Force a re-render to update the comment count in the UI
      setForceUpdate(prev => !prev);
      
      // Now pass the updatedReview to the onComment handler
      if (updatedReview && updatedReview._id) {
        try {
          await onComment(updatedReview);
          showNotification('success', 'Comment added successfully');
        } catch (error) {
          console.warn('Parent comment handler error:', error);
          // Even if the parent handler fails, we've already updated local state
        }
        return updatedReview;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Comment error:', error);
      showNotification('error', 'Failed to add comment');
      throw error;
    }
  };

  const handleCommentLike = async (commentId, alreadyProcessed = false) => {
  try {
    if (!currentUser) {
      showNotification('info', 'You need to log in to like comments');
      return null;
    }
    
    console.log('ReviewCard: Like request for commentId:', commentId, 'alreadyProcessed:', alreadyProcessed);
    
    // Skip API call if already processed
    if (alreadyProcessed) {
      console.log('ReviewCard: Like already processed, skipping API call');
      // Maybe update UI or do other non-API operations
      return true;
    }
    
    // Get reviewId from the review prop
    const reviewIdStr = review._id.toString();
    
    // Handle different formats of commentId
    let commentIdStr;
    
    // If commentId is an object with _id property (like a comment object)
    if (typeof commentId === 'object' && commentId !== null) {
      if (commentId._id) {
        commentIdStr = commentId._id.toString();
      } else {
        // If it's the wrong object, log and extract any id found
        console.error('Invalid comment object:', commentId);
        // Try to get any ID we can find
        if (commentId.id) commentIdStr = commentId.id.toString();
        else commentIdStr = Object.values(commentId).find(v => typeof v === 'string')?.toString();
      }
    } else if (typeof commentId === 'string') {
      commentIdStr = commentId;
    } else {
      commentIdStr = String(commentId);
    }
    
    // Debug output to help identify issues
    console.log('ReviewCard.handleCommentLike - commentId processed:', {
      original: commentId,
      processed: commentIdStr,
      type: typeof commentId
    });
    
    // IMPORTANT: Check if the processed commentId equals reviewId
    if (!commentIdStr || commentIdStr === reviewIdStr) {
      console.error('Invalid comment ID for liking (equals review ID):', commentIdStr);
      throw new Error('Invalid comment ID');
    }
    
    console.log('ReviewCard: Liking comment', commentIdStr, 'in review', reviewIdStr);
    
    // Use local loading state
    setIsLikingLocal(true);
    
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
      const errorData = await response.text();
      console.error('Comment like API error response:', errorData);
      throw new Error(`Server returned ${response.status} ${response.statusText}`);
    }
    
    const updatedReview = await response.json();
    
    // Update the review with the server response data
    if (review && review.comments) {
      // Replace the review object with updated review data
      Object.assign(review, updatedReview);
      
      // Force a re-render
      setForceUpdate(prev => !prev);
    }
    
    // Cache the updated review
    try {
      const cachedReviews = JSON.parse(localStorage.getItem('cachedReviews') || '{}');
      cachedReviews[reviewIdStr] = {
        ...cachedReviews[reviewIdStr],
        ...updatedReview,
        timestamp: Date.now()
      };
      localStorage.setItem('cachedReviews', JSON.stringify(cachedReviews));
    } catch (cacheError) {
      console.warn('Failed to update review cache:', cacheError);
    }
    
    console.log('Comment like successful');
    
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
    
    return updatedReview;
  } catch (error) {
    console.error('Comment like error:', error);
    showNotification('error', 'Failed to like comment');
    return null;
  } finally {
    setIsLikingLocal(false);
  }
};

  const handleCommentDelete = async (commentId) => {
    if (!currentUser) return;

    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        await onCommentDelete(review._id, commentId);
        showNotification('success', 'Comment deleted successfully');
      } catch (error) {
        console.error('Comment delete error:', error);
        showNotification('error', 'Failed to delete comment');
      }
    }
  };

  const handleReportClick = (type, id) => {
    setReportContentType(type);
    setReportContentId(id);
    setShowReportModal(true);
    setShowActions(false);
  };

  // Function to handle report submission
  const handleReportSubmitted = (reportData) => {
    console.log('Report submitted:', reportData);
    showNotification('success', 'Report submitted successfully');
    
    // Trigger content refresh to update the UI
    onRefreshContent();
  };

  // Formatting helpers
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 30) {
      return formatDate(dateString);
    } else if (diffDay > 0) {
      return `${diffDay}d ago`;
    } else if (diffHour > 0) {
      return `${diffHour}h ago`;
    } else if (diffMin > 0) {
      return `${diffMin}m ago`;
    } else {
      return 'Just now';
    }
  };

  // Rendering helpers
  const renderRating = (rating) => {
    return (
      <div className="flex items-center">
        <Star className="h-5 w-5 text-yellow-500 mr-1" />
        <span className="font-semibold">{parseFloat(rating).toFixed(2)}/10.00</span>
      </div>
    );
  };

  // Use consistent media URL function from MediaUtils
  const getReviewMediaUrl = (media) => {
    if (!media) {
      console.log('No media provided for review:', review._id);
      return null;
    }
    
    return getMediaUrl(media, 'review');
  };

  const renderMediaPreview = () => {
    if (!review.media) {
      console.log('Review has no media:', review._id);
      return null;
    }
    
    // Get media URL using our utility function
    const mediaUrl = getReviewMediaUrl(review.media);
    if (!mediaUrl) {
      console.log('Failed to generate media URL for review:', review._id);
      return null;
    }
    
    const isGifMedia = isGif(review.media);
    const isVideoMedia = isVideo(review.media);

    if (isVideoMedia) {
      return (
        <div className="relative mt-3">
          <video
            src={mediaUrl}
            controls
            className="rounded-lg max-h-72 w-auto object-contain bg-black/5"
            onError={(e) => {
              console.error('Video load error:', e.target.src);
              e.target.style.display = 'none';
            }}
          />
        </div>
      );
    }

    return (
      <div 
        className="relative mt-3 cursor-pointer" 
        onClick={() => setShowFullMedia(true)}
      >
        <img
          src={mediaUrl}
          alt={`${review.beefery} review media`}
          className="rounded-lg max-h-72 w-auto object-contain bg-black/5"
          onError={(e) => {
            console.error('Media load error:', e.target.src);
            e.target.style.display = 'none';
          }}
        />
        <div className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white">
          <Eye className="h-5 w-5" />
        </div>
        {isGifMedia && (
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/50 text-white text-xs">
            GIF
          </div>
        )}
      </div>
    );
  };

  const renderFullMediaModal = () => {
    if (!showFullMedia || !review.media) return null;
    
    const mediaUrl = getReviewMediaUrl(review.media);
    if (!mediaUrl) return null;
    
    const isVideoMedia = isVideo(review.media);

    return (
      <div 
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer"
        onClick={() => setShowFullMedia(false)}
      >
        <div className="max-w-3xl max-h-screen p-4">
          <button 
            className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white"
            onClick={() => setShowFullMedia(false)}
          >
            <X className="h-6 w-6" />
          </button>
          
          <div className="flex items-center justify-between w-full absolute top-4 left-4">
            <div className="flex items-center space-x-2 text-white">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(mediaUrl, '_blank');
                }}
                className="p-2 hover:bg-black/30 rounded-full"
                title="Open in new tab"
              >
                <ExternalLink className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {isVideoMedia ? (
            <video
              src={mediaUrl}
              controls
              autoPlay
              className="max-h-full max-w-full"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                console.error('Video load error:', e.target.src);
                setShowFullMedia(false);
              }}
            />
          ) : (
            <img
              src={mediaUrl}
              alt={`${review.beefery} review media`}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                console.error('Media load error:', e.target.src);
                setShowFullMedia(false);
              }}
            />
          )}
        </div>
      </div>
    );
  };

  // Render action menu (more options)
  const renderActionsMenu = () => {
    if (!showActions) return null;

    const canUserEdit = hasEditPermission(review.userId);
    const canUserReport = currentUser && currentUser._id !== review.userId;

    return (
      <div 
        ref={actionsRef}
        className="absolute top-10 right-4 bg-card p-2 rounded-lg shadow-lg border border-border z-10"
      >
        <div className="space-y-1 min-w-[150px]">
          {canUserEdit && (
            <>
              <button
                onClick={() => {
                  setShowActions(false);
                  handleEditClick();
                }}
                className="flex items-center w-full px-3 py-2 text-foreground hover:bg-secondary rounded-lg transition-colors"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </button>
              
              <button
                onClick={() => {
                  setShowActions(false);
                  handleDeleteClick();
                }}
                disabled={isDeleting}
                className="flex items-center w-full px-3 py-2 text-red-500 hover:bg-secondary rounded-lg transition-colors"
              >
                {isDeleting ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </button>
            </>
          )}
          
          {canUserReport && (
            <button
              onClick={() => handleReportClick('review', review._id)}
              className="flex items-center w-full px-3 py-2 text-foreground hover:bg-secondary rounded-lg transition-colors"
            >
              <Flag className="h-4 w-4 mr-2" />
              Report
            </button>
          )}
        </div>
      </div>
    );
  };
  
  const UserBadge = ({ user }) => {
    // Add debug logging
    console.log('UserBadge received user:', user);
    
    // Check all possible locations for role information
    const role = user?.role || (review.user && review.user.role) || review.userRole;
    
    if (!role) {
      console.log('No role found for user:', user?.displayName || review.userDisplayName);
      return null;
    }
  
    let badgeText = '';
    let badgeColor = '';
  
    switch (role) {
      case 'admin':
        badgeText = 'Admin';
        badgeColor = 'bg-red-500 text-white';
        break;
      case 'moderator':
        badgeText = 'Mod';
        badgeColor = 'bg-green-500 text-white';
        break;
      case 'mvb':
        badgeText = 'MVB';
        badgeColor = 'bg-purple-500 text-white';
        break;
      case 'DanBob':
        badgeText = 'DanBob';
        badgeColor = 'bg-orange-500 text-white';
        break;
      default:
        // Show the role even if it's not in our predefined list
        badgeText = role;
        badgeColor = 'bg-gray-500 text-white';
    }
  
    return (
      <span className={`inline-block ml-1 px-2 py-0.5 rounded-full text-xs ${badgeColor}`}>
        {badgeText}
      </span>
    );
  };

  // FIXED: Helper function to format likes display using string comparison
  const getLikeText = () => {
    if (!currentUser || !Array.isArray(localLikes) || localLikes.length === 0) return null;
    
    // Use the same string comparison logic as hasUserLiked
    const userLiked = localLikes.some(like => {
      try {
        const userId = currentUser._id;
        
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
        console.error('Error in getLikeText:', err);
        return false;
      }
    });
    
    if (userLiked) {
      if (localLikes.length === 1) {
        return 'You like this';
      } else if (localLikes.length === 2) {
        return 'You and 1 other';
      } else {
        return `You and ${localLikes.length - 1} others`;
      }
    }
    
    return null;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <ProfileImage 
              user={{
                _id: review.userId,
                displayName: review.userDisplayName,
                profileImage: review.userImage
              }}
              size="md"
            />
            <div>
              <h3 className="font-semibold text-foreground">
                {review.userDisplayName}
                <UserBadge user={{
                  ...review.user,
                  role: review.user?.role || review.userRole || (currentUser && currentUser._id === review.userId ? currentUser.role : null)
                }} />
              </h3>
              <div className="flex items-center text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 mr-1" />
                {formatDate(review.date)}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {renderRating(review.rating)}
            
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-2 hover:bg-secondary rounded-full transition-colors"
              >
                <MoreVertical className="h-5 w-5 text-muted-foreground" />
              </button>
              {renderActionsMenu()}
            </div>
          </div>
        </div>

        {/* New: Review Title */}
        {review.title && (
          <h1 className="text-2xl font-bold text-foreground mt-4 mb-2">
            {review.title}
          </h1>
        )}
        
        {/* New: Intro Summary */}
        {review.introSummary && (
          <div className="mt-2 mb-4 px-4 py-3 bg-secondary/30 rounded-lg text-slate-700">
            {review.introSummary}
          </div>
        )}
        
        {/* Beefery Name & Location */}
        <div className="mt-3">
          <div className="flex items-center">
            <h2 className="text-xl font-bold text-foreground">{review.beefery}</h2>
            {review.featured && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <Star className="h-3 w-3 mr-1 fill-current" /> 
                Featured
              </span>
            )}
          </div>
          {review.location && (
            <div className="flex items-center text-sm text-muted-foreground mt-1">
              <MapPin className="h-4 w-4 mr-1" />
              {review.location}
            </div>
          )}
        </div>
        
        {/* Review Content */}
        <div className="mt-3">
          {review.introComments && (
            <div className="relative">
              <p className="text-foreground whitespace-pre-line">
                {(!showAllContent && review.introComments.length > 300 && !isInFeed)
                  ? `${review.introComments.substring(0, 300)}...`
                  : review.introComments
                }
              </p>
              
              {!showAllContent && review.introComments.length > 300 && !isInFeed && (
                <button 
                  onClick={() => setShowAllContent(true)}
                  className="text-primary hover:underline mt-1 inline-flex items-center"
                >
                  Show more <ChevronDown className="h-4 w-4 ml-1" />
                </button>
              )}
            </div>
          )}
          
          {/* Render review media */}
          {renderMediaPreview()}
        </div>
        
        {/* New: Closing Summary */}
        {review.closingSummary && (
          <div className="mt-4 mb-2 px-4 py-3 bg-secondary/30 rounded-lg font-medium text-slate-700 border-l-4 border-primary">
            {review.closingSummary}
          </div>
        )}
        
        {/* Review Details with expand/collapse */}
        <div className="mt-6">
          {/* Header with expand/collapse button */}
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-foreground">Review Details</h3>
            <button
              onClick={toggleExpand}
              className="flex items-center space-x-1 px-3 py-1 text-sm text-muted-foreground hover:text-foreground bg-secondary rounded-lg transition-colors"
            >
              <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
          
          {/* Conditionally render details based on expanded state */}
          {isExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-3 bg-secondary/50 rounded-lg">
              {review.timeOfBeefing && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Time of Beefing:</p>
                  <p className="text-muted-foreground">{review.timeOfBeefing}</p>
                </div>
              )}
              {review.timeInBag && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Time in Bag:</p>
                  <p className="text-muted-foreground">{review.timeInBag}</p>
                </div>
              )}
              {review.priceOfBeef && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Price:</p>
                  <p className="text-muted-foreground">{review.priceOfBeef}</p>
                </div>
              )}
              {review.freshPinkWarm && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Fresh, Pink & Warm:</p>
                  <p className="text-muted-foreground">{review.freshPinkWarm}</p>
                </div>
              )}
              {review.beefToBun && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Beef to Bun:</p>
                  <p className="text-muted-foreground">{review.beefToBun}</p>
                </div>
              )}
              {review.flavorOfBeef && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Flavor of Beef:</p>
                  <p className="text-muted-foreground">{review.flavorOfBeef}</p>
                </div>
              )}
              {review.sauceToMayo && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Sauce to Mayo:</p>
                  <p className="text-muted-foreground">{review.sauceToMayo}</p>
                </div>
              )}
              {review.cheesePosition && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Cheese Position:</p>
                  <p className="text-muted-foreground">{review.cheesePosition}</p>
                </div>
              )}
              {review.nicelyGriddledBun && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Nicely Griddled Bun:</p>
                  <p className="text-muted-foreground">{review.nicelyGriddledBun}</p>
                </div>
              )}
              {review.napkinCount !== undefined && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Napkin Count:</p>
                  <p className="text-muted-foreground">{review.napkinCount}</p>
                </div>
              )}
              {review.dayOldBeef && (
                <div className="col-span-2">
                  <p className="text-sm font-semibold text-red-600">Day Old Beef</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="mt-4 flex items-center space-x-4 pt-4 border-t border-border">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleLikeClick}
              disabled={isLikingLocal}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                hasUserLiked 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              {isLikingLocal ? (
                <Loader className="h-5 w-5 animate-spin" />
              ) : hasUserLiked ? (
                <Check className="h-5 w-5" />
              ) : (
                <ThumbsUp className="h-5 w-5" />
              )}
              <span>{localLikes?.length || 0}</span>
            </button>
            
            {/* Likes text display */}
            {localLikes && localLikes.length > 0 && (
              <button
                onClick={() => setShowLikesModal(true)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {getLikeText() || ''}
              </button>
            )}
          </div>
          
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center space-x-2 px-4 py-2 text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            <MessageCircle className="h-5 w-5" />
            <span>{review.comments?.length || 0}</span>
          </button>
        </div>
        
        {/* Comments Section */}
        {showComments && (
          <div className="mt-4 space-y-4 pt-4 border-t border-border" ref={commentSectionRef}>
            {loadingComments ? (
              <div className="flex justify-center items-center">
                <Loader className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <CommentThread
                reviewId={review._id}
                currentUser={currentUser}
                initialComments={review.comments || []}
                onCommentAdded={handleCommentSubmit}
                onCommentLike={handleCommentLike}
                onDelete={handleCommentDelete}
              />
            )}
          </div>
        )}
      </div>
      
      {/* Modals */}
      {renderFullMediaModal()}
      
      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          contentType={reportContentType}
          contentId={reportContentId}
          onClose={() => setShowReportModal(false)}
          onReportSubmitted={handleReportSubmitted}
        />
      )}
      
      {/* Likes Modal */}
      {showLikesModal && (
        <LikesListModal
          likes={localLikes || []}
          onClose={() => setShowLikesModal(false)}
          title="Review Likes"
        />
      )}
    </Card>
  );
};

// PropTypes for type checking
ReviewCard.propTypes = {
  review: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    userId: PropTypes.string.isRequired,
    userDisplayName: PropTypes.string.isRequired,
    userImage: PropTypes.string,
    title: PropTypes.string,              // New field
    introSummary: PropTypes.string,       // New field
    beefery: PropTypes.string.isRequired,
    location: PropTypes.string,
    rating: PropTypes.number.isRequired,
    date: PropTypes.string.isRequired,
    introComments: PropTypes.string,
    closingSummary: PropTypes.string,     // New field
    timeOfBeefing: PropTypes.string,
    timeInBag: PropTypes.string,
    priceOfBeef: PropTypes.string,
    freshPinkWarm: PropTypes.string,
    beefToBun: PropTypes.string,
    flavorOfBeef: PropTypes.string,
    sauceToMayo: PropTypes.string,
    cheesePosition: PropTypes.string,
    nicelyGriddledBun: PropTypes.string,
    napkinCount: PropTypes.number,
    dayOldBeef: PropTypes.bool,
    media: PropTypes.shape({
      url: PropTypes.string,
      original: PropTypes.string,
      type: PropTypes.string
    }),
    likes: PropTypes.arrayOf(
      PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.shape({
          _id: PropTypes.string.isRequired,
          displayName: PropTypes.string,
          username: PropTypes.string,
          profileImage: PropTypes.string
        })
      ])
    ),
    comments: PropTypes.arrayOf(
      PropTypes.shape({
        _id: PropTypes.string.isRequired,
        text: PropTypes.string,
        userId: PropTypes.string.isRequired,
        userDisplayName: PropTypes.string.isRequired,
        userImage: PropTypes.string,
        date: PropTypes.string.isRequired,
        parentId: PropTypes.string,
        likes: PropTypes.array,
        media: PropTypes.shape({
          url: PropTypes.string,
          type: PropTypes.string
        })
      })
    )
  }).isRequired,
  currentUser: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    profileImage: PropTypes.string,
    role: PropTypes.string
  }),
  onLike: PropTypes.func,
  onDelete: PropTypes.func,
  onEdit: PropTypes.func,
  onComment: PropTypes.func,
  onCommentLike: PropTypes.func,
  onCommentDelete: PropTypes.func,
  isInFeed: PropTypes.bool,
  isLiking: PropTypes.bool,
  showFullContent: PropTypes.bool,
  onRefreshContent: PropTypes.func,
  highlightedCommentId: PropTypes.string
};

// Add display name for better debugging
ReviewCard.displayName = 'ReviewCard';

export default ReviewCard;