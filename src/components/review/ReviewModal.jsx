import React, { useState } from 'react';
import { X, ThumbsUp, AlertTriangle, Flag, Star, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import ReportModal from '../report/ReportModal';
import LikesListModal from '../likes/LikesListModal';
import { getMediaUrl, isVideo, isGif } from '../../utils/MediaUtils';
import config from '../../config';

const ReviewModal = ({ review, onClose, currentUser, readOnly = false, isAdmin = false }) => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [error, setError] = useState(null);
  const [mediaView, setMediaView] = useState('normal'); // 'normal', 'fullscreen'

  if (!review) return null;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Improved media URL handling based on TopScreen implementation
  const getProcessedMediaUrl = (mediaObj) => {
    if (!mediaObj) return null;
    
    try {
      // Handle both string and object formats for media
      if (typeof mediaObj === 'string') {
        // Convert string media path to the expected object format
        return getMediaUrl(mediaObj, 'review');
      } else if (mediaObj.processedUrl) {
        // Already processed
        return mediaObj.processedUrl;
      } else if (mediaObj.url) {
        return getMediaUrl(mediaObj, 'review');
      } else if (mediaObj.original) {
        // Process using original path
        return getMediaUrl(mediaObj, 'review');
      }
      
      // Fallback for backward compatibility
      return getMediaUrl(mediaObj, 'review');
    } catch (mediaErr) {
      console.error('Error processing review media:', mediaErr);
      return null;
    }
  };

  const handleReportSubmitted = () => {
    setShowReportModal(false);
    // You might want to show a success message here
  };

  const renderReportButton = () => {
    // Don't show report button if the user is viewing in read-only mode (like from report management)
    if (readOnly || isAdmin) return null;
    
    // Don't show report button if the user is not logged in or is the author of the review
    if (!currentUser || currentUser._id === review.userId) return null;
    
    return (
      <button
        onClick={() => setShowReportModal(true)}
        className="p-2 text-muted-foreground hover:bg-red-50 rounded-lg transition-colors"
        title="Report Review"
      >
        <Flag className="h-5 w-5" />
      </button>
    );
  };

  const mediaUrl = getProcessedMediaUrl(review.media);
  const isVideoMedia = review.media && (
    (typeof review.media === 'object' && review.media.type === 'video') || 
    (typeof review.media === 'string' && isVideo(review.media))
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <Card className="w-full max-w-3xl bg-card p-6 relative max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-full transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {/* Header with actions */}
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-foreground">Review Details</h2>
          <div className="flex space-x-2">
            {renderReportButton()}
          </div>
        </div>

        {/* Restaurant Info */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-foreground">{review.beefery}</h3>
            <div className="bg-primary text-white rounded-full px-3 py-1 flex items-center">
              <span className="text-xl font-bold mr-1">{review.rating.toFixed(1)}</span>
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </div>
          </div>
          {review.location && (
            <p className="text-muted-foreground mt-1">{review.location}</p>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            Reviewed on {formatDate(review.date)} by {review.userDisplayName}
          </p>
        </div>

        {/* Media with improved handling */}
        {mediaUrl && (
          <div className="mb-6 relative group">
            {mediaView === 'normal' ? (
              <div className="relative">
                {isVideoMedia ? (
                  <video
                    src={mediaUrl}
                    controls
                    className="w-full h-auto rounded-lg object-contain max-h-96"
                    onError={(e) => {
                      console.error('Video load error:', e);
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt={`${review.beefery} review`}
                    className="w-full h-auto rounded-lg object-contain max-h-96 cursor-pointer"
                    onClick={() => setMediaView('fullscreen')}
                    onError={(e) => {
                      console.error('Image load error:', e);
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                
                {/* Media controls */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => window.open(mediaUrl, '_blank')}
                    className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
                
                {/* Show fullscreen button for images */}
                {!isVideoMedia && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/50 text-white px-3 py-1 rounded-lg text-sm">
                      Click to enlarge
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div 
                className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
                onClick={() => setMediaView('normal')}
              >
                <div className="relative max-w-[90vw] max-h-[90vh]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMediaView('normal');
                    }}
                    className="absolute -top-12 right-0 p-2 bg-black/50 text-white rounded-full"
                  >
                    <X className="h-6 w-6" />
                  </button>
                  <img
                    src={mediaUrl}
                    alt={`${review.beefery} review (fullscreen)`}
                    className="max-w-full max-h-[90vh] object-contain"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Review Title if present */}
        {review.title && (
          <div className="mb-4">
            <h4 className="text-xl font-semibold">{review.title}</h4>
          </div>
        )}

        {/* Review Summary if present */}
        {review.introSummary && (
          <div className="mb-4 p-4 bg-secondary/20 rounded-lg">
            <p className="text-foreground font-medium">{review.introSummary}</p>
          </div>
        )}

        {/* Review Text */}
        {review.introComments && (
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-2">Review</h4>
            <p className="text-foreground whitespace-pre-line">{review.introComments}</p>
          </div>
        )}

        {/* Review Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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

        {/* Closing Summary if present */}
        {review.closingSummary && (
          <div className="mb-6 p-4 bg-primary/10 border-l-4 border-primary rounded-r-lg">
            <p className="text-foreground font-medium">{review.closingSummary}</p>
          </div>
        )}

        {/* Engagement stats */}
        <div className="border-t pt-4 flex items-center space-x-4">
          <button 
            onClick={() => setShowLikesModal(true)}
            className="flex items-center hover:text-primary transition-colors"
          >
            <ThumbsUp className="h-5 w-5 mr-2 text-muted-foreground" />
            <span>{review.likes?.length || 0} likes</span>
          </button>
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>{review.comments?.length || 0} comments</span>
          </div>
        </div>

        {/* Report Modal */}
        {showReportModal && (
          <ReportModal
            contentType="review"
            contentId={review._id}
            onClose={() => setShowReportModal(false)}
            onReportSubmitted={handleReportSubmitted}
          />
        )}

        {/* Likes Modal */}
        {showLikesModal && (
          <LikesListModal
            likes={review.likes || []}
            onClose={() => setShowLikesModal(false)}
            title="Review Likes"
          />
        )}
      </Card>
    </div>
  );
};

export default ReviewModal;