import React, { useState } from 'react';
import { X, ThumbsUp, Check, ExternalLink, Flag, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import ProfileImage from '../user/ProfileImage';
import ReportModal from '../report/ReportModal';
import { getMediaUrl, isVideo, isGif } from '../../utils/MediaUtils';
import config from '../../config';
import PropTypes from 'prop-types';

const CommentModal = ({ comment, onClose, currentUser, isAdmin = false }) => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [error, setError] = useState(null);

  if (!comment) return null;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Use the consistent media URL function from MediaUtils
  const getCommentMediaUrl = (media) => {
    return getMediaUrl(media, 'comment');
  };

  const handleReportSubmitted = () => {
    setShowReportModal(false);
    // You might want to show a success message here
  };

  const renderReportButton = () => {
    // Don't show report button if in admin context
    if (isAdmin) return null;
    
    // Don't show report button if the user is not logged in or is the author of the comment
    const userId = typeof comment.userId === 'string' ? comment.userId : 
                  (typeof comment.userId === 'object' ? 
                    (comment.userId.id || comment.userId._id || '') : '');
                    
    if (!currentUser || currentUser._id === userId) return null;
    
    return (
      <button
        onClick={() => setShowReportModal(true)}
        className="p-2 text-muted-foreground hover:bg-red-50 rounded-lg transition-colors"
        title="Report Comment"
      >
        <Flag className="h-5 w-5" />
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <Card className="w-full max-w-lg bg-card p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-full transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Header with actions */}
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-foreground">Comment Details</h2>
          <div className="flex space-x-2">
            {renderReportButton()}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {/* Comment content */}
        <div className="divide-y divide-border">
          <div className="pb-4">
            <div className="flex items-start space-x-4">
              <ProfileImage
                user={{
                  _id: typeof comment.userId === 'string' ? comment.userId : 
                       (typeof comment.userId === 'object' ? 
                        (comment.userId.id || comment.userId._id || '') : ''),
                  displayName: comment.userDisplayName || 'Unknown',
                  profileImage: comment.userImage
                }}
                size="lg"
              />
              <div>
                <h3 className="text-lg font-semibold text-foreground">{comment.userDisplayName}</h3>
                <p className="text-sm text-muted-foreground">{formatDate(comment.date)}</p>
                {comment.beefery && (
                  <p className="text-xs text-muted-foreground mt-1">
                    On review: {comment.beefery}
                  </p>
                )}
              </div>
            </div>
            
            {/* Comment text */}
            {comment.text && (
              <div className="mt-4 text-foreground whitespace-pre-line break-words">
                {comment.text}
              </div>
            )}

            {/* Comment media */}
            {comment.media && (
              <div className="mt-4">
                <div className="relative group">
                  <img
                    src={getCommentMediaUrl(comment.media)}
                    alt="Comment media"
                    className="max-h-60 rounded-lg object-contain bg-black/5 hover:bg-black/10 transition-colors cursor-pointer"
                    key={comment.media.url || comment.media.original || Math.random()} // Ensure GIFs play properly
                    loading="lazy"
                    onError={(e) => {
                      console.error('Media load error:', {
                        media: comment.media,
                        url: e.target.src
                      });
                      e.target.style.display = 'none';
                    }}
                  />
                  <button
                    onClick={() => window.open(getCommentMediaUrl(comment.media), '_blank')}
                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Open image in new tab"
                  >
                    <ExternalLink className="h-4 w-4 text-white" />
                  </button>

                  {isGif(comment.media) && (
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded-md text-white text-xs">
                      GIF
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Likes section */}
          <div className="pt-4">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              comment.likes?.some(like => {
                if (typeof like === 'object')
                  return like._id === currentUser?._id;
                return like === currentUser?._id;
              })
                ? 'bg-emerald-100/10 text-emerald-600'
                : 'text-muted-foreground'
            }`}>
              {comment.likes?.some(like => {
                if (typeof like === 'object')
                  return like._id === currentUser?._id;
                return like === currentUser?._id;
              }) ? (
                <Check className="h-4 w-4 stroke-[3]" />
              ) : (
                <ThumbsUp className="h-4 w-4" />
              )}
              <span>
                {currentUser && comment.likes?.some(like => {
                  if (typeof like === 'object')
                    return like._id === currentUser._id;
                  return like === currentUser._id;
                })
                  ? comment.likes.length > 1
                    ? `You and ${comment.likes.length - 1} other${comment.likes.length > 2 ? 's' : ''}`
                    : 'You like this'
                  : `${comment.likes?.length || 0} like${comment.likes?.length !== 1 ? 's' : ''}`}
              </span>
            </div>  
          </div>
        </div>

        {/* Report Modal */}
        {showReportModal && (
          <ReportModal
            contentType="comment"
            contentId={comment._id}
            onClose={() => setShowReportModal(false)}
            onReportSubmitted={handleReportSubmitted}
          />
        )}
      </Card>
    </div>
  );
};

CommentModal.propTypes = {
    comment: PropTypes.shape({
      _id: PropTypes.string.isRequired,
      text: PropTypes.string,
      userId: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
      userDisplayName: PropTypes.string.isRequired,
      userImage: PropTypes.string,
      date: PropTypes.string.isRequired,
      media: PropTypes.shape({
        url: PropTypes.string,
        original: PropTypes.string,
        type: PropTypes.string
      }),
      likes: PropTypes.array,
      beefery: PropTypes.string, // Added for context
      reviewId: PropTypes.string // Added for context
    }),
    onClose: PropTypes.func.isRequired,
    currentUser: PropTypes.object,
    isAdmin: PropTypes.bool
  };

export default CommentModal;