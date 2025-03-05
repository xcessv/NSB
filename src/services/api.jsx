import config from '../config';
import _ from 'lodash';
import { eventBus as appEventBus } from '../utils/eventBus'; // Import the singleton eventBus

// --------------------------------------
// CONSTANTS
// --------------------------------------

// Activity Types constant
const ACTIVITY_TYPES = {
  REVIEW_LIKE: 'review_like',
  COMMENT_LIKE: 'comment_like',
  REVIEW_COMMENT: 'review_comment',
  NEW_USER: 'new_user',
  NEW_REVIEW: 'new_review',
  POLL_VOTE: 'poll_vote',
  NEWS_LIKE: 'news_like'
};

// --------------------------------------
// HELPER FUNCTIONS
// --------------------------------------

// API Response handler helper
const handleApiResponse = async (response, errorMessage) => {
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || errorMessage);
  }
  return response.json();
};

// Auth token helper
const getAuthHeaders = (contentType = 'application/json') => {
  const token = localStorage.getItem('token');
  const headers = {
    'Authorization': `Bearer ${token}`
  };
  
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  
  return headers;
};

// Media URL helper
const getMediaUrl = (media, mediaType = 'general') => {
  // Early validation
  if (!media) {
    console.warn('getMediaUrl called with null/undefined media');
    return null;
  }
  
  // Extract the URL string from different possible formats
  let url = null;
  
  if (typeof media === 'string') {
    url = media;
  } else if (media.url) {
    url = media.url;
  } else if (media.original) {
    url = media.original;
  } else {
    console.warn('Media object has no url or original property:', media);
    return null;
  }
  
  if (!url) {
    console.warn('No valid URL found in media object');
    return null;
  }
  
  // Handle absolute filesystem paths that shouldn't appear in URLs
  if (url.includes(':\\') || url.startsWith('C:/') || url.startsWith('/C:/')) {
    console.error('Invalid absolute path detected in media URL:', url);
    // Extract just the filename as a fallback
    const filename = url.split(/[/\\]/).pop();
    url = `/uploads/${mediaType}/${filename}`;
  }
  
  // Clean up path
  url = url.replace(/\/uploads\/uploads\//, '/uploads/');
  url = url.replace(/^\/api\//, '');
  
  // Ensure path starts with /uploads/ if it doesn't have a proper prefix
  if (!url.startsWith('/uploads/') && !url.startsWith('http')) {
    url = `/uploads/${url}`;
  }
  
  // Remove any duplicate slashes
  url = url.replace(/\/\//g, '/');

  // Configure base URL without API suffix
  const baseUrl = config.API_URL.endsWith('/api/') 
    ? config.API_URL.slice(0, -5)  // Remove trailing "/api/"
    : config.API_URL.endsWith('/api') 
      ? config.API_URL.slice(0, -4)  // Remove trailing "/api"
      : config.API_URL;

  // Final URL
  const fullUrl = `${baseUrl}${url}`;
  return fullUrl;
};

// Global error handler
const handleError = (error, context) => {
  console.error(`Error in ${context}:`, error);
  
  if (error.message?.includes('authentication') || error.message?.includes('token')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return;
  }
  
  throw error;
};

// Enhanced activity refresh helper with improved debouncing and error handling
const refreshActivities = _.debounce(async () => {
  try {
    console.log('Refreshing activities...');
    
    // To prevent possible loops, check if we've refreshed recently
    const lastRefresh = parseInt(sessionStorage.getItem('lastActivitiesRefresh') || '0');
    const now = Date.now();
    
    // Skip if we refreshed less than 5 seconds ago
    if (now - lastRefresh < 5000) {
      console.log('Skipping activities refresh - refreshed too recently');
      return true; // Return success without actually refreshing
    }
    
    // Clear activities cache first
    cacheHelpers.clearAll('activities-');
    
    // Track this refresh
    sessionStorage.setItem('lastActivitiesRefresh', now.toString());
    
    // Fetch fresh data
    await activityService.getActivities();
    
    console.log('Activities refreshed successfully');
    
    // Notify subscribers that activities have been updated
    if (window.eventBus) {
      window.eventBus.emit('activities-refreshed', {
        timestamp: now
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to refresh activities:', error);
    return false;
  }
}, 3000, { leading: false, trailing: true }); // Increased from 1000ms to 3000ms with trailing-only

// --------------------------------------
// CACHE MANAGEMENT
// --------------------------------------

const cacheHelpers = {
  // Store a value in cache with timestamp
  set: (key, value, expireMs = 300000) => { // Default 5 minutes
    try {
      const item = {
        value,
        timestamp: Date.now(),
        expiry: Date.now() + expireMs
      };
      localStorage.setItem(key, JSON.stringify(item));
      return true;
    } catch (error) {
      console.error(`Error caching ${key}:`, error);
      return false;
    }
  },
  
  // Get a value from cache, returns null if expired or not found
  get: (key) => {
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return null;
      
      const item = JSON.parse(itemStr);
      const now = Date.now();
      
      if (now > item.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      
      return item.value;
    } catch (error) {
      console.error(`Error retrieving ${key} from cache:`, error);
      return null;
    }
  },
  
  // Clear a specific cache item
  clear: (key) => {
    localStorage.removeItem(key);
  },
  
  // Clear all cache items with a certain prefix
  clearAll: (prefix) => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  }
};

// --------------------------------------
// AUTHENTICATION SERVICE
// --------------------------------------

const authService = {
  login: async (credentials) => {
    try {
      console.log('authService login received:', credentials);

      if (!credentials.login && !credentials.identifier) {
        throw new Error('Username or email is required');
      }

      const loginData = {
        login: (credentials.login || credentials.identifier).toLowerCase(),
        password: credentials.password
      };

      console.log('Sending to API:', loginData);

      const response = await fetch(`${config.API_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(loginData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.log('Error response:', errorData);
        throw new Error(errorData.message || 'Invalid credentials');
      }

      const data = await response.json();
      console.log('Success response:', data);
      
      if (data.token) localStorage.setItem('token', data.token);
      if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
      
      // Clear all cached data on login to ensure fresh state
      cacheHelpers.clearAll('reviews-');
      cacheHelpers.clearAll('activities-');
      cacheHelpers.clearAll('comments-');

      // Load initial activities after login
      try {
        await refreshActivities();
      } catch (activityError) {
        console.error('Failed to load initial activities:', activityError);
      }

      return data.user;
    } catch (error) {
      console.error('Login error details:', error);
      throw error;
    }
  },
  
  register: async (formData) => {
    try {
      const username = formData.get('username');
      const email = formData.get('email');
      
      if (username) formData.set('username', username.toLowerCase());
      if (email) formData.set('email', email.toLowerCase());
      
      const response = await fetch(`${config.API_URL}/users/register`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }
      
      const data = await response.json();
      if (data.token) localStorage.setItem('token', data.token);
      if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
      
      // Clear cached data
      cacheHelpers.clearAll('reviews-');
      cacheHelpers.clearAll('activities-');

      // Only try to refresh activities if the user is an admin
      if (data.user && data.user.role === 'admin') {
        try {
          await refreshActivities();
        } catch (activityError) {
          console.error('Failed to create new user activity:', activityError);
        }
      }

      return data.user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  getCurrentUser: () => {
    try {
      const userString = localStorage.getItem('user');
      if (!userString) return null;
      
      const user = JSON.parse(userString);
      if (!user) return null;

      const token = localStorage.getItem('token');
      if (!token) {
        localStorage.removeItem('user');
        return null;
      }

      return user;
    } catch (error) {
      console.error('Get current user error:', error);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      return null;
    }
  },

  logout: () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Clear all application caches on logout
      cacheHelpers.clearAll('reviews-');
      cacheHelpers.clearAll('activities-');
      cacheHelpers.clearAll('comments-');
      cacheHelpers.clearAll('news-');
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  validateSession: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      // Try to get from cache
      const cacheKey = 'session-validation';
      const cachedValid = cacheHelpers.get(cacheKey);
      if (cachedValid) return true;

      const response = await fetch(`${config.API_URL}/users/validate-session`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Invalid session');
      }

      const data = await response.json();
      if (data.valid && data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        window.dispatchEvent(new Event('userDataUpdated'));
        
        // Cache the validation result for 10 minutes
        cacheHelpers.set(cacheKey, true, 10 * 60 * 1000);
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Session validation error:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return false;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${config.API_URL}/users/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to change password');
      }

      // Clear session validation cache
      cacheHelpers.clear('session-validation');
      
      return true;
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }
};

// --------------------------------------
// USER SERVICE
// --------------------------------------

const userService = {
  updateProfile: async (formData) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      console.log('Sending profile update with data:');
      for (let pair of formData.entries()) {
        console.log(pair[0] + ': ' + (pair[1] instanceof File ? `File: ${pair[1].name}` : pair[1]));
      }

      const response = await fetch(`${config.API_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const updatedUser = await response.json();
      console.log('Received updated user data:', updatedUser);

      // Update local storage
      localStorage.setItem('user', JSON.stringify(updatedUser.user || updatedUser));
      
      // Clear user cache
      cacheHelpers.clear(`user-${updatedUser._id || updatedUser.id}`);
      
      // Notify other components of the update
      window.dispatchEvent(new Event('userDataUpdated'));
      
      // Use event bus if available
      if (window.eventBus) {
        window.eventBus.emit('user-updated', {
          userId: updatedUser._id || updatedUser.id,
          timestamp: Date.now()
        });
      }

      // Refresh activities after profile update
      try {
        await refreshActivities();
      } catch (activityError) {
        console.error('Failed to refresh activities after profile update:', activityError);
      }

      return updatedUser.user || updatedUser;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  },

  getProfileImage: (user) => {
    // Early bail out if user is invalid
    if (!user) {
      console.warn('getProfileImage called with null/undefined user');
      return config.DEFAULT_AVATAR || '/images/default-avatar.png';
    }
    
    // If no profile image, return default
    if (!user.profileImage) {
      return config.DEFAULT_AVATAR || '/images/default-avatar.png';
    }

    // Add cache-busting timestamp
    const timestamp = new Date().getTime();
    
    // Process the image path
    let imagePath = user.profileImage;
    
    // If it's already a full URL, just return it with cache busting
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return `${imagePath}?t=${timestamp}`;
    }
    
    // Clean up API URL to ensure proper format
    const baseUrl = config.API_URL.endsWith('/api/') 
      ? config.API_URL.slice(0, -5)
      : config.API_URL.endsWith('/api') 
        ? config.API_URL.slice(0, -4)
        : config.API_URL;
    
    // Cleanup path
    // Remove any duplicate upload prefixes
    imagePath = imagePath.replace(/\/uploads\/uploads\//, '/uploads/');
    
    // Handle paths that start with /api/
    if (imagePath.startsWith('/api/')) {
      imagePath = imagePath.slice(4);
    }

    // Ensure path starts with /
    if (!imagePath.startsWith('/')) {
      imagePath = '/' + imagePath;
    }

    return `${baseUrl}${imagePath}?t=${timestamp}`;
  },
  
  getCurrentUser: () => {
    try {
      const userString = localStorage.getItem('user');
      if (!userString) return null;
      
      const user = JSON.parse(userString);
      if (!user) return null;

      const token = localStorage.getItem('token');
      if (!token) {
        localStorage.removeItem('user');
        return null;
      }

      return user;
    } catch (error) {
      console.error('Get current user error:', error);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      return null;
    }
  }
};

// --------------------------------------
// REVIEW SERVICE
// --------------------------------------

// Add a variable to track if cache is being cleared
let isCurrentlyRefreshing = false;
// Add a review counter to localStorage for tracking new reviews
let reviewCounter = parseInt(localStorage.getItem('reviewCount') || '0');

// Enhanced reviewService with better refresh mechanisms
const reviewService = {
  // Clear all review caches
  clearCache: () => {
    if (isCurrentlyRefreshing) {
      console.log('Already refreshing review cache, skipping duplicate call');
      return;
    }
    
    isCurrentlyRefreshing = true;
    console.log('Clearing all review caches...');
    
    try {
      // Clear all review-related caches
      cacheHelpers.clearAll('reviews-');
      // Update review counter and store it in localStorage
      reviewCounter++;
      localStorage.setItem('reviewCount', reviewCounter.toString());
      // Store timestamp of last refresh for other components to check
      localStorage.setItem('reviewTimestamp', Date.now().toString());
      
      console.log('Review caches cleared successfully');
    } catch (error) {
      console.error('Error clearing review caches:', error);
    } finally {
      isCurrentlyRefreshing = false;
    }
  },

  getReviews: async (options = {}) => {
    try {
      const filters = options.filters || {};
      const forceRefresh = options.forceRefresh || false;
      
      const queryParams = new URLSearchParams(filters);
      const cacheKey = `reviews-${queryParams.toString() || 'all'}`;
      
      // Try to get from cache first, unless forceRefresh is true
      if (!forceRefresh) {
        const cachedData = cacheHelpers.get(cacheKey);
        if (cachedData) {
          console.log('Using cached reviews data');
          return cachedData;
        }
      } else {
        console.log('Forcing fresh reviews data');
      }
      
      // Add cache busting parameter for truly fresh data on force refresh
      if (forceRefresh) {
        queryParams.append('_t', Date.now());
      }
      
      // Get auth token if available (for authenticated requests)
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      const response = await fetch(`${config.API_URL}/reviews?${queryParams}`, {
        headers,
        cache: forceRefresh ? 'no-cache' : 'default'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch reviews');
      }
      
      const data = await response.json();
      
      // Process the data to ensure any likes are correctly formatted
      if (data.reviews && Array.isArray(data.reviews)) {
        const currentUser = authService.getCurrentUser();
        
        // For each review, ensure the likes array is properly processed
        data.reviews.forEach(review => {
          if (review.comments && Array.isArray(review.comments)) {
            // Recursively process all comments and their children
            const processComments = (comments) => {
              comments.forEach(comment => {
                // Ensure comment likes are arrays
                if (comment.likes && !Array.isArray(comment.likes)) {
                  comment.likes = [];
                }
                
                // Process nested comments recursively
                if (comment.children && Array.isArray(comment.children)) {
                  processComments(comment.children);
                }
              });
            };
            
            processComments(review.comments);
          }
        });
      }
      
      // Store in cache even if it was a forced refresh
      cacheHelpers.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes cache
      
      return data;
    } catch (error) {
      console.error('Get reviews error:', error);
      throw error;
    }
  },

  addReview: async (formData) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      console.log('Sending review data:', {
        entries: Array.from(formData.entries()).reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {})
      });
      
      const response = await fetch(`${config.API_URL}/reviews`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create review');
      }

      const responseData = await response.json();
      console.log('Server response:', responseData);

      // ============= ENHANCED NOTIFICATION MECHANISM =============
      
      // 1. Clear all review caches
      reviewService.clearCache();
      
      // 2. Store the last added review in localStorage
      const beeferyName = formData.get('beefery');
      try {
        localStorage.setItem('lastAddedReview', JSON.stringify({
          beefery: beeferyName,
          id: responseData._id || responseData.id,
          timestamp: Date.now()
        }));
      } catch (storageError) {
        console.warn('Failed to store lastAddedReview in localStorage:', storageError);
      }
      
      // 3. Fire multiple events to ensure all components are notified
      // a. Standard content-updated event
      const contentUpdatedEvent = new CustomEvent('content-updated', {
        detail: {
          type: 'review-added',
          beefery: beeferyName,
          reviewId: responseData._id || responseData.id,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(contentUpdatedEvent);
      
      // b. Dedicated review-added event
      const reviewAddedEvent = new CustomEvent('review-added', {
        detail: {
          beefery: beeferyName,
          reviewId: responseData._id || responseData.id,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(reviewAddedEvent);
      
      // c. Storage event to notify other tabs/windows
      try {
        // Update a value in localStorage to trigger storage events in other tabs
        localStorage.setItem('reviewTimestamp', Date.now().toString());
      } catch (e) {
        console.warn('Could not trigger storage event:', e);
      }
      
      // 4. Use event bus if available
      if (window.eventBus) {
        window.eventBus.emit('review-added', {
          beefery: beeferyName,
          reviewId: responseData._id || responseData.id,
          timestamp: Date.now()
        });
      }
      
      // 5. Increment review count in localStorage
      try {
        const currentCount = parseInt(localStorage.getItem('reviewCount') || '0');
        localStorage.setItem('reviewCount', (currentCount + 1).toString());
      } catch (e) {
        console.warn('Could not update review count:', e);
      }
      
      // 6. Trigger activity creation after a short delay to ensure review is fully processed
      setTimeout(async () => {
        try {
          await refreshActivities();
        } catch (activityError) {
          console.error('Failed to refresh activities:', activityError);
        }
      }, 500);

      return responseData;
    } catch (error) {
      console.error('Add review error details:', error);
      throw error;
    }
  },

  likeReview: async (reviewId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      console.log('API: Sending like request for review:', reviewId);

      const response = await fetch(`${config.API_URL}/reviews/${reviewId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to like review');
      }

      const updatedReview = await response.json();
      console.log('API: Received updated review after like:', {
        reviewId: updatedReview._id,
        likesCount: updatedReview.likes ? updatedReview.likes.length : 0,
        likes: updatedReview.likes
      });

      // Update cache with the new review data
      const reviewCacheKey = `review-${reviewId}`;
      cacheHelpers.set(reviewCacheKey, updatedReview);
      
      // Invalidate reviews list caches to ensure fresh data on next load
      cacheHelpers.clearAll('reviews-');

      // Refresh activities after like
      try {
        await refreshActivities();
      } catch (activityError) {
        console.error('Failed to refresh activities after like:', activityError);
      }

      // Notify subscribers that review data has changed
      if (window.eventBus) {
        window.eventBus.emit('review-updated', {
          reviewId,
          action: 'like',
          timestamp: Date.now()
        });
      }

      return updatedReview;
    } catch (error) {
      console.error('API: Like review error details:', error);
      throw error;
    }
  },

  addComment: async (reviewId, formData) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      // Log the data being sent (for debugging)
      const formDataEntries = {};
      for (let [key, value] of formData.entries()) {
        formDataEntries[key] = value instanceof File ? `File: ${value.name}` : value;
      }
      console.log('Sending comment data:', formDataEntries);

      const response = await fetch(`${config.API_URL}/reviews/${reviewId}/comment`, {
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

      // Update cache with the new review data
      const reviewCacheKey = `review-${reviewId}`;
      cacheHelpers.set(reviewCacheKey, updatedReview);
      
      // Instead of calling refreshActivities immediately, just log the comment activity once
      try {
        const newComment = updatedReview.comments[updatedReview.comments.length - 1];
        const currentUser = authService.getCurrentUser();
        
        // Log the activity without refreshing
        await activityService.logCommentActivity(updatedReview, newComment, currentUser);
        
        // Notify subscribers that a new comment was added
        if (window.eventBus) {
          window.eventBus.emit('comment-added', {
            reviewId,
            commentId: newComment._id,
            timestamp: Date.now()
          });
        }
      } catch (activityError) {
        console.error('Activity logging error:', activityError);
      }

      return updatedReview;
    } catch (error) {
      console.error('Add comment error:', error);
      throw error;
    }
  },

  getComments: async (reviewId) => {
    try {
      // Try to get from cache first
      const cacheKey = `comments-${reviewId}`;
      const cachedData = cacheHelpers.get(cacheKey);
      if (cachedData) {
        console.log('Using cached comments data for review', reviewId);
        return cachedData;
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.API_URL}/reviews/${reviewId}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch comments');
      }

      const data = await response.json();
      
      // Store in cache
      cacheHelpers.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes cache
      
      return data;
    } catch (error) {
      console.error('Get comments error:', error);
      throw error;
    }
  },

  deleteComment: async (reviewId, commentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.API_URL}/reviews/${reviewId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete comment');
      }

      const updatedReview = await response.json();
      
      // Update caches
      const reviewCacheKey = `review-${reviewId}`;
      const commentsCacheKey = `comments-${reviewId}`;
      cacheHelpers.set(reviewCacheKey, updatedReview);
      cacheHelpers.clear(commentsCacheKey); // Force refresh of comments
      
      // Clear the specific comment from cache
      activityService.updateCommentCache(reviewId, commentId, null);
      
      // Notify subscribers that comment was deleted
      if (window.eventBus) {
        window.eventBus.emit('comment-deleted', {
          reviewId,
          commentId,
          timestamp: Date.now()
        });
      }

      return updatedReview;
    } catch (error) {
      console.error('Delete comment error:', error);
      throw error;
    }
  },

  likeComment: async (reviewId, commentId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      // Validate parameters to prevent errors
      if (!reviewId || !commentId) {
        throw new Error('Missing required parameters: reviewId and commentId');
      }
      
      // Additional validation
      if (reviewId === commentId) {
        console.error('reviewId and commentId cannot be the same', { reviewId, commentId });
        throw new Error('Invalid commentId');
      }

      console.log(`API: Sending like request for comment ${commentId} in review ${reviewId}`);

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
        // Try to parse error response
        let errorMessage = `Server returned ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If parsing fails, use response text
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            // If even that fails, stick with status
          }
        }
        throw new Error(errorMessage);
      }

      const updatedReview = await response.json();
      
      // Find the updated comment in the review
      const findComment = (comments, targetId) => {
        if (!comments || !Array.isArray(comments)) return null;
        
        for (const comment of comments) {
          if (comment._id === targetId) return comment;
          
          if (comment.children && comment.children.length > 0) {
            const found = findComment(comment.children, targetId);
            if (found) return found;
          }
        }
        
        return null;
      };
      
      const updatedComment = findComment(updatedReview.comments, commentId);
      
      if (!updatedComment) {
        console.error('Could not find comment in server response:', { 
          commentId, 
          reviewComments: updatedReview.comments?.length || 0 
        });
        // Continue anyway since we have the updated review
      } else {
        console.log(`Comment ${commentId} updated, likes count:`, updatedComment.likes?.length || 0);
      }
      
      // Update caches - both specific comment and overall review
      try {
        // Update comment-specific cache
        if (updatedComment) {
          activityService.updateCommentCache(reviewId, commentId, updatedComment);
        }
        
        // Update review cache completely
        const reviewCacheKey = `review-${reviewId}`;
        cacheHelpers.set(reviewCacheKey, updatedReview);
        
        // Update the comments cache for this review
        const commentsCacheKey = `comments-${reviewId}`;
        cacheHelpers.set(commentsCacheKey, updatedReview.comments);
        
        // Also update the global cached reviews if present
        const cachedReviews = JSON.parse(localStorage.getItem('cachedReviews') || '{}');
        if (cachedReviews[reviewId]) {
          cachedReviews[reviewId] = {
            ...cachedReviews[reviewId],
            ...updatedReview,
            timestamp: Date.now()
          };
          localStorage.setItem('cachedReviews', JSON.stringify(cachedReviews));
        }
        
        // Invalidate reviews list cache to ensure fresh data on next page load
        cacheHelpers.clearAll('reviews-list-');
      } catch (cacheError) {
        console.warn('Error updating caches:', cacheError);
        // Not critical, continue execution
      }

      // Refresh activities
      try {
        setTimeout(() => {
          refreshActivities().catch(err => {
            console.warn('Non-critical error refreshing activities:', err);
          });
        }, 0);
      } catch (refreshError) {
        console.warn('Failed to refresh activities after comment like:', refreshError);
      }

      // Notify subscribers that comment was liked
      if (window.eventBus) {
        window.eventBus.emit('comment-updated', {
          reviewId,
          commentId,
          type: 'like',
          timestamp: Date.now()
        });
      }

      return updatedReview;
    } catch (error) {
      console.error('Like comment error:', error);
      throw error;
    }
  },

  /**
   * Pin or unpin a review (admin only)
   * @param {string} reviewId - The ID of the review
   * @param {boolean} isPinned - Whether to pin or unpin
   * @param {string} [label] - Optional label for the pinned content
   * @returns {Promise<Object>} The updated review
   */
  updatePinStatus: async (reviewId, isPinned, label = '') => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${config.API_URL}/reviews/${reviewId}/pin`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isPinned, label })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update pin status');
      }

      const updatedReview = await response.json();
      
      // Update caches
      const reviewCacheKey = `review-${reviewId}`;
      cacheHelpers.set(reviewCacheKey, updatedReview);
      
      // Invalidate reviews list caches
      cacheHelpers.clearAll('reviews-');
      
      return updatedReview;
    } catch (error) {
      console.error('Review pin update error:', error);
      throw error;
    }
  }
};

// --------------------------------------
// NEWS SERVICE
// --------------------------------------

const newsService = {
  getNews: async (options = {}) => {
    try {
      const forceRefresh = options.forceRefresh || false;
      
      // Try to get from cache first, unless forceRefresh is true
      const cacheKey = 'news-data';
      const cachedData = cacheHelpers.get(cacheKey);
      
      if (!forceRefresh && cachedData) {
        console.log('Using cached news data');
        return cachedData;
      }
      
      console.log('Fetching fresh news data from server');
      
      const token = localStorage.getItem('token');
      const headers = token 
        ? { 'Authorization': `Bearer ${token}` } 
        : {};
      
      // Add cache busting parameter when forceRefresh is true
      const url = forceRefresh 
        ? `${config.API_URL}/news?_t=${Date.now()}` 
        : `${config.API_URL}/news`;
      
      const response = await fetch(url, {
        headers,
        cache: forceRefresh ? 'no-cache' : 'default'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch news');
      }
      
      const data = await response.json();
      
      // Store in cache (even if it was a forced refresh)
      cacheHelpers.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes cache
      
      return data;
    } catch (error) {
      console.error('Get news error:', error);
      throw error;
    }
  },

  likeNews: async (newsId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      console.log('Sending like request for news:', newsId);
      
      const response = await fetch(`${config.API_URL}/news/${newsId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to like news');
      }

      const result = await response.json();
      
      // Clear news cache
      cacheHelpers.clear('news-data');

      // Refresh activities after news like
      try {
        await refreshActivities();
      } catch (activityError) {
        console.error('Failed to refresh activities after news like:', activityError);
      }
      
      // Notify subscribers that news was liked
      if (window.eventBus) {
        window.eventBus.emit('news-updated', {
          newsId,
          action: 'like',
          timestamp: Date.now()
        });
      }

      console.log('Like result:', result);
      return result;
    } catch (error) {
      console.error('Like news error details:', error);
      throw error;
    }
  },

  /**
   * Vote on a poll option
   * @param {string} newsId - The ID of the news item with the poll
   * @param {number} optionIndex - The index of the option to vote for
   * @returns {Promise<Object>} The updated news item
   */
  votePoll: async (newsId, optionIndex) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${config.API_URL}/news/${newsId}/poll/vote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ optionIndex })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to vote on poll');
      }

      const updatedNews = await response.json();
      
      // Clear news cache
      cacheHelpers.clear('news-data');
      
      // Refresh activities after voting
      try {
        await refreshActivities();
      } catch (activityError) {
        console.error('Failed to refresh activities after poll vote:', activityError);
      }
      
      // Notify subscribers that news was updated
      if (window.eventBus) {
        window.eventBus.emit('news-updated', {
          newsId,
          action: 'poll-vote',
          timestamp: Date.now()
        });
      }

      return updatedNews;
    } catch (error) {
      console.error('Poll vote error:', error);
      throw error;
    }
  },

  /**
   * Update tags for a news item
   * @param {string} newsId - ID of the news item
   * @param {Array} tags - Array of tag objects
   */
  updateTags: async (newsId, tags) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      console.log('Sending direct tag update for news:', newsId);
      console.log('Tags being sent:', tags);

      const response = await fetch(`${config.API_URL}/news/${newsId}/tags`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tags })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update tags');
      }

      const updatedNews = await response.json();
      console.log('Tags update response:', updatedNews);
      
      // Clear news cache
      cacheHelpers.clear('news-data');
      
      // Dispatch refresh event
      const refreshEvent = new CustomEvent('content-updated');
      window.dispatchEvent(refreshEvent);
      
      return updatedNews;
    } catch (error) {
      console.error('Update tags error:', error);
      throw error;
    }
  },

  /**
   * Pin or unpin a news item (admin only)
   * @param {string} newsId - The ID of the news item
   * @param {boolean} isPinned - Whether to pin or unpin
   * @param {string} [label] - Optional label for the pinned content
   * @returns {Promise<Object>} The updated news item
   */
  updatePinStatus: async (newsId, isPinned, label = '') => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${config.API_URL}/news/${newsId}/pin`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isPinned, label })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update pin status');
      }

      const updatedNews = await response.json();
      
      // Clear news cache
      cacheHelpers.clear('news-data');
      
      return updatedNews;
    } catch (error) {
      console.error('Pin update error:', error);
      throw error;
    }
  },

  /**
   * Add a new news item
   * @param {FormData} formData - Form data containing news information and image
   * @returns {Promise<Object>} - The created news item
   */
  addNews: async (formData) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${config.API_URL}/news`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Don't set Content-Type header when using FormData
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create news item');
      }

      const data = await response.json();
      
      // Clear news cache
      cacheHelpers.clear('news-data');
      
      return data;
    } catch (error) {
      console.error('Add news error:', error);
      throw error;
    }
  },

  /**
   * Update an existing news item
   * @param {string} newsId - ID of the news to update
   * @param {FormData} formData - Form data containing updated news information
   * @returns {Promise<Object>} - The updated news item
   */
  updateNews: async (newsId, formData) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${config.API_URL}/news/${newsId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
          // Don't set Content-Type header when using FormData
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update news item');
      }

      const data = await response.json();
      
      // Clear news cache
      cacheHelpers.clear('news-data');
      
      return data;
    } catch (error) {
      console.error('Update news error:', error);
      throw error;
    }
  },

  /**
   * Delete a news item
   * @param {string} newsId - ID of the news to delete
   * @returns {Promise<Object>} - Success message
   */
  deleteNews: async (newsId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${config.API_URL}/news/${newsId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete news item');
      }

      // Clear news cache
      cacheHelpers.clear('news-data');
      
      // Dispatch a global event to notify all components
      console.log('Dispatching content-updated event after news deletion');
      const refreshEvent = new CustomEvent('content-updated', {
        detail: { type: 'news-deleted', id: newsId }
      });
      window.dispatchEvent(refreshEvent);
      
      return await response.json();
    } catch (error) {
      console.error('Delete news error:', error);
      throw error;
    }
  },

  /**
   * Toggle news visibility
   * @param {string} newsId - ID of the news
   * @param {boolean} visible - Whether the news should be visible
   * @returns {Promise<Object>} - The updated news item
   */
  toggleVisibility: async (newsId, visible) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${config.API_URL}/news/${newsId}/visibility`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ visible })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update visibility');
      }

      const data = await response.json();
      
      // Clear news cache
      cacheHelpers.clear('news-data');
      
      return data;
    } catch (error) {
      console.error('Toggle visibility error:', error);
      throw error;
    }
  },

  /**
 * Add tags to a news item using the dedicated endpoint
 * @param {string} newsId - The ID of the news item
 * @returns {Promise<Object>} The updated news item
 */
addTagsToNews: async (newsId) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    console.log('Adding tags to news item:', newsId);
    
    // Define default tags to add when this function is called
    const defaultTags = [
      { text: "Test Tag 1", color: "green" },
      { text: "Test Tag 2", color: "blue" },
      { text: "Beef Madness", color: "purple" }
    ];
    
    const response = await fetch(`${config.API_URL}/news/${newsId}/tags`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tags: defaultTags })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response:', errorText);
      throw new Error(`Failed to update tags: ${response.status}`);
    }

    const result = await response.json();
    console.log('Tags added successfully:', result.tags);
    
    // Clear cache to ensure we get fresh data
    cacheHelpers.clear('news-data');
    
    // Dispatch a refresh event
    const refreshEvent = new CustomEvent('content-updated');
    window.dispatchEvent(refreshEvent);
    
    return result;
  } catch (error) {
    console.error('Add tags error:', error);
    throw error;
  }
}
};

// --------------------------------------
// ACTIVITY SERVICE
// --------------------------------------

const activityService = {
  getActivities: async (filter = 'all', page = 1) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      // Try to get from cache first
      const cacheKey = `activities-${filter}-${page}`;
      const cachedData = cacheHelpers.get(cacheKey);
      if (cachedData) {
        console.log('Using cached activities data');
        return cachedData;
      }

      const response = await fetch(
        `${config.API_URL}/admin/activities?filter=${filter}&page=${page}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch activities');
      }

      const data = await response.json();
      
      // Store in cache
      cacheHelpers.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes cache
      
      return data;
    } catch (error) {
      console.error('Get activities error:', error);
      throw error;
    }
  },

  getUserActivity: async (userId, limit = 20) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      // Try cache first
      const cacheKey = `user-activities-${userId}-${limit}`;
      const cachedData = cacheHelpers.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const response = await fetch(
        `${config.API_URL}/admin/user/${userId}/activities?limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch user activities');
      }

      const data = await response.json();
      cacheHelpers.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes
      return data;
    } catch (error) {
      console.error('Get user activities error:', error);
      throw error;
    }
  },

  getUnreadActivities: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return { activities: [], count: 0 };

      // This data should almost never be cached since it needs to be fresh
      const response = await fetch(
        `${config.API_URL}/admin/activities/unread`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch unread activities');
      }

      return response.json();
    } catch (error) {
      console.error('Get unread activities error:', error);
      return { activities: [], count: 0 };
    }
  },

  logCommentActivity: async (review, comment, currentUser) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${config.API_URL}/admin/activities/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          review,
          comment,
          actor: currentUser
        })
      });

      if (!response.ok) {
        throw new Error('Failed to log comment activity');
      }

      // Clear activities cache to ensure fresh data
      cacheHelpers.clearAll('activities-');

      return response.json();
    } catch (error) {
      console.error('Log comment activity error:', error);
      throw error;
    }
  },

  logCommentLikeActivity: async (review, comment, currentUser) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${config.API_URL}/admin/activities/comment-like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          review,
          comment,
          actor: currentUser
        })
      });

      if (!response.ok) {
        throw new Error('Failed to log comment like activity');
      }

      // Clear activities cache to ensure fresh data
      cacheHelpers.clearAll('activities-');

      return response.json();
    } catch (error) {
      console.error('Log comment like activity error:', error);
      throw error;
    }
  },
  
  // Enhanced method to update comment information in cache when changes happen
  updateCommentCache: (reviewId, commentId, data) => {
    try {
      const commentCacheKey = `comment-${reviewId}-${commentId}`;
      const reviewCacheKey = `review-${reviewId}`;
      
      // Update comment specific cache
      if (data) {
        cacheHelpers.set(commentCacheKey, data);
      } else {
        cacheHelpers.clear(commentCacheKey);
      }
      
      // Invalidate the review cache to force refresh
      cacheHelpers.clear(reviewCacheKey);
      
      // Notify subscribers that comment data has changed
      if (window.eventBus) {
        window.eventBus.emit('comment-updated', {
          reviewId,
          commentId,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error updating comment cache:', error);
    }
  }
};

// --------------------------------------
// NOTIFICATION SERVICE
// --------------------------------------

const notificationService = {
  getUnreadCount: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return { count: 0 };

      const [notificationResponse, activityResponse] = await Promise.all([
        fetch(`${config.API_URL}/notifications/unread-count`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        activityService.getUnreadActivities()
      ]);

      const [notificationData, activityData] = await Promise.all([
        notificationResponse.ok ? notificationResponse.json() : { count: 0 },
        activityResponse
      ]);

      return {
        count: (notificationData.count || 0) + (activityData.count || 0),
        activities: activityData.activities || []
      };
    } catch (error) {
      console.error('Get unread count error:', error);
      return { count: 0, activities: [] };
    }
  },

  subscribeToNotifications: async (subscription) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${config.API_URL}/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscription)
      });

      if (!response.ok) {
        throw new Error('Failed to subscribe to notifications');
      }

      return response.json();
    } catch (error) {
      console.error('Notification subscription error:', error);
      throw error;
    }
  },

  markActivityRead: async (activityId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${config.API_URL}/activities/${activityId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to mark activity as read');
      }

      // Clear activities cache to refresh unread counts
      cacheHelpers.clearAll('activities-');

      return response.json();
    } catch (error) {
      console.error('Mark activity read error:', error);
      throw error;
    }
  }
};

// --------------------------------------
// ADMIN SERVICE
// --------------------------------------

const adminService = {
  getRecentActivity: async (limit = 50) => {
    try {
      const token = localStorage.getItem('token');
      
      // Try to get from cache first
      const cacheKey = `admin-recent-activities-${limit}`;
      const cachedData = cacheHelpers.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      const response = await fetch(`${config.API_URL}/admin/activities/recent?limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recent activity');
      }

      const data = await response.json();
      
      // Store in cache
      cacheHelpers.set(cacheKey, data, 2 * 60 * 1000); // 2 minutes cache (shorter for admin)
      
      return data;
    } catch (error) {
      console.error('Get recent activity error:', error);
      throw error;
    }
  },

  getUserActivities: async (userId, limit = 20) => {
    try {
      const token = localStorage.getItem('token');
      
      // Try to get from cache
      const cacheKey = `admin-user-activities-${userId}-${limit}`;
      const cachedData = cacheHelpers.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      const response = await fetch(`${config.API_URL}/admin/activities/user/${userId}?limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user activities');
      }

      const data = await response.json();
      
      // Store in cache
      cacheHelpers.set(cacheKey, data, 2 * 60 * 1000); // 2 minutes cache
      
      return data;
    } catch (error) {
      console.error('Get user activities error:', error);
      throw error;
    }
  },
  
  getStats: async () => {
    const token = localStorage.getItem('token');
    
    try {
      // Try to get from cache
      const cacheKey = 'admin-stats';
      const cachedData = cacheHelpers.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      const [statsResponse, activityResponse, reportCountsResponse] = await Promise.all([
        fetch(`${config.API_URL}/admin/stats`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        activityService.getActivities(),
        fetch(`${config.API_URL}/admin/report-counts`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
      ]);

      if (!statsResponse.ok) {
        throw new Error('Failed to fetch admin stats');
      }

      const stats = await statsResponse.json();
      const activities = await activityResponse;
      
      // Add report counts if available
      if (reportCountsResponse.ok) {
        const reportCounts = await reportCountsResponse.json();
        stats.reports = reportCounts.pending || 0;
        stats.totalReports = Object.values(reportCounts).reduce((sum, count) => sum + count, 0);
      }

      const combinedStats = {
        ...stats,
        recentActivities: activities
      };
      
      // Store in cache
      cacheHelpers.set(cacheKey, combinedStats, 5 * 60 * 1000); // 5 minutes cache
      
      return combinedStats;
    } catch (error) {
      console.error('Get admin stats error:', error);
      throw error;
    }
  },

  getActivityStats: async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Try to get from cache
      const cacheKey = 'admin-activity-stats';
      const cachedData = cacheHelpers.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      const response = await fetch(`${config.API_URL}/admin/activity-stats`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch activity stats');
      }

      const data = await response.json();
      
      // Store in cache
      cacheHelpers.set(cacheKey, data, 10 * 60 * 1000); // 10 minutes cache
      
      return data;
    } catch (error) {
      console.error('Get activity stats error:', error);
      throw error;
    }
  }
};

// --------------------------------------
// REPORT SERVICE
// --------------------------------------

const reportService = {
  /**
   * Create a new content report
   * @param {Object} reportData - Report data object
   * @param {string} reportData.contentType - Type of content ('review', 'comment', 'user')
   * @param {string} reportData.contentId - ID of the reported content
   * @param {string} reportData.reason - Reason for reporting
   * @param {string} [reportData.additionalInfo] - Additional information
   * @returns {Promise<Object>} Created report object
   */
  createReport: async (reportData) => {
    if (!reportData.contentType || !reportData.contentId || !reportData.reason) {
      throw new Error('Missing required report data');
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required to report content');
      }

      const response = await fetch(`${config.API_URL}/reports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit report');
      }

      return await response.json();
    } catch (error) {
      console.error('Error submitting report:', error);
      throw error;
    }
  },

  /**
   * Get reports (admin only)
   * @param {Object} options - Query options
   * @param {string} [options.filter='pending'] - Filter by status
   * @param {string} [options.type='all'] - Filter by content type
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=20] - Results per page
   * @returns {Promise<Object>} Reports with pagination
   */
  getReports: async (options = {}) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const queryParams = new URLSearchParams({
        filter: options.filter || 'pending',
        ...(options.type && options.type !== 'all' && { type: options.type }),
        page: options.page || 1,
        limit: options.limit || 20
      });

      const response = await fetch(`${config.API_URL}/admin/reports?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch reports');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching reports:', error);
      throw error;
    }
  },

  /**
   * Get report counts by status
   * @returns {Promise<Object>} Counts by status
   */
  getReportCounts: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${config.API_URL}/admin/report-counts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch report counts');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching report counts:', error);
      throw error;
    }
  },

  /**
   * Take action on a report
   * @param {string} reportId - ID of the report
   * @param {string} action - Action to take ('dismiss', 'reviewing', 'resolve')
   * @returns {Promise<Object>} Updated report
   */
  handleReportAction: async (reportId, action) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${config.API_URL}/admin/reports/${reportId}/action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process report');
      }

      return await response.json();
    } catch (error) {
      console.error('Error handling report action:', error);
      throw error;
    }
  }
};

// Create a global event listener for window focus events
// This will help components refresh when the window regains focus
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    console.log('Window focused, checking for updates...');
    
    // Check if any reviews were added while window was not focused
    try {
      const lastReviewTimestamp = parseInt(localStorage.getItem('reviewTimestamp') || '0');
      const now = Date.now();
      
      // If a review was added within the last 60 seconds, trigger refresh
      if (lastReviewTimestamp && (now - lastReviewTimestamp < 60000)) {
        console.log('Recent review detected on window focus, triggering refresh');
        
        // Clear review caches
        reviewService.clearCache();
        
        // Dispatch content-updated event
        const contentUpdatedEvent = new CustomEvent('content-updated', {
          detail: {
            type: 'review-added',
            timestamp: now
          }
        });
        window.dispatchEvent(contentUpdatedEvent);
      }
    } catch (error) {
      console.warn('Error checking for reviews on window focus:', error);
    }
  });
}

// --------------------------------------
// EXPORTS
// --------------------------------------

// Export everything
export { 
  ACTIVITY_TYPES,
  reviewService,
  authService,
  notificationService, 
  adminService,
  newsService,
  userService,
  reportService,
  activityService,
  getMediaUrl,
  handleApiResponse,
  getAuthHeaders,
  refreshActivities,
  cacheHelpers
};