import React, { useState, useEffect, useRef } from 'react';
import { Plus, Utensils, ArrowDown } from 'lucide-react';
import ReviewForm from '../review/ReviewForm';
import { Card } from '@/components/ui/card';
import { reviewService, newsService } from '../../services/api';
import CombinedFeed from './CombinedFeed';
import config from '../../config';
import _ from 'lodash';

// Import PullToRefresh component
import PullToRefresh from '../ui/PullToRefresh';

// Global cache to maintain state between unmounts/remounts
const globalReviewCache = window.REVIEW_CACHE = window.REVIEW_CACHE || {
  reviews: [],
  news: [],
  lastUpdated: 0
};

// Error boundary to catch rendering errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Feed error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-4 text-center">
          <h3 className="text-red-500 font-bold mb-2">Something went wrong loading the feed</h3>
          <p className="text-sm text-gray-600 mb-4">
            {this.state.error ? this.state.error.toString() : 'Unknown error'}
          </p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Try Again
          </button>
        </Card>
      );
    }

    return this.props.children;
  }
}

const RecentsScreen = ({ reviews = [], currentUser, onReviewAdded }) => {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [news, setNews] = useState([]);
  const [pois, setPois] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localReviews, setLocalReviews] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Track if we should do a full refresh on unmount
  const needsRefresh = useRef(false);
  const initializationAttempted = useRef(false);

  const handleEditReview = (review) => {
    setEditingReview(review);
    setShowReviewForm(true);
  };
  
  // Initialize from global cache or props on mount
  useEffect(() => {
    console.log('RecentsScreen initializing...', {
      reviewsCount: reviews?.length || 0,
      hasUser: Boolean(currentUser),
      globalCacheSize: globalReviewCache.reviews.length,
      cacheAge: Date.now() - globalReviewCache.lastUpdated
    });
    
    if (initializationAttempted.current) {
      console.log('RecentsScreen already attempted initialization, skipping');
      return;
    }
    
    initializationAttempted.current = true;
    
    // Perform initialization with robust error handling
    try {
      // If cache is recent (less than 5 minutes old) and not empty, use it
      const cacheFresh = (Date.now() - globalReviewCache.lastUpdated) < 300000;
      
      if (cacheFresh && globalReviewCache.reviews.length > 0) {
        console.log('Using global review cache with', globalReviewCache.reviews.length, 'reviews');
        setLocalReviews(globalReviewCache.reviews);
        
        if (globalReviewCache.news.length > 0) {
          console.log('Using cached news with', globalReviewCache.news.length, 'items');
          setNews(globalReviewCache.news);
        } else {
          fetchNews().catch(err => console.warn('News fetch error (non-critical):', err));
        }
        
        setLoading(false);
      } else {
        // Use props if available or fetch from API
        if (reviews.length > 0) {
          // Sort reviews to put featured ones first, then by date
          const sortedReviews = sortReviews([...reviews]);
          
          setLocalReviews(sortedReviews);
          
          // Update the global cache
          globalReviewCache.reviews = sortedReviews;
          globalReviewCache.lastUpdated = Date.now();
          console.log('Updated global review cache with', sortedReviews.length, 'reviews from props');
          
          fetchNews().catch(err => console.warn('News fetch error (non-critical):', err));
          setLoading(false);
        } else {
          // No cached data or props, fetch everything
          fetchReviews()
            .catch(err => {
              console.error('Reviews fetch error:', err);
              setError('Failed to load reviews. Please try again.');
              setLoading(false);
            });
        }
      }
      
      // Always fetch POIs as they're used for the form
      fetchPois().catch(err => console.warn('POIs fetch error (non-critical):', err));
    } catch (error) {
      console.error('RecentsScreen initialization error:', error);
      setError('An error occurred while initializing the screen. Please try again.');
      setLoading(false);
    }
    
    // When component unmounts, refresh parent if needed
    return () => {
      console.log('RecentsScreen unmounting, needsRefresh:', needsRefresh.current);
      if (needsRefresh.current && onReviewAdded) {
        try {
          onReviewAdded();
        } catch (err) {
          console.error('Error during onReviewAdded callback:', err);
        }
      }
    };
  }, []);
  
  // Sort reviews helper function - updated to handle featured reviews
  const sortReviews = (reviewsToSort) => {
    if (!Array.isArray(reviewsToSort)) {
      console.error('Invalid reviews array:', reviewsToSort);
      return [];
    }
    
    try {
      return [...reviewsToSort].sort((a, b) => {
        // Featured reviews always come first, same priority as pinned items
        if ((a.featured || (a.pinned && a.pinned.isPinned)) && 
            !(b.featured || (b.pinned && b.pinned.isPinned))) return -1;
        if (!(a.featured || (a.pinned && a.pinned.isPinned)) && 
            (b.featured || (b.pinned && b.pinned.isPinned))) return 1;
        
        // If both are featured or both are not featured, sort by date
        return new Date(b.date) - new Date(a.date);
      });
    } catch (err) {
      console.error('Error sorting reviews:', err);
      return reviewsToSort; // Return unsorted as fallback
    }
  };
  
  useEffect(() => {
    console.log('Setting up auto-refresh mechanism with deletion support');
    
    // Create event handler for refresh events
    const handleRefreshEvent = (event) => {
      console.log('Received refresh event:', event);
      
      // Check if this is a deletion event
      if (event.detail && event.detail.type === 'news-deleted') {
        console.log('Handling news deletion event for ID:', event.detail.id);
        // Update local state to remove the deleted item
        setLocalItems(prev => {
          if (!Array.isArray(prev)) return [];
          return prev.filter(item => !(item.type === 'news' && item._id === event.detail.id));
        });
        
        // Also update news array specifically
        setNews(prev => {
          if (!Array.isArray(prev)) return [];
          return prev.filter(item => item._id !== event.detail.id);
        });
      } else if (event.detail && event.detail.type === 'review-featured') {
        console.log('Handling review featured event for ID:', event.detail.reviewId);
        // Update the review's featured status
        setLocalReviews(prev => {
          if (!Array.isArray(prev)) return [];
          return prev.map(review => {
            if (review._id === event.detail.reviewId) {
              return {
                ...review,
                featured: event.detail.featured,
                // Also update pinned data for consistency
                pinned: event.detail.featured ? {
                  isPinned: true,
                  label: 'Featured Review',
                  pinnedAt: new Date()
                } : null
              };
            }
            return review;
          });
        });
      } else if (event.detail && (event.detail.type === 'poll-ended' || event.detail.type === 'poll-vote')) {
        // For poll updates, refresh the news
        console.log('Poll update detected, refreshing news');
        fetchNews().catch(err => console.warn('Refresh news error:', err));
      } else {
        // For other updates, refresh everything
        console.log('General content update, refreshing all data');
        fetchReviews().catch(err => console.warn('Refresh reviews error:', err));
        fetchNews().catch(err => console.warn('Refresh news error:', err));
      }
    };
    
    // Listen for the custom refresh event
    window.addEventListener('content-updated', handleRefreshEvent);
    
    // Set up a periodic polling for content refreshes
    const intervalId = setInterval(() => {
      console.log('Auto-refresh interval triggered');
      fetchNews()
        .then(() => console.log('News refreshed by interval'))
        .catch(err => console.warn('Auto-refresh news error:', err));
    }, 30000); // Check every 30 seconds
    
    // Clean up on unmount
    return () => {
      window.removeEventListener('content-updated', handleRefreshEvent);
      clearInterval(intervalId);
    };
  }, []);
  
  // When reviews prop changes, update if needed (not from global cache)
  useEffect(() => {
    try {
      // Only update from props if we have new data and it's different
      if (reviews.length > 0 && !_.isEqual(reviews, localReviews)) {
        console.log('Reviews prop changed, updating local state');
        
        // Sort reviews to put featured ones first, then by date
        const sortedReviews = sortReviews([...reviews]);
        
        setLocalReviews(sortedReviews);
        
        // Update the global cache
        globalReviewCache.reviews = sortedReviews;
        globalReviewCache.lastUpdated = Date.now();
      }
    } catch (err) {
      console.error('Error updating from props:', err);
    }
  }, [reviews]);

  const fetchNews = async () => {
    try {
      const response = await newsService.getNews();
      // Filter out non-visible news items for non-admin users
      const visibleNews = currentUser?.role === 'admin' 
        ? response.news 
        : response.news?.filter(item => item.visible);
      
      setNews(visibleNews || []);
      
      // Update the global cache
      globalReviewCache.news = visibleNews || [];
      return visibleNews;
    } catch (error) {
      console.error('Failed to fetch news:', error);
      setError('Failed to load news.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const fetchPois = async () => {
    try {
      const response = await fetch(`${config.API_URL}/admin/pois`);
      if (!response.ok) {
        throw new Error('Failed to fetch POIs');
      }
      const data = await response.json();
      setPois(data.pois);
      return data.pois;
    } catch (error) {
      console.error('Failed to fetch POIs:', error);
      // Don't set error state as POIs are optional
      return [];
    }
  };

  const fetchReviews = async () => {
    try {
      setLoading(true);
      console.log('Fetching reviews...');
      const response = await reviewService.getReviews();
      
      if (response && response.reviews) {
        // Process reviews to ensure featured ones also have pinned property
        const processedReviews = response.reviews.map(review => {
          if (review.featured && (!review.pinned || (typeof review.pinned === 'object' && !review.pinned.isPinned))) {
            // Add pinned property to featured reviews
            return {
              ...review,
              pinned: {
                isPinned: true,
                label: 'Featured Review',
                pinnedAt: new Date(review.date)
              }
            };
          }
          return review;
        });
        
        // Sort reviews to put featured ones first
        const sortedReviews = sortReviews(processedReviews);
        
        setLocalReviews(sortedReviews);
        
        // Update the global cache
        globalReviewCache.reviews = sortedReviews;
        globalReviewCache.lastUpdated = Date.now();
        console.log('Updated global review cache with', sortedReviews.length, 'reviews from API');
        
        // Also fetch news
        fetchNews().catch(err => console.warn('News fetch error (non-critical):', err));
        
        return sortedReviews;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      setError('Failed to load reviews.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleAddReview = async (formData) => {
    try {
      const newReview = await reviewService.addReview(formData);
      
      // Add the new review to our local state
      if (newReview) {
        setLocalReviews(prev => {
          // Add to beginning of array and re-sort to maintain featured order
          const updated = [newReview, ...prev];
          const sortedUpdated = sortReviews(updated);
          
          // Update the global cache
          globalReviewCache.reviews = sortedUpdated;
          globalReviewCache.lastUpdated = Date.now();
          
          return sortedUpdated;
        });
        
        // Mark for refresh on unmount
        needsRefresh.current = true;
        
        // IMPROVED: Store basic review info in localStorage for inter-component communication
        try {
          const lastAddedReview = {
            id: newReview._id,
            beefery: newReview.beefery,
            timestamp: Date.now()
          };
          localStorage.setItem('lastAddedReview', JSON.stringify(lastAddedReview));
        } catch (err) {
          console.warn('Failed to save lastAddedReview to localStorage:', err);
        }

        // IMPROVED: Dispatch comprehensive event with essential data
        const event = new CustomEvent('content-updated', {
          detail: { 
            type: 'review-added', 
            reviewId: newReview._id,
            beefery: newReview.beefery,
            location: newReview.location,
            coordinates: newReview.coordinates,
            rating: newReview.rating,
            timestamp: Date.now()
          }
        });
        
        console.log('RecentsScreen: Dispatching review-added event for', newReview.beefery);
        window.dispatchEvent(event);
        
        // Trigger immediate refresh through parent
        if (onReviewAdded) {
          try {
            onReviewAdded();
          } catch (err) {
            console.error('Error in onReviewAdded callback:', err);
          }
        }
      }
      
      return newReview;
    } catch (error) {
      console.error('Add review error:', error);
      throw error;
    }
  };

  const handleCommentLike = async (reviewId, commentId) => {
    try {
      console.log('Liking comment:', commentId, 'in review:', reviewId);
      
      // Call the API to like the comment
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
        throw new Error('Failed to like comment');
      }

      const updatedReview = await response.json();
      console.log('Received updated review after comment like');
      
      // Update the local reviews state with immutable pattern
      setLocalReviews(prev => {
        try {
          const updated = prev.map(review => {
            if (review._id === reviewId) {
              // Deep copy the comments from the updated review to avoid reference issues
              const updatedComments = updatedReview.comments.map(comment => ({
                ...comment,
                // Deep copy the likes array
                likes: Array.isArray(comment.likes)
                  ? comment.likes.map(like => {
                      if (typeof like === 'object' && like !== null) {
                        return {...like};
                      }
                      return like;
                    })
                  : []
              }));
              
              return {
                ...review,
                comments: updatedComments
              };
            }
            return review;
          });
          
          // Update the global cache
          globalReviewCache.reviews = updated;
          globalReviewCache.lastUpdated = Date.now();
          
          return updated;
        } catch (err) {
          console.error('Error updating state after comment like:', err);
          return prev; // Return unchanged state on error
        }
      });
      
      // Mark for refresh on unmount
      needsRefresh.current = true;
      
      // Trigger an immediate update in the parent component
      debouncedReviewUpdater();
      
      return updatedReview;
    } catch (error) {
      console.error('Comment like error:', error);
      throw error;
    }
  };

  const handleReviewLike = async (reviewId) => {
    try {
      console.log('Liking review:', reviewId);
      
      const result = await reviewService.likeReview(reviewId);
      console.log('Review like API response:', result._id, 'likes:', result.likes?.length);
      
      // Update the review in our local state
      if (result) {
        setLocalReviews(prev => {
          try {
            const updated = prev.map(review => {
              if (review._id === reviewId) {
                // Create a deep copy of the updated likes
                const updatedLikes = Array.isArray(result.likes) 
                  ? result.likes.map(like => {
                      if (typeof like === 'object' && like !== null) {
                        return {...like};
                      }
                      return like;
                    }) 
                  : [];
                
                console.log('Updating review with', updatedLikes.length, 'likes');
                
                // Return updated review with new likes
                return { 
                  ...review, 
                  likes: updatedLikes 
                };
              } 
              return review;
            });
            
            // Update the global cache
            globalReviewCache.reviews = updated;
            globalReviewCache.lastUpdated = Date.now();
            
            return updated;
          } catch (err) {
            console.error('Error updating state after review like:', err);
            return prev; // Return unchanged state on error
          }
        });
        
        // Mark for refresh on unmount
        needsRefresh.current = true;
        
        // Trigger an immediate update with debouncing protection
        debouncedReviewUpdater();
      }
      
      return result;
    } catch (error) {
      console.error('Like review error:', error);
      throw error;
    }
  };

  // Improved debounced updater with better timing
  const debouncedReviewUpdater = _.debounce(() => {
    console.log('Triggering debounced review update');
    if (onReviewAdded) {
      try {
        onReviewAdded();
      } catch (err) {
        console.error('Error in debounced review updater:', err);
      }
    }
  }, 1000); // Wait 1 second before triggering refresh

  const handleReviewComment = async (updatedReview) => {
    try {
      if (!updatedReview || !updatedReview._id) {
        console.error('Invalid updatedReview object:', updatedReview);
        throw new Error('Invalid review update received');
      }
      
      console.log('Handling review comment update for review:', updatedReview._id);
      
      // Update the review in our local state with immutable pattern
      setLocalReviews(prev => {
        try {
          // Find the review in our current state
          const reviewIndex = prev.findIndex(r => r._id === updatedReview._id);
          
          if (reviewIndex === -1) {
            console.warn('Review not found in local state:', updatedReview._id);
            return prev; // Return unchanged if review not found
          }
          
          // Create a new array with the updated review
          const newReviews = [...prev];
          
          // Deep copy the comments to avoid reference issues
          const updatedComments = updatedReview.comments.map(comment => ({
            ...comment,
            likes: Array.isArray(comment.likes)
              ? comment.likes.map(like => {
                  if (typeof like === 'object' && like !== null) {
                    return {...like};
                  }
                  return like;
                })
              : []
          }));
          
          newReviews[reviewIndex] = {
            ...prev[reviewIndex],
            comments: updatedComments
          };
          
          // Update the global cache
          globalReviewCache.reviews = newReviews;
          globalReviewCache.lastUpdated = Date.now();
          
          return newReviews;
        } catch (err) {
          console.error('Error updating state after comment:', err);
          return prev; // Return unchanged state on error
        }
      });
      
      // Mark for refresh on unmount
      needsRefresh.current = true;
      
      // Also trigger immediate refresh through the debouncer
      debouncedReviewUpdater();
      
      return updatedReview;
    } catch (error) {
      console.error('Review comment error:', error);
      throw error;
    }
  };

  // UPDATED: Enhanced handleNewsLike function
  const handleNewsLike = async (newsId) => {
    if (!currentUser) return;
    
    try {
      console.log('Liking news item:', newsId);
      
      await newsService.likeNews(newsId);
      
      // Update news item in the local state
      setNews(prevNews => {
        try {
          const updated = prevNews.map(item => {
            if (item._id === newsId) {
              // Check if user already liked
              const userLiked = item.likes?.includes(currentUser._id);
              
              return {
                ...item,
                likes: userLiked
                  ? item.likes.filter(id => id !== currentUser._id) // Remove like
                  : [...(item.likes || []), currentUser._id]        // Add like
              };
            }
            return item;
          });
          
          // Update the global cache
          globalReviewCache.news = updated;
          
          return updated;
        } catch (err) {
          console.error('Error updating state after news like:', err);
          return prevNews; // Return unchanged state on error
        }
      });
      
      // Mark for refresh on unmount
      needsRefresh.current = true;
      
      // Dispatch event for other components
      const event = new CustomEvent('content-updated', {
        detail: { type: 'news-like', newsId }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Like news error:', error);
    }
  };

  const handleReviewDelete = async (reviewId) => {
    try {
      console.log('Deleting review:', reviewId);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Make DELETE request to the reviews endpoint
      const response = await fetch(`${config.API_URL}/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `Failed to delete review: ${response.status}`);
      }

      // Remove the review from our local state
      setLocalReviews(prev => {
        try {
          const updated = prev.filter(review => review._id !== reviewId);
          
          // Update the global cache
          globalReviewCache.reviews = updated;
          globalReviewCache.lastUpdated = Date.now();
          
          return updated;
        } catch (err) {
          console.error('Error updating state after review delete:', err);
          return prev; // Return unchanged state on error
        }
      });
      
      // Mark for refresh on unmount
      needsRefresh.current = true;
      
      // Trigger immediate refresh
      debouncedReviewUpdater();
    } catch (error) {
      console.error('Delete review error:', error);
      throw error;
    }
  };

  // Content refresh method
  const handleContentRefresh = async () => {
    console.log('Refreshing content...');
    setIsRefreshing(true);
    
    try {
      // Mark for refresh on unmount
      needsRefresh.current = true;
      
      // Immediate refresh
      await fetchReviews();
      await fetchNews();
    } catch (error) {
      console.error('Content refresh error:', error);
      setError('Failed to refresh content. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Pull to refresh handler
  const handlePullToRefresh = async () => {
    console.log('Pull to refresh triggered');
    return handleContentRefresh();
  };

  // UPDATED: Enhanced handlePollVote function for more reliable poll voting
  const handlePollVote = async (newsId, optionIndex) => {
    if (!currentUser) return;
    
    try {
      console.log(`RecentsScreen: Voting on poll ${newsId}, option ${optionIndex}`);
      
      // Call the direct API
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
      console.log('RecentsScreen: Vote successful, response:', result);
      
      // Update the news item in our state
      setNews(prevNews => {
        return prevNews.map(item => {
          if (item._id === newsId && result.poll) {
            return { ...item, poll: result.poll };
          }
          return item;
        });
      });
      
      // Trigger a global content update
      const event = new CustomEvent('content-updated', {
        detail: { type: 'poll-vote', newsId, optionIndex }
      });
      window.dispatchEvent(event);
      
      // Refresh all news data to ensure consistency
      fetchNews();
      
      return result;
    } catch (error) {
      console.error('RecentsScreen: Poll vote error:', error);
      throw error;
    }
  };

  const handleUpdateReview = async (formData) => {
    try {
      if (!editingReview || !editingReview._id) {
        throw new Error('Invalid review data for update');
      }
      
      setLoading(true);
      setError('');

      // Make sure review ID is included
      const reviewId = editingReview._id;
      
      // Call the API to update the review
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${config.API_URL}/reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update review');
      }

      const updatedReview = await response.json();
      console.log('Review updated successfully:', updatedReview._id);
      
      // Check if the review has a 'featured' property and ensure it has the matching 'pinned' property
      if (updatedReview.featured && (!updatedReview.pinned || !updatedReview.pinned.isPinned)) {
        updatedReview.pinned = {
          isPinned: true,
          label: 'Featured Review',
          pinnedAt: new Date()
        };
      }
      
      // Update the local state
      setLocalReviews(prev => 
        prev.map(review => review._id === reviewId ? updatedReview : review)
      );

      // Clear caches to ensure fresh data
      if (typeof reviewService.clearCache === 'function') {
        reviewService.clearCache();
      }
      
      // Dispatch events to notify other components
      const event = new CustomEvent('content-updated', {
        detail: { 
          type: 'review-updated', 
          reviewId,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
      
      // Close the form
      setShowReviewForm(false);
      setEditingReview(null);
      
      // Show success notification if available
      if (typeof showNotification === 'function') {
        showNotification('success', 'Review updated successfully');
      } else {
        alert('Review updated successfully');
      }

      return updatedReview;
    } catch (error) {
      console.error('Review update error:', error);
      setError(error.message || 'Failed to update review');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Empty state component
  const EmptyState = () => (
    <Card className="p-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center">
          <Utensils className="w-8 h-8 text-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground">No Content Yet</h3>
        <p className="text-muted-foreground max-w-sm">
          Be the first to share content! Review a North Shore beef or wait for the latest news.
        </p>
        {currentUser && (
          <button
            onClick={() => setShowReviewForm(true)}
            className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add First Review
          </button>
        )}
      </div>
    </Card>
  );

  const hasContent = localReviews.length > 0 || news.length > 0;

  return (
    <div className="py-6 space-y-6 pb-24">
      {/* Add Review Button - Only show if there is existing content */}
      {hasContent && currentUser && (
        <button
          onClick={() => setShowReviewForm(true)}
          className="w-full p-4 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Review
        </button>
      )}

      {/* Wrap the feed with PullToRefresh component */}
      <PullToRefresh 
        onRefresh={handlePullToRefresh} 
        isRefreshing={isRefreshing}
        pullDownThreshold={80}
        maxPullDownDistance={120}
        refreshIndicatorClassName="flex items-center justify-center py-3 text-primary"
      >
        {/* Combined Feed */}
        <div className="space-y-4 pt-2">
          {loading ? (
            <div className="text-center py-8">Loading content...</div>
          ) : !hasContent ? (
            <EmptyState />
          ) : (
            <ErrorBoundary>
              <CombinedFeed
                reviews={localReviews}
                news={news}
                currentUser={currentUser}
                onReviewLike={handleReviewLike}
                onNewsLike={handleNewsLike}
                onVotePoll={handlePollVote}
                onReviewDelete={handleReviewDelete}
                onReviewComment={handleReviewComment}
                onCommentLike={handleCommentLike}
                onRefreshContent={handleContentRefresh}
                onReviewEdit={handleEditReview}
              />
            </ErrorBoundary>
          )}
        </div>
      </PullToRefresh>

      {/* Review Form Modal */}
      {showReviewForm && (
        <ReviewForm
          review={editingReview}
          reviews={localReviews}
          pois={pois}
          onClose={() => {
            setShowReviewForm(false);
            setEditingReview(null);
          }}
          onSubmit={editingReview ? handleUpdateReview : handleAddReview}
          currentUser={currentUser}
          isEditing={!!editingReview}
        />
      )}
    </div>
  );
};

export default RecentsScreen;