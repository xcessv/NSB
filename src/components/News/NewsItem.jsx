import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  ThumbsUp,
  MessageCircle,
  Calendar,
  Check,
  Loader,
  ExternalLink,
  Pin,
  Tag,
  Newspaper,
  BarChart2
} from 'lucide-react';
import { getMediaUrl } from '../../utils/MediaUtils';
import LikesListModal from '../likes/LikesListModal';
import NewsMedia from '../screens/NewsMedia';
import ProfileImage from '../user/ProfileImage';
import PollDisplay from './PollDisplay';
import { toast } from '../../utils/toast';

const NewsItem = ({ 
  item, 
  currentUser = null, 
  onLike = () => {},
  onVotePoll = () => {},
  onRefreshContent = () => {},
  isPinned = false
}) => {
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  
  // Debug logging for incoming item - with error handling
  const logItemData = () => {
    try {
      console.log('News item data:', {
        id: item?._id,
        title: item?.title,
        hasTags: Boolean(item?.tags && item.tags.length),
        tagsCount: item?.tags?.length || 0,
        isPinned: item?.pinned?.isPinned || false
      });
    } catch (err) {
      console.error('Error logging news item data:', err);
    }
  };
  
  // Log item data once
  React.useEffect(() => {
    logItemData();
  }, [item]);

  const formatDate = (date) => {
    try {
      return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      });
    } catch (err) {
      console.error('Error formatting date:', err);
      return 'Invalid date';
    }
  };

  // Safely check if the user has liked this news item
  const hasUserLiked = useMemo(() => {
    try {
      if (!currentUser || !item) return false;
      if (!Array.isArray(item.likes) || !item.likes.length) return false;
      
      return item.likes.some(like => 
        typeof like === 'object' 
          ? like._id === currentUser._id 
          : like === currentUser._id
      );
    } catch (err) {
      console.error('Error checking user like status:', err);
      return false;
    }
  }, [currentUser, item]);

  // Handle likes with improved error handling
  const handleLike = async () => {
    // If user isn't logged in, show a notification
    if (!currentUser) {
      toast({
        title: "Login Required",
        description: "You need to be logged in to like content.",
        type: "warning"
      });
      return;
    }
    
    if (likeLoading) return;
    
    try {
      setLikeLoading(true);
      await onLike(item._id);
    } catch (err) {
      console.error('Error liking news item:', err);
      toast({
        title: "Error",
        description: "Failed to like this content. Please try again.",
        type: "error"
      });
    } finally {
      setLikeLoading(false);
    }
  };

  // Format like text similar to comments
  const getLikeText = () => {
    try {
      if (!currentUser || !Array.isArray(item.likes) || !item.likes.length) return null;
      
      if (hasUserLiked) {
        if (item.likes.length === 1) {
          return 'You like this';
        } else if (item.likes.length === 2) {
          return 'You and 1 other';
        } else {
          return `You and ${item.likes.length - 1} others`;
        }
      }
      
      return null;
    } catch (err) {
      console.error('Error generating like text:', err);
      return null;
    }
  };

  // Prepare likes for the modal with error handling
  const getFormattedLikes = () => {
    try {
      if (!Array.isArray(item.likes) || !item.likes.length) return [];
      
      // Convert simple ID array to object array for LikesListModal
      return item.likes.map(like => {
        if (typeof like === 'object' && like !== null) return like;
        
        // For ID strings, create minimal user object
        // If it's the current user's ID, use their info
        if (currentUser && like === currentUser._id) {
          return {
            _id: currentUser._id,
            displayName: currentUser.displayName,
            profileImage: currentUser.profileImage,
            role: currentUser.role
          };
        }
        
        // Otherwise return a placeholder
        return { _id: like, displayName: 'User' };
      });
    } catch (err) {
      console.error('Error formatting likes data:', err);
      return [];
    }
  };

  // Get tag color class for rendering with error handling
  const getTagColorClass = (color) => {
    try {
      switch (color) {
        case 'red': return 'bg-red-100 text-red-800';
        case 'green': return 'bg-green-100 text-green-800';
        case 'blue': return 'bg-blue-100 text-blue-800';
        case 'yellow': return 'bg-yellow-100 text-yellow-800';
        case 'purple': return 'bg-purple-100 text-purple-800';
        case 'pink': return 'bg-pink-100 text-pink-800';
        case 'orange': return 'bg-orange-100 text-orange-800';
        case 'cyan': return 'bg-cyan-100 text-cyan-800';
        case 'amber': return 'bg-amber-100 text-amber-800';
        case 'gray': return 'bg-gray-100 text-gray-800';
        default: return 'bg-primary/10 text-primary';
      }
    } catch (err) {
      console.error('Error getting tag color class:', err);
      return 'bg-gray-100 text-gray-800'; // Safe fallback
    }
  };

  // Check for user role to show badge
  const UserBadge = ({ user }) => {
    try {
      if (!user || !user.role) return null;

      let badgeText = '';
      let badgeColor = '';

      switch (user.role) {
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
        default:
          badgeText = user.role;
          badgeColor = 'bg-gray-500 text-white';
      }

      return (
        <span className={`inline-block ml-1 px-2 py-0.5 rounded-full text-xs ${badgeColor}`}>
          {badgeText}
        </span>
      );
    } catch (err) {
      console.error('Error rendering user badge:', err);
      return null;
    }
  };

  // Normalize tags to ensure they're in the correct format - with error handling
  const normalizedTags = useMemo(() => {
    try {
      console.log('Processing tags for news:', item._id, 'tags:', item.tags);
      
      // Handle different tag formats or create default tags if needed
      if (!item.tags) return [];
      
      // Check if tags is a string (might be serialized JSON)
      if (typeof item.tags === 'string') {
        try {
          return JSON.parse(item.tags);
        } catch (e) {
          console.error('Failed to parse tags string:', e);
          // If it's a comma-separated string, convert to tag objects
          if (item.tags.includes(',')) {
            return item.tags.split(',').map(tag => ({
              text: tag.trim(),
              color: 'primary'
            }));
          }
          // Single tag as string
          return [{text: item.tags.trim(), color: 'primary'}];
        }
      }
      
      // Already an array
      if (Array.isArray(item.tags)) {
        return item.tags.map(tag => {
          // Ensure each tag has the required properties
          if (typeof tag === 'string') {
            return { text: tag, color: 'primary' };
          }
          // Object with at least a text property
          if (typeof tag === 'object' && tag !== null) {
            return { 
              text: tag.text || tag.name || 'Tag', 
              color: tag.color || 'primary',
              icon: tag.icon || false
            };
          }
          return null;
        }).filter(Boolean); // Remove any null values
      }
      
      return [];
    } catch (error) {
      console.error('Error processing tags:', error);
      return []; // Return empty array on error as fallback
    }
  }, [item.tags]);

  // Safely check if a poll exists
  const hasPoll = useMemo(() => {
  try {
    // More robust poll detection that handles various data structures
    if (!item || !item.poll) return false;
    
    // Check for required poll properties
    const hasQuestion = Boolean(item.poll.question);
    const hasOptions = Array.isArray(item.poll.options) && item.poll.options.length >= 2;
    
    // Print debug info to help diagnose issue
    console.log(`Poll check for news ${item._id}:`, {
      hasQuestion,
      hasOptions,
      pollData: item.poll
    });
    
    return hasQuestion && hasOptions;
  } catch (err) {
    console.error('Error checking poll existence:', err);
    return false;
  }
}, [item]);

