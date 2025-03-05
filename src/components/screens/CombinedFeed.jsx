import PropTypes from 'prop-types';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { 
  ThumbsUp, 
  MessageCircle, 
  Star, 
  Newspaper, 
  Check, 
  Loader,
  ExternalLink,
  Pin,
  Tag,
  ChevronRight,
  ChevronDown,
  Trophy,
  Users,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { userService } from '../../services/api';
import { getMediaUrl, isVideo, isGif } from '../../utils/MediaUtils';
import { getMediaUrl as getMediaUrlFromService, refreshActivities } from '../../services/api';
import ReviewCard from '../review/ReviewCard';
import ProfileImage from '../user/ProfileImage';
import config from '../../config';
import LikesListModal from '../likes/LikesListModal';
import NewsItem from '../news/NewsItem';
import PollDisplay from '../news/PollDisplay';
import { toast } from '../../utils/toast';

// Helper function to process tags consistently across the app
const processTags = (tags) => {
  try {
    // If no tags provided, return empty array
    if (!tags) return [];
    
    // If tags is a string and looks like JSON, try to parse it
    if (typeof tags === 'string') {
      if (tags.startsWith('[') && tags.endsWith(']')) {
        try {
          return JSON.parse(tags);
        } catch (error) {
          console.error('Failed to parse tags JSON string:', error);
        }
      }
      
      // If it's a comma-separated string, split and format
      if (tags.includes(',')) {
        return tags.split(',').map(tag => ({
          text: tag.trim(),
          color: 'primary'
        }));
      }
      
      // Single tag as string
      return [{text: tags.trim(), color: 'primary'}];
    }
    
    // If already an array, ensure each item has the right format
    if (Array.isArray(tags)) {
      return tags.map(tag => {
        if (typeof tag === 'string') {
          return { text: tag, color: 'primary' };
        }
        
        if (typeof tag === 'object' && tag !== null) {
          return {
            text: tag.text || tag.name || 'Tag',
            color: tag.color || 'primary',
            icon: tag.icon || null
          };
        }
        
        return null;
      }).filter(Boolean); // Remove any null values
    }
    
    return [];
  } catch (error) {
    console.error('Error processing tags in CombinedFeed:', error);
    return [];
  }
};

// Component to display pinned content at the top
const PinnedContentBox = ({ items, currentUser, onReviewLike, onNewsLike, onVotePoll, onReviewComment, onReviewDelete, onReviewEdit, onRefreshContent }) => {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [expanded, setExpanded] = useState(false);
  
  if (!items || items.length === 0) return null;
  
  return (
    <Card className="mb-4 overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-card">
      <div 
        className="flex items-center justify-between py-3 px-4 cursor-pointer border-b border-border hover:bg-secondary/10 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center">
          <Pin className="h-5 w-5 mr-2 text-primary" />
          <h3 className="font-semibold text-foreground">Pinned Content ({items.length})</h3>
        </div>
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      
      {expanded && (
        <div className="divide-y divide-border">
          {items.map((item, index) => (
            <div 
              key={`pinned-${item.type}-${item._id}`}
              className="border-t border-border first:border-t-0"
            >
              <div 
                className="p-3 flex justify-between items-center cursor-pointer hover:bg-secondary/10 transition-colors"
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                <div>
                  <div className="font-medium text-foreground">{item.title || item.beefery}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.type === 'news' ? (
                      <>
                        {item.pinned?.label || 'Pinned News'} • {item.author?.displayName || 'Unknown'}
                      </>
                    ) : (
                      <>
                        {item.pinned?.label || (item.featured ? 'Featured Review' : 'Pinned Review')} • {item.userDisplayName || 'Unknown'}
                      </>
                    )}
                  </div>
                </div>
                {expandedIndex === index ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              
              {expandedIndex === index && (
                <div className="border-t border-border">
                  {item.type === 'news' ? (
                    <NewsItem
                      item={item}
                      currentUser={currentUser}
                      onLike={onNewsLike}
                      onVotePoll={onVotePoll}
                      onRefreshContent={onRefreshContent}
                      isPinned={true}
                    />
                  ) : (
                    <ReviewCard
                      review={item}
                      currentUser={currentUser}
                      onLike={() => onReviewLike(item._id)}
                      onDelete={() => onReviewDelete(item._id)}
                      onEdit={() => onReviewEdit(item)}
                      onComment={onReviewComment}
                      isInFeed={true}
                      onRefreshContent={onRefreshContent}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

const CombinedFeed = ({ 
  reviews = [], 
  news = [], 
  currentUser = null, 
  onReviewLike = () => {}, 
  onNewsLike = () => {},
  onVotePoll = () => {},
  onReviewDelete = () => {},
  onReviewComment = () => {},
  onCommentLike = () => {},
  onRefreshContent = () => {},
  onReviewEdit = () => {} 
}) => {
  const [loadingStates, setLoadingStates] = useState({
    reviewLikes: {},
    newsLikes: {},
    pollVotes: {}
  });
  const [localItems, setLocalItems] = useState([]);
  const [error, setError] = useState(null);
  
  // Refs for tracking initialization status
  const initializedRef = useRef(false);
  const dataProcessedRef = useRef(false);

  // Debug logging for incoming content - with protection against double rendering
  useEffect(() => {
    if (initializedRef.current) return;
    
    try {
      console.log('CombinedFeed received reviews:', reviews?.length || 0);
      console.log('CombinedFeed received news:', news?.length || 0);
      
      // Log pinned items
      const pinnedReviews = Array.isArray(reviews) ? reviews.filter(r => r?.pinned?.isPinned || r?.featured) : [];
      const pinnedNews = Array.isArray(news) ? news.filter(n => n?.pinned?.isPinned) : [];
      
      console.log('Pinned reviews:', pinnedReviews.length);
      console.log('Pinned news:', pinnedNews.length);
      
      // Mark as initialized to prevent duplicate logs
      initializedRef.current = true;
    } catch (err) {
      console.error('Error in CombinedFeed logging:', err);
    }
  }, [reviews, news]);

  // Separate pinned items from regular feed items
  const { pinnedItems, regularItems } = useMemo(() => {
    try {
      const pinned = [];
      const regular = [];
      
      if (!Array.isArray(localItems)) {
        console.error('localItems is not an array:', localItems);
        return { pinnedItems: [], regularItems: [] };
      }
      
      localItems.forEach(item => {
        if (!item || !item._id) {
          console.warn('Invalid item in feed:', item);
          return;
        }
        
        // More robust check for pinned status that handles all possible formats
        const isPinned = 
          // Object format with isPinned property set to true
          (item.pinned && typeof item.pinned === 'object' && item.pinned.isPinned === true) ||
          // Direct boolean value
          (item.pinned === true) ||
          // String value 'true'
          (item.pinned === 'true') ||
          // Also check for featured property on reviews
          (item.type === 'review' && item.featured === true);
        
        // Debug log for pinned status - uncomment if needed
        /*
        if (item.pinned) {
          console.debug(`Item ${item._id} pinned value:`, {
            value: item.pinned,
            type: typeof item.pinned,
            isPinned
          });
        }
        */
        
        if (isPinned) {
          pinned.push(item);
        } else {
          regular.push(item);
        }
      });
      
      if (!dataProcessedRef.current) {
        console.log(`Separated ${pinned.length} pinned items and ${regular.length} regular items`);
        dataProcessedRef.current = true;
      }
      
      return { pinnedItems: pinned, regularItems: regular };
    } catch (err) {
      console.error('Error separating pinned and regular items:', err);
      return { pinnedItems: [], regularItems: [] };
    }
  }, [localItems]);

  // Initialize localItems when props change - with improved error handling
  useEffect(() => {
    try {
      // Safety check for reviews array
      const safeReviews = Array.isArray(reviews) ? reviews.filter(r => r && r._id) : [];
      
      // Safety check for news array
      const safeNews = Array.isArray(news) ? news.filter(n => n && n._id) : [];
      
      // Process news tags data for debugging
      if (safeNews.length > 0 && !initializedRef.current) {
        safeNews.forEach(newsItem => {
          try {
            console.log(`News ${newsItem._id} has tags:`, newsItem.tags);
          } catch (err) {
            console.error('Error logging news tags:', err);
          }
        });
      }
      
      const items = [
        ...safeReviews.map(review => {
          try {
            // Ensure the user role information is preserved and properly formatted
            const user = {
              _id: review.userId,
              displayName: review.userDisplayName,
              profileImage: review.userImage,
              role: review.userRole || (review.user && review.user.role)
            };
            
            // Process media to ensure it will render properly
            let processedMedia = null;
            if (review.media) {
              // Handle both string and object formats for media
              if (typeof review.media === 'string') {
                // Convert string media path to the expected object format
                processedMedia = {
                  original: review.media,
                  type: isVideo(review.media) ? 'video' : 'image',
                  url: review.media,
                  processedUrl: getMediaUrl(review.media, 'review')
                };
              } else {
                // Handle existing object format
                try {
                  const mediaUrl = getMediaUrl(review.media, 'review');
                  processedMedia = {
                    ...review.media,
                    processedUrl: mediaUrl
                  };
                } catch (mediaErr) {
                  console.error('Error processing review media:', mediaErr);
                  processedMedia = { ...review.media, processedUrl: null };
                }
              }
            }
            
            // Process comments for consistency
            const processedComments = review.comments ? review.comments.map(comment => {
              try {
                // Process comment media if present
                let commentMedia = comment.media;
                if (commentMedia) {
                  commentMedia = {
                    ...commentMedia,
                    processedUrl: getMediaUrl(commentMedia, 'comment')
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
                
                return {
                  ...comment,
                  media: commentMedia
                };
              } catch (commentErr) {
                console.error('Error processing comment:', commentErr);
                return comment;
              }
            }) : [];
            
            // Ensure rating is formatted as a number with 2 decimal places
            const formattedRating = typeof review.rating === 'number' 
              ? parseFloat(review.rating.toFixed(2)) 
              : parseFloat(parseFloat(review.rating || 7.00).toFixed(2));
            
            // Ensure featured reviews are treated as pinned
            let pinnedData = review.pinned;
            
            // If review is featured but doesn't have pinned data, add it
            if (review.featured && (!pinnedData || (typeof pinnedData === 'object' && !pinnedData.isPinned))) {
              pinnedData = {
                isPinned: true,
                label: 'Featured Review',
                pinnedAt: new Date(review.date)
              };
            }
            
            return { 
              ...review, 
              type: 'review', 
              sortDate: new Date(review.date),
              user: user,
              media: processedMedia,
              comments: processedComments,
              rating: formattedRating,
              pinned: pinnedData
            };
          } catch (reviewErr) {
            console.error('Error processing review for feed:', reviewErr);
            // Return a minimal safe version of the review
            return { 
              ...review, 
              type: 'review', 
              sortDate: new Date(review.date || Date.now()),
              _id: review._id || `review-${Date.now()}`
            };
          }
        }),
        ...safeNews.map(newsItem => {
          try {
            const author = {
              ...(newsItem.author || {}),
              userId: typeof newsItem.author?.userId === 'object' 
                ? newsItem.author.userId._id 
                : newsItem.author?.userId,
              role: newsItem.author?.role
            };
            
            // Process tags using our helper function
            const processedTags = processTags(newsItem.tags);
            
            return {
              ...newsItem,
              type: 'news',
              sortDate: new Date(newsItem.date),
              author: author,
              tags: processedTags
            };
          } catch (newsErr) {
            console.error('Error processing news item for feed:', newsErr);
            // Return a minimal safe version of the news
            return { 
              ...newsItem, 
              type: 'news', 
              sortDate: new Date(newsItem.date || Date.now()),
              _id: newsItem._id || `news-${Date.now()}`
            };
          }
        })
      ];
      
      // Sort them by date (newest first)
      const sortedItems = items.sort((a, b) => {
        // Handle potential errors with dates
        try {
          if (a.pinned?.isPinned && !b.pinned?.isPinned) return -1;
          if (!a.pinned?.isPinned && b.pinned?.isPinned) return 1;
          // Also check for featured status for reviews
          if (a.type === 'review' && a.featured && !(b.type === 'review' && b.featured)) return -1;
          if (!(a.type === 'review' && a.featured) && b.type === 'review' && b.featured) return 1;
          return b.sortDate - a.sortDate;
        } catch (err) {
          console.error('Error sorting items:', err);
          return 0;
        }
      });
      
      if (!initializedRef.current) {
        console.log('CombinedFeed set localItems:', items.length);
        if (items.length > 0) {
          console.log('First item:', {
            type: items[0]?.type,
            id: items[0]?._id,
            hasTags: Boolean(items[0]?.tags?.length)
          });
        }
      }
      
      setLocalItems(sortedItems);
      setError(null);
    } catch (error) {
      console.error('Error processing feed items:', error);
      setError('Failed to load feed items. Please try refreshing the page.');
    }
  }, [reviews, news]);

  // Set up event listeners for updates
  useEffect(() => {
    // Create event handler for refresh events
    const handleRefreshEvent = (event) => {
      console.log('CombinedFeed received refresh event:', event);
      
      // Check if this is a deletion event
      if (event.detail && event.detail.type === 'news-deleted') {
        console.log('Handling news deletion event for ID:', event.detail.id);
        // Update local state to remove the deleted item
        setLocalItems(prev => {
          if (!Array.isArray(prev)) return [];
          return prev.filter(item => !(item.type === 'news' && item._id === event.detail.id));
        });
      }
      
      // Check if this is a review featured/unfeatured event
      if (event.detail && event.detail.type === 'review-featured') {
        console.log('Handling review feature event for ID:', event.detail.reviewId);
        // Update the review in local state
        setLocalItems(prev => {
          if (!Array.isArray(prev)) return [];
          return prev.map(item => {
            if (item.type === 'review' && item._id === event.detail.reviewId) {
              return {
                ...item,
                featured: event.detail.featured,
                pinned: {
                  isPinned: event.detail.featured,
                  label: 'Featured Review',
                  pinnedAt: event.detail.featured ? new Date() : null
                }
              };
            }
            return item;
          });
        });
      }
      
      // For all events, trigger the refresh callback
      onRefreshContent();
    };
    
    // Listen for the custom refresh event
    window.addEventListener('content-updated', handleRefreshEvent);
    
    // Clean up on unmount
    return () => {
      window.removeEventListener('content-updated', handleRefreshEvent);
    };
  }, [onRefreshContent]);

  const handleReviewLike = async (reviewId) => {
    if (!currentUser) {
      toast({
        title: "Login Required",
        description: "You need to be logged in to like content.",
        type: "warning"
      });
      return;
    }
    
    if (loadingStates.reviewLikes[reviewId]) return;

    try {
      // Set loading state
      setLoadingStates(prev => ({
        ...prev,
        reviewLikes: { ...prev.reviewLikes, [reviewId]: true }
      }));

      console.log('CombinedFeed: Sending like request for review:', reviewId);
      
      // Call the API to update the like status
      const updatedReview = await onReviewLike(reviewId);
      
      // If we got a response with updated likes, update the local state
      if (updatedReview && updatedReview.likes) {
        console.log('CombinedFeed: Updating local items with new likes data');
        
        setLocalItems(prev => prev.map(item => {
          if (item.type === 'review' && item._id === reviewId) {
            // Create a deep copy of the likes array
            const updatedLikes = Array.isArray(updatedReview.likes) 
              ? updatedReview.likes.map(like => {
                  if (typeof like === 'object' && like !== null) {
                    return {...like};
                  }
                  return like;
                }) 
              : [];
              
            return {
              ...item,
              likes: updatedLikes
            };
          }
          return item;
        }));
      }
      
      // Refresh activities
      try {
        if (typeof refreshActivities === 'function') {
          await refreshActivities();
        }
      } catch (activityError) {
        console.error('Failed to refresh activities after review like:', activityError);
      }
    } catch (error) {
      console.error('CombinedFeed: Review like error:', error);
      toast({
        title: "Error",
        description: "Failed to like review. Please try again.",
        type: "error"
      });
    } finally {
      // Clear loading state
      setLoadingStates(prev => ({
        ...prev,
        reviewLikes: { ...prev.reviewLikes, [reviewId]: false }
      }));
    }
  };

  const handleReviewDelete = async (reviewId) => {
    try {
      await onReviewDelete(reviewId);
      
      // Update local state to remove deleted review
      setLocalItems(prev => prev.filter(item => 
        !(item.type === 'review' && item._id === reviewId)
      ));
      
      try {
        if (typeof refreshActivities === 'function') {
          await refreshActivities();
        }
      } catch (activityError) {
        console.error('Failed to refresh activities after review delete:', activityError);
      }
    } catch (error) {
      console.error('Review delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete review. Please try again.",
        type: "error"
      });
    }
  };

  const handleReviewEdit = (review) => {
    try {
      console.log('CombinedFeed: Editing review:', review?._id);
      onReviewEdit(review);
    } catch (error) {
      console.error('Review edit error:', error);
      toast({
        title: "Error",
        description: "Failed to edit review. Please try again.",
        type: "error"
      });
    }
  };

  const handleReviewComment = async (updatedReview) => {
    try {
      console.log('CombinedFeed handling review comment:', updatedReview?._id);
      
      // Update local state
      setLocalItems(prev => prev.map(item => {
        if (item.type === 'review' && item._id === updatedReview._id) {
          // Process comments for consistency
          const processedComments = updatedReview.comments ? updatedReview.comments.map(comment => {
            try {
              // Process comment media if present
              let commentMedia = comment.media;
              if (commentMedia) {
                commentMedia = {
                  ...commentMedia,
                  processedUrl: getMediaUrl(commentMedia, 'comment')
                };
              }
              
              return {
                ...comment,
                media: commentMedia
              };
            } catch (err) {
              console.error('Error processing comment media:', err);
              return comment;
            }
          }) : [];
          
          return { 
            ...item, 
            ...updatedReview,
            type: 'review', // Preserve the type
            sortDate: item.sortDate, // Preserve the original sort date
            comments: processedComments // Use processed comments
          };
        }
        return item;
      }));

      // Call parent handler
      const result = await onReviewComment(updatedReview);

      // Refresh activities without page reload
      try {
        if (typeof refreshActivities === 'function') {
          await refreshActivities();
        }
      } catch (activityError) {
        console.error('Failed to refresh activities after comment:', activityError);
      }
      
      return result;
    } catch (error) {
      console.error('Review comment error in CombinedFeed:', error);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        type: "error"
      });
      throw error;
    }
  };

  const handleNewsLike = async (newsId) => {
    if (!currentUser) {
      toast({
        title: "Login Required",
        description: "You need to be logged in to like content.",
        type: "warning"
      });
      return;
    }
    
    if (loadingStates.newsLikes[newsId]) return;

    try {
      setLoadingStates(prev => ({
        ...prev,
        newsLikes: { ...prev.newsLikes, [newsId]: true }
      }));

      await onNewsLike(newsId);
      
      // Update local state immediately for better UX
      setLocalItems(prev => prev.map(item => {
        if (item.type === 'news' && item._id === newsId) {
          // Clone the likes array
          let updatedLikes = Array.isArray(item.likes) ? [...item.likes] : [];
          
          // Check if user already liked
          const userLikedIndex = updatedLikes.findIndex(like => {
            if (typeof like === 'object' && like !== null) {
              return like._id === currentUser._id;
            }
            return like === currentUser._id;
          });
          
          if (userLikedIndex >= 0) {
            // User already liked, remove the like
            updatedLikes.splice(userLikedIndex, 1);
          } else {
            // User hasn't liked, add the like
            updatedLikes.push(currentUser._id);
          }
          
          return {
            ...item,
            likes: updatedLikes
          };
        }
        return item;
      }));
      
      try {
        if (typeof refreshActivities === 'function') {
          await refreshActivities();
        }
      } catch (activityError) {
        console.error('Failed to refresh activities after news like:', activityError);
      }
    } catch (error) {
      console.error('News like error:', error);
      toast({
        title: "Error",
        description: "Failed to like news. Please try again.",
        type: "error"
      });
    } finally {
      setLoadingStates(prev => ({
        ...prev,
        newsLikes: { ...prev.newsLikes, [newsId]: false }
      }));
    }
  };

  const handlePollVote = async (newsId, optionIndex) => {
    if (!currentUser) {
      toast({
        title: "Login Required",
        description: "You need to be logged in to vote in polls.",
        type: "warning"
      });
      return;
    }
    
    if (loadingStates.pollVotes[`${newsId}-${optionIndex}`]) return;
    
    try {
      // Set loading state
      setLoadingStates(prev => ({
        ...prev,
        pollVotes: { 
          ...prev.pollVotes, 
          [`${newsId}-${optionIndex}`]: true 
        }
      }));
      
      console.log('CombinedFeed: Submitting direct poll vote:', newsId, optionIndex);
      
      // Make a direct API call instead of using the callback
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(`${config.API_URL}/news/${newsId}/poll/vote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ optionIndex })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to vote: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('CombinedFeed: Direct vote successful, response:', result);
      
      // Extract the poll data from the response
      const updatedPoll = result.poll || result;
      
      if (!updatedPoll) {
        throw new Error('No poll data in response');
      }
      
      // Update local state
      setLocalItems(prev => {
        // Make a deep copy to ensure state updates properly
        const newItems = JSON.parse(JSON.stringify(prev));
        
        // Find and update the specific news item
        const updatedItems = newItems.map(item => {
          if (item.type === 'news' && item._id === newsId) {
            console.log('CombinedFeed: Updating news item with new poll data');
            return {
              ...item,
              poll: updatedPoll
            };
          }
          return item;
        });
        
        return updatedItems;
      });
      
      // Also call the original onVotePoll callback
      try {
        await onVotePoll(newsId, optionIndex);
      } catch (callbackError) {
        console.warn('CombinedFeed: Callback error (non-critical):', callbackError);
      }
      
      // Force refresh
      setTimeout(() => {
        console.log('CombinedFeed: Triggering refresh after poll vote');
        onRefreshContent();
      }, 500);
      
      // Dispatch global event
      const event = new CustomEvent('content-updated', {
        detail: { type: 'poll-vote', newsId, optionIndex }
      });
      window.dispatchEvent(event);
      
      return result;
    } catch (error) {
      console.error('CombinedFeed: Poll vote error:', error);
      toast({
        title: "Error",
        description: "Failed to submit vote: " + (error.message || "Unknown error"),
        type: "error"
      });
    } finally {
      // Clear loading state
      setLoadingStates(prev => ({
        ...prev,
        pollVotes: { 
          ...prev.pollVotes, 
          [`${newsId}-${optionIndex}`]: false 
        }
      }));
    }
  };

  // Content refresh handler
  const handleContentRefresh = () => {
    console.log('CombinedFeed: Triggering content refresh');
    onRefreshContent();
  };

  // Show error state if needed
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-md mb-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <p>{error}</p>
        </div>
        <button 
          onClick={handleContentRefresh}
          className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded-md text-sm hover:bg-red-200"
        >
          Try again
        </button>
      </div>
    );
  }

  // Loading state
  if (localItems.length === 0 && (!Array.isArray(reviews) || !Array.isArray(news) || (reviews.length === 0 && news.length === 0))) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No content available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pinned Content */}
      {pinnedItems.length > 0 && (
        <PinnedContentBox 
          items={pinnedItems}
          currentUser={currentUser}
          onReviewLike={handleReviewLike}
          onNewsLike={handleNewsLike}
          onVotePoll={handlePollVote}
          onReviewComment={handleReviewComment}
          onReviewDelete={handleReviewDelete}
          onReviewEdit={handleReviewEdit}
          onRefreshContent={handleContentRefresh}
        />
      )}
      
      {/* Regular Feed */}
      {regularItems.map(item => {
        if (!item || !item._id) {
          console.error('Invalid item in feed:', item);
          return null;
        }
        
        return item.type === 'news' ? (
          <NewsItem
            key={`news-${item._id}`}
            item={item}
            currentUser={currentUser}
            onLike={handleNewsLike}
            onVotePoll={(optionIndex) => handlePollVote(item._id, optionIndex)}
            onRefreshContent={handleContentRefresh}
          />
        ) : (
          <ReviewCard
            key={`review-${item._id}`}
            review={item}
            currentUser={currentUser}
            onLike={() => handleReviewLike(item._id)}
            onDelete={() => handleReviewDelete(item._id)}
            onEdit={() => handleReviewEdit(item)}
            onComment={handleReviewComment}
            isInFeed={true}
            isLiking={loadingStates.reviewLikes[item._id]}
            onRefreshContent={handleContentRefresh}
          />
        );
      })}
    </div>
  );
};

PinnedContentBox.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['news', 'review']).isRequired
    })
  ).isRequired,
  currentUser: PropTypes.object,
  onReviewLike: PropTypes.func,
  onNewsLike: PropTypes.func,
  onVotePoll: PropTypes.func,
  onReviewComment: PropTypes.func,
  onReviewDelete: PropTypes.func,
  onReviewEdit: PropTypes.func,
  onRefreshContent: PropTypes.func
};

CombinedFeed.propTypes = {
  reviews: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    userId: PropTypes.string.isRequired,
    userDisplayName: PropTypes.string.isRequired,
    userImage: PropTypes.string,
    title: PropTypes.string,
    introSummary: PropTypes.string,
    beefery: PropTypes.string.isRequired,
    location: PropTypes.string,
    rating: PropTypes.number.isRequired,
    date: PropTypes.string.isRequired,
    introComments: PropTypes.string,
    closingSummary: PropTypes.string,
    media: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        original: PropTypes.string,
        type: PropTypes.string
      })
    ]),
    likes: PropTypes.arrayOf(PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        _id: PropTypes.string.isRequired,
        displayName: PropTypes.string,
        username: PropTypes.string,
        profileImage: PropTypes.string
      })
    ])),
    comments: PropTypes.arrayOf(PropTypes.shape({
      _id: PropTypes.string.isRequired,
      text: PropTypes.string,
      userId: PropTypes.string.isRequired,
      userDisplayName: PropTypes.string.isRequired,
      date: PropTypes.string.isRequired
    }))
  })),
  news: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    date: PropTypes.string.isRequired,
    imageUrl: PropTypes.string,
    author: PropTypes.shape({
      userId: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.object
      ]),
      displayName: PropTypes.string,
      profileImage: PropTypes.string,
      role: PropTypes.string
    }),
    likes: PropTypes.arrayOf(PropTypes.string)
  })),
  currentUser: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    profileImage: PropTypes.string,
    role: PropTypes.string
  }),
  onReviewLike: PropTypes.func,
  onNewsLike: PropTypes.func,
  onVotePoll: PropTypes.func,
  onReviewDelete: PropTypes.func,
  onReviewComment: PropTypes.func,
  onCommentLike: PropTypes.func,
  onRefreshContent: PropTypes.func,
  onReviewEdit: PropTypes.func
};

export { NewsItem };
export default CombinedFeed;