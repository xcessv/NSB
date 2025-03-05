import React, { useState } from 'react';
import { 
  X, 
  ThumbsUp, 
  Calendar, 
  User, 
  ExternalLink,
  Tag,
  Pin,
  BarChart2,
  Newspaper
} from 'lucide-react';
import { Card } from '../ui/card';
import ProfileImage from '../user/ProfileImage';
import PollDisplay from '../news/PollDisplay';
import LikesListModal from '../likes/LikesListModal';
import { getMediaUrl } from '../../utils/MediaUtils';

const NewsViewModal = ({ news, onClose, currentUser }) => {
  const [showLikesModal, setShowLikesModal] = useState(false);

  if (!news) return null;

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

  // Get tag color class for rendering
  const getTagColorClass = (color) => {
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
  };

  // Process tags for display
  const processTags = () => {
    try {
      if (!news.tags || (Array.isArray(news.tags) && news.tags.length === 0)) {
        return [];
      }
      
      // If tags is a string that looks like JSON, parse it
      if (typeof news.tags === 'string') {
        try {
          if (news.tags.startsWith('[') && news.tags.endsWith(']')) {
            return JSON.parse(news.tags);
          } else if (news.tags.includes(',')) {
            // Handle comma-separated tags
            return news.tags.split(',').map(tag => ({
              text: tag.trim(),
              color: 'primary'
            }));
          } else {
            // Single tag as string
            return [{ text: news.tags.trim(), color: 'primary' }];
          }
        } catch (e) {
          console.error('Error parsing tags string:', e);
          return [{ text: news.tags, color: 'primary' }];
        }
      } 
      // If tags is already an array
      else if (Array.isArray(news.tags)) {
        return news.tags.map(tag => {
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
      
      return [];
    } catch (error) {
      console.error('Error processing tags:', error);
      return [];
    }
  };

  // Check if a poll exists and is valid
  const hasPoll = () => {
    try {
      if (!news || !news.poll) return false;
      
      // Check for required poll properties
      const hasQuestion = Boolean(news.poll.question);
      const hasOptions = Array.isArray(news.poll.options) && news.poll.options.length >= 2;
      
      return hasQuestion && hasOptions;
    } catch (err) {
      console.error('Error checking poll existence:', err);
      return false;
    }
  };

  // Get likes in the format needed for LikesListModal
  const getFormattedLikes = () => {
    try {
      if (!Array.isArray(news.likes) || !news.likes.length) return [];
      
      // Convert simple ID array to object array for LikesListModal
      return news.likes.map(like => {
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

  // Get image URL
  const getNewsImageUrl = (imageUrl) => {
    try {
      if (!imageUrl) return null;
      return getMediaUrl(imageUrl, 'news');
    } catch (err) {
      console.error('Error getting image URL:', err);
      return null;
    }
  };

  // Check if news has pinned status
  const isPinned = () => {
    try {
      return (
        (news.pinned && typeof news.pinned === 'object' && news.pinned.isPinned === true) ||
        (news.pinned === true) ||
        (news.pinned === 'true')
      );
    } catch (error) {
      console.error('Error checking pinned status:', error);
      return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-2xl bg-card shadow-xl rounded-2xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              View News
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-full transition-colors"
            >
              <X className="h-6 w-6 text-muted-foreground" />
            </button>
          </div>

          {/* News Content */}
          <div className="space-y-4">
            {/* Tags and News badge */}
            <div className="flex flex-wrap gap-2 mb-2">
              {/* News badge */}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-white">
                <Newspaper className="w-3 h-3 mr-1" />
                News
              </span>
              
              {/* Pinned status if applicable */}
              {isPinned() && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <Pin className="w-3 h-3 mr-1" />
                  {typeof news.pinned === 'object' && news.pinned.label 
                    ? news.pinned.label 
                    : 'Pinned'}
                </span>
              )}
              
              {/* Poll badge if applicable */}
              {hasPoll() && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  <BarChart2 className="w-3 h-3 mr-1" />
                  {news.poll.active ? 'Active Poll' : 'Closed Poll'}
                </span>
              )}
              
              {/* Custom tags */}
              {processTags().map((tag, index) => (
                <span
                  key={index}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagColorClass(tag.color)}`}
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {tag.text}
                </span>
              ))}
            </div>
            
            {/* News Title */}
            <h3 className="text-xl font-bold text-foreground">
              {news.title}
            </h3>
            
            {/* Author and Date */}
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <ProfileImage
                  user={{
                    _id: typeof news.author === 'object' ? 
                         (news.author.userId || news.author._id || '') : '',
                    displayName: news.author?.displayName || 'Unknown',
                    profileImage: news.author?.profileImage,
                    role: news.author?.role
                  }}
                  size="sm"
                />
                <span className="ml-2">
                  {news.author?.displayName || 'Unknown Author'}
                  {/* Author role badge */}
                  {news.author?.role && news.author.role !== 'user' && (
                    <span className={`inline-block ml-1 px-2 py-0.5 rounded-full text-xs ${
                      news.author.role === 'admin' ? 'bg-red-500 text-white' :
                      news.author.role === 'moderator' ? 'bg-green-500 text-white' :
                      news.author.role === 'mvb' ? 'bg-purple-500 text-white' :
                      'bg-gray-500 text-white'
                    }`}>
                      {news.author.role === 'admin' ? 'Admin' :
                       news.author.role === 'moderator' ? 'Mod' :
                       news.author.role === 'mvb' ? 'MVB' :
                       news.author.role}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {formatDate(news.date)}
              </div>
            </div>
            
            {/* News Image if available */}
            {news.imageUrl && (
              <div className="mt-4">
                <img
                  src={getNewsImageUrl(news.imageUrl)}
                  alt={news.title}
                  className="w-full max-h-80 object-cover rounded-lg"
                  onError={(e) => {
                    console.error('Image load error:', e.target.src);
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
            
            {/* News Content */}
            <div className="mt-4">
              <p className="text-muted-foreground whitespace-pre-line emoji-font">
                {news.content}
              </p>
            </div>
            
            {/* Poll if available */}
            {hasPoll() && (
              <div className="mt-4 bg-secondary/30 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Poll: {news.poll.question}</h4>
                <PollDisplay 
                  poll={news.poll}
                  newsId={news._id}
                  currentUser={currentUser}
                  readOnly={true}
                />
              </div>
            )}
            
            {/* Likes */}
            <div className="mt-4 flex items-center space-x-2">
              <div className="flex items-center">
                <ThumbsUp className="h-5 w-5 text-primary mr-2" />
                <span>{news.likes?.length || 0} likes</span>
              </div>
              
              {Array.isArray(news.likes) && news.likes.length > 0 && (
                <button
                  onClick={() => setShowLikesModal(true)}
                  className="text-sm text-primary hover:underline"
                >
                  View
                </button>
              )}
            </div>
            
            {/* Admin Details */}
            {currentUser?.role === 'admin' && (
              <div className="mt-4 pt-4 border-t border-border">
                <h4 className="text-sm font-medium text-foreground mb-2">Admin Details</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>ID: {news._id}</p>
                  <p>Visibility: {news.visible ? 'Published' : 'Hidden'}</p>
                  <p>Created: {formatDate(news.date)}</p>
                  {news.lastUpdated && (
                    <p>Last Updated: {formatDate(news.lastUpdated)}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
      
      {/* Likes List Modal */}
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

export default NewsViewModal;