const renderTags = () => {
  try {
    // Debug logging
    console.log('Rendering tags for news:', item._id, 'tags:', item.tags);
    
    // Early return if no tags
    if (!item.tags || (Array.isArray(item.tags) && item.tags.length === 0)) {
      return null;
    }
    
    // Process tags based on their format
    let processedTags = [];
    
    // If tags is a string that looks like JSON, parse it
    if (typeof item.tags === 'string') {
      try {
        if (item.tags.startsWith('[') && item.tags.endsWith(']')) {
          processedTags = JSON.parse(item.tags);
        } else if (item.tags.includes(',')) {
          // Handle comma-separated tags
          processedTags = item.tags.split(',').map(tag => ({
            text: tag.trim(),
            color: 'primary'
          }));
        } else {
          // Single tag as string
          processedTags = [{ text: item.tags.trim(), color: 'primary' }];
        }
      } catch (e) {
        console.error('Error parsing tags string:', e);
        processedTags = [{ text: item.tags, color: 'primary' }];
      }
    } 
    // If tags is already an array
    else if (Array.isArray(item.tags)) {
      processedTags = item.tags.map(tag => {
        if (typeof tag === 'string') {
          return { text: tag, color: 'primary' };
        }
        if (typeof tag === 'object' && tag !== null) {
          return {
            text: tag.text || tag.name || 'Tag',
            color: tag.color || 'primary'
          };
        }
        return null;
      }).filter(Boolean);
    }
    
    console.log('Processed tags:', processedTags);
    
    // Return the rendered tags
    return (
      <>
        {processedTags.map((tag, index) => (
          <span
            key={index}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagColorClass(tag.color)}`}
          >
            <Tag className="h-3 w-3 mr-1" />
            {tag.text}
          </span>
        ))}
      </>
    );
  } catch (error) {
    console.error('Error rendering tags:', error);
    return null;
  }
};

  // Safely render pinned status
  const renderPinnedStatus = () => {
    try {
      // Skip if this is already in a pinned container
      if (isPinned) return null;
      
      // More robust check for pinned status
      const isPinnedItem = 
        // Object format with isPinned property set to true
        (item.pinned && typeof item.pinned === 'object' && item.pinned.isPinned === true) ||
        // Direct boolean value
        (item.pinned === true) ||
        // String value 'true'
        (item.pinned === 'true');
      
      if (!isPinnedItem) return null;
      
      return (
        <div className="flex items-center mb-2 text-primary">
          <Pin className="h-4 w-4 mr-1" />
          <span className="text-sm font-medium">
            {typeof item.pinned === 'object' && item.pinned.label 
              ? item.pinned.label 
              : 'Pinned Post'}
          </span>
        </div>
      );
    } catch (error) {
      console.error('Error rendering pinned status:', error);
      return null;
    }
  };

  // Safely get image URL
  const getItemImageUrl = () => {
    try {
      if (!item.imageUrl) return null;
      return getMediaUrl(item.imageUrl, 'news');
    } catch (err) {
      console.error('Error getting image URL:', err);
      return null;
    }
  };

  // If item is missing critical data, render a fallback
  if (!item || !item._id || !item.title) {
    console.error('Invalid news item data:', item);
    return (
      <div className="p-4 border border-red-200 rounded-lg text-red-500 text-sm">
        Invalid news item data
      </div>
    );
  }

  return (
    <div className={`bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow ${
      item.pinned?.isPinned && !isPinned ? 'ring-2 ring-primary/30' : ''
    }`}>
      <div className="p-6">
        {/* Pinned indicator */}
        {renderPinnedStatus()}

        {/* Tags and News badge in a single row */}
        <div className="flex flex-wrap gap-2 mb-4">
  {/* Always show the News badge */}
  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-white">
    <Newspaper className="w-3 h-3 mr-1" />
    News
  </span>
  
  {/* Show custom tags using our renderTags function */}
  {renderTags()}
</div>

        {/* News image */}
        {item.imageUrl && (
          <NewsMedia 
            imageUrl={item.imageUrl}
            title={item.title}
            className="w-full h-48 mb-4"
          />
        )}

        {/* Content area */}
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-foreground">
            {item.title}
          </h3>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <ProfileImage
                user={{
                  _id: typeof item.author === 'object' ? 
                       (item.author.userId || item.author._id || '') : '',
                  displayName: item.author?.displayName || 'Unknown',
                  profileImage: item.author?.profileImage,
                  role: item.author?.role
                }}
                size="sm"
              />
              <span className="ml-2">
                {item.author?.displayName}
                <UserBadge user={item.author} />
              </span>
            </div>
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              {formatDate(item.date)}
            </div>
          </div>
        </div>

        <p className="mt-4 text-muted-foreground whitespace-pre-line emoji-font">
          {item.content}
        </p>

        {/* Poll indicator if there is one */}
        {hasPoll && (
          <div className="mt-2 mb-2 px-3 py-1 bg-purple-100 text-purple-800 text-sm inline-flex items-center rounded-md">
            <BarChart2 className="h-4 w-4 mr-1" />
            {item.poll.active ? 'Active Poll' : 'Closed Poll'}
          </div>
        )}

        {/* Add Poll Display Component */}
        {hasPoll && (
          <PollDisplay 
            poll={item.poll}
            newsId={item._id}
            currentUser={currentUser}
            onVote={(optionIndex) => onVotePoll(item._id, optionIndex)}
          />
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleLike}
              disabled={likeLoading}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                hasUserLiked 
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:bg-secondary'
              }`}
              title={currentUser ? 'Like this news' : 'Login to like news'}
            >
              {likeLoading ? (
                <Loader className="h-5 w-5 animate-spin" />
              ) : hasUserLiked ? (
                <Check className="h-5 w-5" />
              ) : (
                <ThumbsUp className="h-5 w-5" />
              )}
              <span>{item.likes?.length || 0}</span>
            </button>
            
            {/* Likes text display */}
            {Array.isArray(item.likes) && item.likes.length > 0 && (
              <button
                onClick={() => setShowLikesModal(true)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {getLikeText() || `${item.likes.length} likes`}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* LikesListModal for showing who liked the news */}
      {showLikesModal && (
        <LikesListModal
          likes={getFormattedLikes()}
          onClose={() => setShowLikesModal(false)}
          title="News Likes"
        />
      )}
    </div>
  );
};

NewsItem.propTypes = {
  item: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    date: PropTypes.string.isRequired,
    imageUrl: PropTypes.string,
    processedImageUrl: PropTypes.string,
    author: PropTypes.shape({
      userId: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.object
      ]),
      displayName: PropTypes.string,
      profileImage: PropTypes.string,
      role: PropTypes.string
    }),
    likes: PropTypes.arrayOf(PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object
    ])),
    poll: PropTypes.object,
    tags: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.array
    ]),
    pinned: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.shape({
        isPinned: PropTypes.bool,
        label: PropTypes.string
      })
    ])
  }).isRequired,
  currentUser: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    profileImage: PropTypes.string,
    role: PropTypes.string
  }),
  onLike: PropTypes.func,
  onVotePoll: PropTypes.func,
  onRefreshContent: PropTypes.func,
  isPinned: PropTypes.bool
};

export default NewsItem;