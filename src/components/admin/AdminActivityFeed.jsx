import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { 
  ThumbsUp, 
  MessageCircle, 
  User, 
  Star, 
  Loader,
  ChevronDown,
  Filter,
  Eye,
  Image,
  Check,
  X,
  ExternalLink,
  Newspaper
} from 'lucide-react';
import config from '../../config';
import ReviewModal from '../review/ReviewModal';
import CommentModal from '../comment/CommentModal';
import NewsModal from './NewsModal';
import NewsViewModal from './NewsViewModal'; // Import the new NewsViewModal

const ACTIVITY_TYPES = {
  REVIEW_LIKE: 'review_like',
  COMMENT_LIKE: 'comment_like',
  REVIEW_COMMENT: 'review_comment',
  NEW_USER: 'new_user',
  NEW_REVIEW: 'new_review',
  NEWS_LIKE: 'news_like'
};

const AdminActivityFeed = ({ currentUser = null }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [selectedComment, setSelectedComment] = useState(null);
  const [selectedNews, setSelectedNews] = useState(null);
  const [showNewsEdit, setShowNewsEdit] = useState(false); // New state to determine if we're editing or viewing
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setActivities([]);
    setPage(1);
    setError(null);
    fetchActivities();
  }, [filter]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setShowFullscreen(false);
        setSelectedReview(null);
        setSelectedComment(null);
        setSelectedNews(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Listen for content-updated events
  useEffect(() => {
    console.log('Setting up content-updated event listener in AdminActivityFeed');
    
    // Create event handler for refresh events
    const handleContentUpdate = (event) => {
      console.log('AdminActivityFeed received content update event:', event);
      
      // Check if this is a deletion event
      if (event.detail && event.detail.type === 'news-deleted') {
        console.log('Handling news deletion event for ID:', event.detail.id);
        // Refresh activities to update the feed
        fetchActivities();
      }
    };
    
    // Listen for the custom refresh event
    window.addEventListener('content-updated', handleContentUpdate);
    
    // Clean up on unmount
    return () => {
      window.removeEventListener('content-updated', handleContentUpdate);
    };
  }, []);

  const fetchActivities = async (loadMore = false) => {
    try {
      const token = localStorage.getItem('token') || currentUser?.token;
      if (!token) {
        throw new Error('No authentication token found');
      }

      const currentPage = loadMore ? page + 1 : 1;
      setLoadingMore(loadMore);
      setLoading(!loadMore);
      setError(null);

      console.log('Fetching activities with token:', token.substring(0, 10) + '...');

      const response = await fetch(
        `${config.API_URL}/admin/activities?filter=${filter}&page=${currentPage}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to fetch activities: ${response.status}`);
      }

      if (!Array.isArray(data.activities)) {
        console.error('Invalid activities data:', data);
        throw new Error('Invalid response format from server');
      }
      
      const validatedActivities = data.activities
        .filter(Boolean)
        .map(activity => ({
          ...activity,
          actor: activity.actor || { displayName: 'Unknown User' },
          target: activity.target || {},
          subject: activity.subject || {},
          metadata: activity.metadata || {},
          type: Object.values(ACTIVITY_TYPES).includes(activity.type) ? activity.type : null
        }))
        .filter(activity => activity.type !== null);

      setActivities(prev => loadMore ? [...prev, ...validatedActivities] : validatedActivities);
      setHasMore(currentPage < (data.pagination?.pages || 1));
      setPage(currentPage);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setError(error.message);
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleActivityClick = async (activity) => {
    if (!activity) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const fetchReview = async (reviewId) => {
        if (!reviewId) throw new Error('No review ID provided');

        const response = await fetch(
          `${config.API_URL}/reviews/${reviewId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch review: ${response.status}`);
        }

        return response.json();
      };

      switch (activity.type) {
        case ACTIVITY_TYPES.COMMENT_LIKE:
        case ACTIVITY_TYPES.REVIEW_COMMENT: {
          let reviewId = activity.target?.reviewId || activity.metadata?.reviewId;

          if (!reviewId) {
            console.error('Missing review ID:', activity);
            return;
          }

          const reviewData = await fetchReview(reviewId);
          
          if (activity.type === ACTIVITY_TYPES.REVIEW_COMMENT) {
            console.log('Processing comment activity:', activity);
            
            const commentData = {
              _id: activity.target?.id,
              text: activity.target?.content,
              date: activity.date,
              userId: activity.actor?.userId,
              userDisplayName: activity.actor?.displayName,
              userImage: activity.actor?.profileImage,
              reviewId: reviewId,
              media: activity.target?.media,
              likes: activity.metadata?.likes || []
            };

            const reviewComment = reviewData.comments?.find(c => c._id === activity.target?.id);
            if (reviewComment) {
              Object.assign(commentData, {
                ...reviewComment,
                reviewId
              });
            }

            console.log('Final comment data:', commentData);
            setSelectedComment(commentData);
          } else if (activity.type === ACTIVITY_TYPES.COMMENT_LIKE) {
            const comment = reviewData.comments?.find(c => c._id === activity.target?.id);
            if (comment) {
              setSelectedComment({
                ...comment,
                reviewId: reviewId
              });
            }
          }
          break;
        }

        case ACTIVITY_TYPES.NEW_REVIEW:
        case ACTIVITY_TYPES.REVIEW_LIKE: {
          const reviewId = activity.target?.id || activity.target?.reviewId;
          
          if (!reviewId) {
            console.error('Missing review ID in target:', activity.target);
            return;
          }
          
          try {
            const reviewData = await fetchReview(reviewId);
            setSelectedReview(reviewData);
          } catch (error) {
            console.error('Error fetching review:', error);
          }
          break;
        }
        
        case ACTIVITY_TYPES.NEWS_LIKE: {
          const newsId = activity.target?.id;
          
          if (!newsId) {
            console.error('Missing news ID in target:', activity.target);
            return;
          }
          
          try {
            // Fetch the news article
            const response = await fetch(
              `${config.API_URL}/news/${newsId}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (!response.ok) {
              throw new Error(`Failed to fetch news: ${response.status}`);
            }

            const newsData = await response.json();
            setSelectedNews(newsData);
            setShowNewsEdit(false); // Show the view modal instead of edit modal
          } catch (error) {
            console.error('Error fetching news:', error);
          }
          break;
        }
      }
    } catch (error) {
      console.error('Error handling activity click:', error);
      setError('Failed to load activity details');
    }
  };
  
  const formatDate = (date) => {
    try {
      const now = new Date();
      const activityDate = new Date(date);
      
      if (isNaN(activityDate.getTime())) {
        console.warn('Invalid date:', date);
        return 'Invalid date';
      }

      const diffMinutes = Math.floor((now - activityDate) / (1000 * 60));

      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
      if (diffMinutes < 10080) return `${Math.floor(diffMinutes / 1440)}d ago`;
      return activityDate.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown date';
    }
  };

  const getMediaUrl = (media) => {
    try {
      if (!media || !media.url) {
        console.warn('Invalid media data:', media);
        return null;
      }
      
      let path = media.url;
      path = path.replace(/\/uploads\/uploads\//, '/uploads/');
      path = path.replace(/^\/api\//, '');
      
      if (!path.startsWith('/uploads/')) {
        path = `/uploads/${path}`;
      }
      
      path = path.replace(/\/\//g, '/');

      const baseUrl = config.API_URL.endsWith('/api/') 
        ? config.API_URL.slice(0, -5)
        : config.API_URL.endsWith('/api')
          ? config.API_URL.slice(0, -4)
          : config.API_URL;

      return `${baseUrl}${path}`;
    } catch (error) {
      console.error('Error generating media URL:', error);
      return null;
    }
  };

  const getActivityMessage = (activity) => {
    if (!activity || !activity.type || !activity.actor) {
      console.warn('Invalid activity data:', activity);
      return 'Unknown activity';
    }

    const { type, actor, target, subject } = activity;
    
    switch (type) {
      case ACTIVITY_TYPES.REVIEW_LIKE:
        return (
          <>
            <span className="font-semibold">{actor.displayName}</span>
            {' liked '}
            {subject?.displayName ? (
              <>
                <span className="font-semibold">{subject.displayName}'s review of </span>
                <span className="font-semibold">{target?.beefery}</span>
              </>
            ) : (
              <>a review</>
            )}
          </>
        );

      case ACTIVITY_TYPES.COMMENT_LIKE:
        return (
          <>
            <span className="font-semibold">{actor.displayName}</span>
            {' liked '}
            {subject?.displayName ? (
              <>
                <span className="font-semibold">{subject.displayName}'s comment</span>
                {target?.beefery && (
                  <>
                    {' on '}
                    <span className="font-semibold">{target.beefery}</span>
                    {' review'}
                  </>
                )}
              </>
            ) : (
              'a comment'
            )}
          </>
        );

      case ACTIVITY_TYPES.REVIEW_COMMENT:
        return (
          <>
            <span className="font-semibold">{actor.displayName}</span>
            {subject && subject.userId !== actor.userId ? (
              <>
                {' replied to '}
                <span className="font-semibold">{subject.displayName}'s comment</span>
              </>
            ) : (
              ' commented'
            )}
            {target?.beefery && (
              <>
                {' on '}
                <span className="font-semibold">{target.beefery}</span>
                {' review'}
              </>
            )}
          </>
        );

      case ACTIVITY_TYPES.NEW_USER:
        return (
          <>
            <span className="font-semibold">{actor.displayName}</span>
            {' joined North Shore Beefs'}
          </>
        );

      case ACTIVITY_TYPES.NEW_REVIEW:
        return (
          <>
            <span className="font-semibold">{actor.displayName}</span>
            {' reviewed '}
            <span className="font-semibold">{target?.beefery || 'a beefery'}</span>
            {activity.metadata?.rating !== undefined && 
              ` (${Number(activity.metadata.rating).toFixed(1)}/10)`}
          </>
        );
        
      case ACTIVITY_TYPES.NEWS_LIKE:
        return (
          <>
            <span className="font-semibold">{actor.displayName}</span>
            {' liked '}
            <span className="font-semibold">news article: {target?.title || 'News'}</span>
          </>
        );

      default:
        console.warn('Unknown activity type:', type);
        return 'Unknown activity';
    }
  };
  
  const renderActivityIcon = (type) => {
    switch (type) {
      case ACTIVITY_TYPES.REVIEW_LIKE:
      case ACTIVITY_TYPES.COMMENT_LIKE:
      case ACTIVITY_TYPES.NEWS_LIKE:
        return <ThumbsUp className="h-5 w-5 text-primary" />;
      case ACTIVITY_TYPES.REVIEW_COMMENT:
        return <MessageCircle className="h-5 w-5 text-primary" />;
      case ACTIVITY_TYPES.NEW_USER:
        return <User className="h-5 w-5 text-primary" />;
      case ACTIVITY_TYPES.NEW_REVIEW:
        return <Star className="h-5 w-5 text-primary" />;
      default:
        return null;
    }
  };
  
  const renderActivityContent = (activity) => {
    try {
      if (!activity?.target) return null;

      const hasMedia = activity.target.media?.url;
      const hasContent = activity.target.content;
      
      if (!hasMedia && !hasContent) return null;

      return (
        <div className="text-sm text-muted-foreground mt-1">
          {hasContent && (
            <div className="mb-2">"{activity.target.content}"</div>
          )}
          
          {hasMedia && (
            <div className="mt-2">
              <div className="relative group">
                <img
                  src={getMediaUrl(activity.target.media)}
                  alt={`Media from ${activity.actor?.displayName || 'user'}`}
                  className="max-h-48 rounded-lg object-contain bg-black/5 hover:bg-black/10 transition-colors cursor-pointer"
                  loading="lazy"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activity.target.media) {
                      setFullscreenMedia(activity.target.media);
                      setShowFullscreen(true);
                    }
                  }}
                  onError={(e) => {
                    console.error('Media load error:', {
                      src: e.target.src,
                      media: activity.target.media
                    });
                    e.target.style.display = 'none';
                  }}
                />
                
                <div className="absolute top-2 right-2 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const mediaUrl = getMediaUrl(activity.target.media);
                      if (mediaUrl) window.open(mediaUrl, '_blank');
                    }}
                    className="p-1 hover:bg-black/30 rounded-full"
                    title="Open image in new tab"
                  >
                    <ExternalLink className="h-4 w-4 text-white" />
                  </button>
                </div>

                {activity.target.media?.type?.includes('gif') && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded-md text-white text-xs">
                    GIF
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    } catch (error) {
      console.error('Error rendering activity content:', error);
      return null;
    }
  };
  
  const renderActivityItem = (activity) => {
    if (!activity?._id) return null;

    return (
      <div 
        key={activity._id}
        onClick={() => handleActivityClick(activity)}
        className="flex items-start space-x-4 p-4 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group"
      >
        <div className="flex-shrink-0">
          {renderActivityIcon(activity.type)}
        </div>
        <div className="flex-grow min-w-0">
          <div className="text-sm text-foreground">
            {getActivityMessage(activity)}
          </div>
          {renderActivityContent(activity)}
          <span className="text-xs text-muted-foreground">
            {formatDate(activity.date)}
          </span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Eye className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    );
  };

  const renderFilterDropdown = () => (
    <select
      value={filter}
      onChange={(e) => setFilter(e.target.value)}
      className="bg-secondary p-2 rounded-lg text-sm"
      aria-label="Filter activities"
    >
      <option value="all">All Activity</option>
      <option value="reviews">Reviews</option>
      <option value="likes">Likes</option>
      <option value="comments">Comments</option>
      <option value="users">Users</option>
      <option value="news">News</option>
    </select>
  );

  const renderLoadingState = () => (
    <div className="flex items-center justify-center p-8" role="status">
      <Loader className="h-6 w-6 animate-spin text-primary" />
      <span className="sr-only">Loading activities...</span>
    </div>
  );

  const renderEmptyState = () => (
    <div className="text-center text-muted-foreground p-8" role="status">
      {filter === 'all' 
        ? 'No recent activity' 
        : `No ${filter.slice(0, -1)} activity`}
    </div>
  );

  const renderError = () => {
    if (!error) return null;
    
    return (
      <div className="p-4 text-center text-red-500 bg-red-100 rounded-lg">
        <p className="mb-2">{error}</p>
        <div className="text-xs text-gray-500 mb-2">
          API URL: {config.API_URL}
          {currentUser?.role && ` | Role: ${currentUser.role}`}
        </div>
        <button
          onClick={() => {
            setError(null);
            fetchActivities();
          }}
          className="text-sm text-primary hover:text-primary/80"
        >
          Try Again
        </button>
      </div>
    );
  };

  const renderLoadMoreButton = () => {
    if (!hasMore) return null;

    return (
      <button
        onClick={() => fetchActivities(true)}
        disabled={loadingMore}
        className="w-full p-4 text-center text-primary hover:bg-secondary transition-colors disabled:opacity-50"
      >
        {loadingMore ? (
          <Loader className="h-5 w-5 animate-spin mx-auto" />
        ) : (
          'Load More'
        )}
      </button>
    );
  };

  const renderFullscreenMedia = () => {
    if (!showFullscreen || !fullscreenMedia) return null;

    return (
      <div 
        className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center cursor-pointer"
        onClick={() => setShowFullscreen(false)}
      >
        <div className="relative max-w-[90vw] max-h-[90vh]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFullscreen(false);
            }}
            className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors p-2 z-50"
          >
            <X className="h-8 w-8" />
          </button>
          
          <img
            src={getMediaUrl(fullscreenMedia)}
            alt="Fullscreen media"
            className="max-w-full max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              console.error('Fullscreen media load error:', e);
              setShowFullscreen(false);
            }}
          />
        </div>
      </div>
    );
  };

  const renderModals = () => (
    <>
      {selectedReview && (
        <ReviewModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
          currentUser={currentUser}
          isAdmin={true}
        />
      )}

      {selectedComment && (
        <CommentModal
          comment={selectedComment}
          currentUser={currentUser}
          onClose={() => setSelectedComment(null)}
          isAdmin={true}
        />
      )}
    </>
  );

  return (
    <div className="space-y-4" role="feed" aria-label="Activity Feed">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        {renderFilterDropdown()}
      </div>

      {renderError()}

      <div className="space-y-4">
        {loading ? (
          renderLoadingState()
        ) : activities.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            {activities.map(activity => renderActivityItem(activity))}
            {renderLoadMoreButton()}
          </>
        )}
      </div>

      {/* Modals */}
      {renderModals()}
      {renderFullscreenMedia()}
      
      {/* Use the appropriate modal based on view/edit mode */}
      {selectedNews && !showNewsEdit && (
        <NewsViewModal
          news={selectedNews}
          onClose={() => setSelectedNews(null)}
          currentUser={currentUser}
        />
      )}
      
      {selectedNews && showNewsEdit && (
        <NewsModal
          news={selectedNews}
          onClose={() => setSelectedNews(null)}
          onSubmit={(formData) => {
            // You could implement actual update functionality here
            console.log('Would update news with:', formData);
            setSelectedNews(null);
            // Refresh activities to show updated content
            fetchActivities();
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

AdminActivityFeed.propTypes = {
  currentUser: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.string.isRequired,
    profileImage: PropTypes.string,
    token: PropTypes.string
  }).isRequired
};

export default AdminActivityFeed;