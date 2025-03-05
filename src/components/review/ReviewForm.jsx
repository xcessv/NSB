import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload,
  Image as ImageIcon,
  Clock,
  DollarSign,
  Loader,
  Beaker,
  AlertTriangle,
  Search,
  FileText,
  PenTool,
  MapPin,
  Smile,
  ArrowRight
} from 'lucide-react';
import { Card } from '../ui/card';
import LocationPicker from '../LocationPicker';
import config from '../../config';
import _ from 'lodash';

import { compressMedia, loadFFmpeg } from '../../utils/MediaCompression';
import { validateMedia, getMediaPreviewUrl, revokeMediaPreview, isVideo, isGif } from '../../utils/MediaUtils';
import { geocodeAddress } from '../../services/geocoding';

/**
 * Enhanced Review Form Component
 * Features:
 * - Emoji support for text fields
 * - FFmpeg-based media compression
 * - Improved validation and error handling
 * - Unsaved changes detection
 * - Auto-suggestions for beefery names and locations
 * - Combined location field for both suggestions and manual entry
 */
const ReviewForm = ({ 
  review = null, 
  reviews = [], 
  onClose = () => {}, 
  onSubmit = () => {}, 
  currentUser, 
  isEditing = false,
  pois = [] 
}) => {
  // Form state management
  const [formData, setFormData] = useState({
    title: review?.title || '',
    introSummary: review?.introSummary || '',
    beefery: review?.beefery || '',
    location: review?.location || '',
    coordinates: review?.coordinates || { lat: 0, lng: 0 },
    introComments: review?.introComments || '',
    timeOfBeefing: review?.timeOfBeefing || '',
    timeInBag: review?.timeInBag || '',
    priceOfBeef: review?.priceOfBeef || '',
    freshPinkWarm: review?.freshPinkWarm || '',
    beefToBun: review?.beefToBun || '',
    flavorOfBeef: review?.flavorOfBeef || '',
    sauceToMayo: review?.sauceToMayo || '',
    cheesePosition: review?.cheesePosition || 'bottom',
    nicelyGriddledBun: review?.nicelyGriddledBun || '',
    dayOldBeef: review?.dayOldBeef || false,
    napkinCount: review?.napkinCount || '',
    closingSummary: review?.closingSummary || '',
    rating: review?.rating || 7.00,
    media: null
  });

  // UI state
  const [mediaPreview, setMediaPreview] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formTouched, setFormTouched] = useState(false);
  const [lastSavedData, setLastSavedData] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [locationFieldMode, setLocationFieldMode] = useState('suggestions'); // 'suggestions' or 'geocoding'
  
  // Media processing state
  const [mediaLoading, setMediaLoading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionStats, setCompressionStats] = useState(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState({
    introSummary: false,
    introComments: false,
    closingSummary: false
  });

  // Recent emoji tracking
  const [recentEmojis, setRecentEmojis] = useState([
    '🔥', '😊', '👍', '🥩', '⭐', '💯', '🏆', '👨‍🍳', '🍔'
  ]);

  // Refs for field containers
  const beeferyFieldRef = useRef(null);
  const locationFieldRef = useRef(null);
  const formRef = useRef(null);

  // Suggestion state
  const [beeferySuggestions, setBeeferySuggestions] = useState([]);
  const [showBeeferySuggestions, setShowBeeferySuggestions] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

  // Check for mobile and preload FFmpeg on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Check if the browser supports SharedArrayBuffer (required for FFmpeg.wasm)
    const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
    const isIsolated = typeof window !== 'undefined' && window.crossOriginIsolated;
    
    // Attempt to preload FFmpeg if browser might support it
    if (hasSharedArrayBuffer && isIsolated) {
      try {
        loadFFmpeg()
          .then((ffmpegLib) => {
            if (ffmpegLib) {
              console.log('FFmpeg loaded successfully');
              setFfmpegLoaded(true);
            } else {
              console.log('FFmpeg not available, will use basic compression');
            }
          })
          .catch(err => {
            console.warn('Failed to preload FFmpeg, will use basic compression:', err);
          });
      } catch (err) {
        console.warn('Error attempting to load FFmpeg:', err);
      }
    } else {
      console.log('Browser does not support SharedArrayBuffer or is not cross-origin isolated');
      console.log('Will use basic compression instead of FFmpeg');
    }
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Generate media preview and set initial form state
  useEffect(() => {
    if (review?.media) {
      const previewUrl = getMediaPreviewUrl(null, review.media);
      setMediaPreview(previewUrl);
    }
    
    // Store initial form data for dirty check
    setLastSavedData({...formData});
    
    // Try to load recent emojis from localStorage
    try {
      const savedEmojis = localStorage.getItem('recentEmojis');
      if (savedEmojis) {
        setRecentEmojis(JSON.parse(savedEmojis));
      }
    } catch (error) {
      console.warn('Failed to load recent emojis:', error);
    }
    
    // Cleanup function to revoke any object URLs created
    return () => {
      if (mediaPreview && mediaPreview.startsWith('blob:')) {
        revokeMediaPreview(mediaPreview);
      }
    };
  }, []);

  // Show confirmation if form is dirty and user tries to close
  useEffect(() => {
    const isDirty = formTouched && !_.isEqual(
      _.omit(formData, ['media']), 
      _.omit(lastSavedData, ['media'])
    );
    
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [formData, lastSavedData, formTouched]);

  // Click outside handler for suggestions and emoji picker
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Handle outside clicks for beefery field
      if (beeferyFieldRef.current && !beeferyFieldRef.current.contains(e.target)) {
        setShowBeeferySuggestions(false);
      }

      // Handle outside clicks for location field
      if (locationFieldRef.current && !locationFieldRef.current.contains(e.target)) {
        setShowLocationSuggestions(false);
      }

      // Close all emoji pickers
      setShowEmojiPicker({
        introSummary: false,
        introComments: false,
        closingSummary: false
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  // Get beefery suggestions from both POIs and existing reviews
  const getBeeferySuggestions = (input) => {
    if (!input) return [];
    
    const inputLower = input.toLowerCase();
    const suggestions = [];

    // Add POI suggestions
    pois.forEach(poi => {
      if (poi.name.toLowerCase().includes(inputLower)) {
        suggestions.push({
          type: 'poi',
          name: poi.name,
          location: poi.location,
          coordinates: poi.coordinates
        });
      }
    });

    // Add existing location suggestions
    reviews.forEach(review => {
      if (review.beefery.toLowerCase().includes(inputLower)) {
        suggestions.push({
          type: 'existing',
          name: review.beefery,
          location: review.location,
          coordinates: review.coordinates
        });
      }
    });

    // Remove duplicates based on name and location
    return _.uniqBy(suggestions, item => `${item.name}-${item.location}`);
  };

  // Get location suggestions - IMPROVED MATCHING
  const getLocationSuggestions = (input) => {
    if (!input || input.length < 2) return [];
    
    const inputLower = input.toLowerCase().trim();
    const suggestions = [];

    // Helper function for better matching
    const isGoodMatch = (text) => {
      if (!text) return false;
      const textLower = text.toLowerCase();
      
      // Check for exact matches or word starts with input
      return textLower.includes(inputLower) || 
             textLower.split(/[\s,]+/).some(word => word.startsWith(inputLower));
    };

    // First add POI suggestions (they get priority)
    pois.forEach(poi => {
      if (isGoodMatch(poi.name) || isGoodMatch(poi.location)) {
        suggestions.push({
          type: 'poi',
          name: poi.name,
          location: poi.location || 'Unknown location',
          coordinates: poi.coordinates
        });
      }
    });

    // Add existing location suggestions with improved matching
    reviews.forEach(review => {
      if (isGoodMatch(review.beefery) || isGoodMatch(review.location)) {
        // Check if we already have this entry to avoid duplicates
        const exists = suggestions.some(
          s => s.name?.toLowerCase() === review.beefery?.toLowerCase() && 
               s.location?.toLowerCase() === review.location?.toLowerCase()
        );
        
        if (!exists) {
          suggestions.push({
            type: 'existing',
            name: review.beefery,
            location: review.location || 'Unknown location',
            coordinates: review.coordinates
          });
        }
      }
    });

    // Remove duplicates and limit to 10 results
    return _.uniqBy(suggestions, item => `${item.name}-${item.location}`).slice(0, 10);
  };

  // Additional geocoding API fallback for manual address entry
  const fallbackGeocoding = async (address) => {
    try {
      // Try the OpenStreetMap Nominatim API as fallback
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (!response.ok) throw new Error('Fallback geocoding failed');
      
      const data = await response.json();
      
      if (data && data.length > 0 && data[0].lat && data[0].lon) {
        console.log('Fallback geocoding succeeded:', data[0]);
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          display_name: data[0].display_name
        };
      }
      
      return null;
    } catch (error) {
      console.error('Fallback geocoding error:', error);
      return null;
    }
  };

  // Media change handler with FFmpeg compression
  const handleMediaChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show loading indicator
    setMediaLoading(true);
    setCompressionProgress(0);
    setError('');

    try {
      // 1. Validate media first
      const validation = validateMedia(file, {
        maxImageSize: config.MAX_IMAGE_SIZE,
        maxVideoSize: config.MAX_VIDEO_SIZE,
        allowedImageTypes: config.ALLOWED_IMAGE_TYPES,
        allowedVideoTypes: config.ALLOWED_VIDEO_TYPES
      });

      if (!validation.valid) {
        setError(validation.error);
        e.target.value = null; // Clear input
        return;
      }

      // 2. Revoke previous preview URL if it exists
      if (mediaPreview && mediaPreview.startsWith('blob:')) {
        revokeMediaPreview(mediaPreview);
      }

      // 3. Show a temporary preview of the original file while compressing
      const tempPreview = URL.createObjectURL(file);
      setMediaPreview(tempPreview);
      
      // 4. Compress the media file with progress tracking for videos
      const isVideoFile = isVideo(file);
      
      // Configure compression options
      const compressionOptions = {
        // Image options
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.8,
        
        // Video options (FFmpeg)
        preset: 'medium',      // Compression preset
        crf: 23,               // Quality factor (lower = better)
        scale: '1280:720',     // Output resolution
        bitrate: '2M',         // Target bitrate
        
        // Progress tracking for videos
        onProgress: isVideoFile ? (percent) => {
          setCompressionProgress(percent);
        } : undefined,
        
        // General options
        skipThreshold: 512 * 1024 // Skip compression for files under 512KB
      };
      
      const compressedFile = await compressMedia(file, compressionOptions);

      // 5. Revoke the temporary preview
      URL.revokeObjectURL(tempPreview);
      
      // 6. Create final preview URL
      const finalPreview = URL.createObjectURL(compressedFile);
      setMediaPreview(finalPreview);
      
      // 7. Track compression statistics
      if (compressedFile.compressionRatio) {
        setCompressionStats({
          originalSize: (file.size / (1024 * 1024)).toFixed(2) + 'MB',
          compressedSize: (compressedFile.size / (1024 * 1024)).toFixed(2) + 'MB',
          ratio: compressedFile.compressionRatio
        });
      }
      
      // 8. Update form data with compressed file
      setFormData(prev => ({ ...prev, media: compressedFile }));
      setFormTouched(true);
      
    } catch (error) {
      console.error('Media processing error:', error);
      setError('Failed to process media. Using original file instead.');
      
      // Fallback to original file if compression fails
      const previewUrl = URL.createObjectURL(file);
      setMediaPreview(previewUrl);
      setFormData(prev => ({ ...prev, media: file }));
      
    } finally {
      setMediaLoading(false);
      setCompressionProgress(0);
      e.target.value = null; // Reset file input
    }
  };

  // Handle media removal
  const handleRemoveMedia = () => {
    // Revoke previous preview URL if it exists
    if (mediaPreview && mediaPreview.startsWith('blob:')) {
      revokeMediaPreview(mediaPreview);
    }

    setMediaPreview('');
    setFormData(prev => ({ ...prev, media: null }));
    setCompressionStats(null);
    setFormTouched(true);
    setError('');
  };

  // Render compression stats if available
  const renderCompressionStats = () => {
    if (!compressionStats) return null;
    
    return (
      <div className="mt-2 text-xs text-green-500">
        Compressed: {compressionStats.originalSize} → {compressionStats.compressedSize} ({compressionStats.ratio} reduction)
      </div>
    );
  };

  // Render loading/progress state for media
  const renderLoadingState = () => {
    if (!mediaLoading) return null;
    
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="relative h-10 w-10">
          <Loader className="h-10 w-10 animate-spin text-primary" />
          {compressionProgress > 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
              {compressionProgress}%
            </div>
          )}
        </div>
        <span className="text-xs mt-2 text-muted-foreground">
          {compressionProgress > 0 
            ? 'Compressing video...' 
            : 'Processing media...'}
        </span>
      </div>
    );
  };

  // Handle beefery selection
  const handleBeeferySelect = (suggestion, event) => {
    event.stopPropagation(); // Prevent click outside handler
    setFormData(prev => ({
      ...prev,
      beefery: suggestion.name,
      location: suggestion.location || prev.location,
      coordinates: suggestion.coordinates || prev.coordinates
    }));
    setFormTouched(true);
    setShowBeeferySuggestions(false);
  };

  // Handle location selection
  const handleLocationSelect = (suggestion, event) => {
    event.stopPropagation(); // Prevent click outside handler
    setFormData(prev => ({
      ...prev,
      beefery: suggestion.name || prev.beefery,
      location: suggestion.location,
      coordinates: suggestion.coordinates || prev.coordinates
    }));
    setFormTouched(true);
    setShowLocationSuggestions(false);
  };

  // Handle manual address geocoding - unified with location field
  const handleAddressGeocode = async () => {
    if (!formData.location.trim()) return;
    
    try {
      setLoading(true);
      setError('');
      
      console.log('Geocoding address:', formData.location);
      
      // Try with primary geocoding service
      let result = await geocodeAddress(formData.location);
      
      // If primary geocoding fails, try fallback
      if (!result || !result.lat || !result.lng) {
        console.log('Primary geocoding failed, trying fallback...');
        result = await fallbackGeocoding(formData.location);
      }
      
      if (result && result.lat && result.lng) {
        console.log('Geocoded successfully:', result);
        
        // Update form data with the new location and coordinates
        setFormData(prev => ({
          ...prev,
          location: result.display_name || prev.location,
          coordinates: {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lng)
          }
        }));
        
        setFormTouched(true);
        
        // Success indicator
        console.log("Location found and coordinates added successfully");
      } else {
        console.error('Geocoding failed - no coordinates returned');
        setError('Could not find coordinates for this address. Please try a different address or format.');
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
      setError('Error finding location. Please try a different address or format.');
    } finally {
      setLoading(false);
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (fieldName, emoji) => {
    // Update form data with the emoji
    setFormData(prev => ({
      ...prev,
      [fieldName]: prev[fieldName] + emoji
    }));
    setFormTouched(true);
    
    // Update recent emojis
    setRecentEmojis(prev => {
      // Remove emoji if it already exists to avoid duplicates
      const filtered = prev.filter(e => e !== emoji);
      // Add emoji to the front
      const updated = [emoji, ...filtered].slice(0, 9);
      
      // Store in localStorage for persistence
      try {
        localStorage.setItem('recentEmojis', JSON.stringify(updated));
      } catch (error) {
        console.warn('Failed to save recent emojis:', error);
      }
      
      return updated;
    });
    
    // Add animation class to the textarea
    const textarea = document.getElementById(`textarea-${fieldName}`);
    if (textarea) {
      textarea.classList.add('emoji-animate');
      setTimeout(() => {
        textarea.classList.remove('emoji-animate');
      }, 300);
    }
    
    // Close emoji picker
    setShowEmojiPicker(prev => ({
      ...prev,
      [fieldName]: false
    }));
  };

  // Generic input change handler
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setFormTouched(true);
  };

  // Handle rating slider change
  const handleRatingChange = (e) => {
    // Convert to float with 2 decimal places
    const rawValue = parseFloat(e.target.value) / 100;
    const formattedValue = parseFloat(rawValue.toFixed(2));
    
    setFormData(prev => ({
      ...prev,
      rating: formattedValue
    }));
    setFormTouched(true);
  };

  // Form submission handler
  const handleSubmit = async (e) => {
  e.preventDefault();
  if (!currentUser) {
    setError('Please login to submit a review');
    return;
  }

  // Basic validation
  if (!formData.beefery.trim()) {
    setError('Beefery name is required');
    return;
  }

  if (formData.rating < 0 || formData.rating > 10) {
    setError('Rating must be between 0 and 10');
    return;
  }

  setLoading(true);
  setError('');

  try {
    const submitData = new FormData();
    
    // Add non-empty fields to form data
    Object.entries(formData).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      
      if (key === 'coordinates') {
        if (value && typeof value === 'object') {
          const lat = parseFloat(value.lat || 0);
          const lng = parseFloat(value.lng || 0);
          
          submitData.append('coordinates[lat]', lat.toString());
          submitData.append('coordinates[lng]', lng.toString());
        }
      }
      else if (key === 'media' && value instanceof File) {
        // Just append the media file directly - don't try to structure it
        submitData.append('media', value);
      }
      else if (typeof value === 'boolean') {
        submitData.append(key, value.toString());
      }
      else {
        submitData.append(key, value.toString());
      }
    });

    console.log('Submitting review with data:', {
      beefery: formData.beefery,
      rating: formData.rating,
      hasMedia: !!formData.media,
      mediaSize: formData.media ? `${(formData.media.size / (1024 * 1024)).toFixed(2)}MB` : 'N/A'
    });

    const response = await onSubmit(submitData);
    
    if (response) {
      setLastSavedData({...formData});
      setFormTouched(false);
      
      // ===== ENHANCED NOTIFICATION MECHANISM =====
      
      try {
        console.log('Triggering notifications for new review');
        
        // 1. Store last added review details in localStorage to help components catch up on mount
        try {
          localStorage.setItem('lastAddedReview', JSON.stringify({
            beefery: formData.beefery,
            timestamp: Date.now()
          }));
          
          // Also add an incrementing review counter to localStorage
          const currentCount = parseInt(localStorage.getItem('reviewCount') || '0');
          localStorage.setItem('reviewCount', (currentCount + 1).toString());
          
          // Update the timestamp on an existing key to trigger storage events
          localStorage.setItem('reviewTimestamp', Date.now().toString());
        } catch (storageErr) {
          console.warn('Failed to update localStorage after review submission:', storageErr);
        }
        
        // 2. Fire a standard content-updated event that components listen for
        const reviewAddedEvent = new CustomEvent('content-updated', {
          detail: {
            type: 'review-added',
            beefery: formData.beefery,
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(reviewAddedEvent);
        
        // 3. Fire a dedicated review-added event for components that might listen specifically
        const simpleEvent = new CustomEvent('review-added');
        window.dispatchEvent(simpleEvent);
        
        // 4. Clear review caches directly using the reviewService
        if (typeof reviewService?.clearCache === 'function') {
          reviewService.clearCache();
        }
        
        console.log('All notification mechanisms triggered for new review');
      } catch (notifyError) {
        console.warn('Error in review notification process:', notifyError);
      }
      
      // Close the form
      onClose();
    }
  } catch (error) {
    console.error('Review submission error:', error);
    setError(error.message || 'Failed to submit review');
  } finally {
    setLoading(false);
  }
};

  // Handle close with confirmation
  const handleClose = () => {
    const isDirty = formTouched && !_.isEqual(
      _.omit(formData, ['media']), 
      _.omit(lastSavedData, ['media'])
    );
    
    if (isDirty && confirm('You have unsaved changes. Are you sure you want to close this form?')) {
      onClose();
    } else if (!isDirty) {
      onClose();
    }
  };

  // Load test data for development
  const loadTestData = () => {
    const testData = {
      title: "Amazing Beef Experience at Pete's",
      introSummary: "Quick summary: This place is amazing! 🔥",
      beefery: "Pete's Woburn",
      location: "100 A Winn St, Woburn, MA 01801",
      introComments: "Classic beef joint. Winner of 2024 BEEF MADNESS 🏆 The place has amazing atmosphere and even better beef! 🥩",
      timeOfBeefing: "12:30 PM",
      timeInBag: "4 minutes",
      priceOfBeef: "$9.99",
      freshPinkWarm: "Perfect pink, steaming hot",
      beefToBun: "Excellent ratio",
      flavorOfBeef: "Rich and well-seasoned",
      sauceToMayo: "Heavy on the sauce",
      cheesePosition: "bottom",
      nicelyGriddledBun: "Perfectly toasted",
      dayOldBeef: false,
      napkinCount: "6",
      closingSummary: "Overall: A must-visit spot for beef lovers! ⭐⭐⭐⭐⭐",
      rating: 8.75
    };

    setFormData(prev => ({
      ...prev,
      ...testData
    }));
    setFormTouched(true);
  };
  // Render Emoji Picker for a specific field
  const renderEmojiPicker = (fieldName) => {
    if (!showEmojiPicker[fieldName]) return null;
    
    return (
      <div className="absolute z-50 bottom-full right-0 mb-2">
        <div className="bg-card p-2 rounded-lg shadow-lg border border-border max-h-[300px] overflow-y-auto">
          <div className="grid grid-cols-8 gap-1">
            {/* Recent emojis section */}
            {recentEmojis.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiSelect(fieldName, emoji)}
                className="p-1 hover:bg-secondary rounded text-2xl emoji-reaction"
              >
                {emoji}
              </button>
            ))}
            
            {/* Common emoji selection based on field type */}
            {fieldName === 'introSummary' && (
              <>
                {['😀', '😍', '🤔', '🔥', '👍', '❤️', '🥩', '🍔', '🍟', '⭐', '💯', '🏆', '👨‍🍳', '🤤', '😋', '🍴'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiSelect(fieldName, emoji)}
                    className="p-1 hover:bg-secondary rounded text-2xl"
                  >
                    {emoji}
                  </button>
                ))}
              </>
            )}
            
            {fieldName === 'introComments' && (
              <>
                {['😀', '😍', '🤔', '🔥', '👍', '❤️', '🥩', '🍔', '🍟', '⭐', '💯', '🏆', '👨‍🍳', '🤤', '😋', '🍴', '🍽️', '💪', '👌', '😎'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiSelect(fieldName, emoji)}
                    className="p-1 hover:bg-secondary rounded text-2xl"
                  >
                    {emoji}
                  </button>
                ))}
              </>
            )}
            
            {fieldName === 'closingSummary' && (
              <>
                {['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐', '👍', '👎', '🙌', '💯', '💪', '🏆', '🔥', '🤔', '😋', '🤤', '💖'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiSelect(fieldName, emoji)}
                    className="p-1 hover:bg-secondary rounded text-2xl"
                  >
                    {emoji}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render Text Area with Emoji Support
  const renderEmojiTextArea = ({ 
    id, 
    name, 
    value, 
    placeholder, 
    rows = 3,
    icon = null,
    iconPosition = 'right'
  }) => {
    return (
      <div className="relative">
        <textarea
          id={`textarea-${name}`}
          name={name}
          value={value}
          onChange={handleInputChange}
          rows={rows}
          className={`w-full p-3 ${icon && iconPosition === 'left' ? 'pl-10' : ''} border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent emoji-font`}
          placeholder={placeholder}
        />
        
        {icon && iconPosition === 'left' && (
          <div className="absolute left-3 top-3">
            {icon}
          </div>
        )}
        
        <button
          type="button"
          onClick={() => setShowEmojiPicker(prev => ({...prev, [name]: !prev[name]}))}
          className={`absolute ${iconPosition === 'left' ? 'right-3' : 'right-3'} bottom-3 text-muted-foreground hover:text-foreground transition-colors`}
        >
          <Smile className="h-5 w-5" />
        </button>
        
        {renderEmojiPicker(name)}
      </div>
    );
  };

  // Render Media Upload Section
const renderMediaUploadSection = () => {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Add Photo/Video
      </label>
      <div className="flex items-center space-x-4">
        {mediaPreview ? (
          <div className="relative group">
            {!formData.media || 
             (formData.media instanceof File && formData.media.type.startsWith('image/')) || 
             (review?.media?.type && review.media.type.startsWith('image/')) ? (
              <img
                src={mediaPreview}
                alt="Preview"
                className="w-32 h-32 object-cover rounded-lg"
              />
            ) : (
              <video
                src={mediaPreview}
                className="w-32 h-32 object-cover rounded-lg"
                controls
              />
            )}
            <button
              type="button"
              onClick={handleRemoveMedia}
              className="absolute top-1 right-1 p-1 bg-card rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4 text-slate-500" />
            </button>
            {renderCompressionStats()}
          </div>
        ) : (
          <div className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center">
            {mediaLoading ? renderLoadingState() : (
              <ImageIcon className="h-8 w-8 text-slate-400" />
            )}
          </div>
        )}
        <label className={`flex items-center px-4 py-2 bg-secondary text-slate-700 rounded-lg ${mediaLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-border'} transition-colors`}>
          <Upload className="h-5 w-5 mr-2" />
          {mediaLoading ? 'Processing...' : 'Upload Media'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,video/mp4,video/quicktime,video/webm"
            onChange={handleMediaChange}
            className="hidden"
            disabled={mediaLoading}
          />
        </label>
      </div>
      
      {compressionStats && (
        <p className="block text-green-500 mt-2 text-sm">
          Your upload was automatically compressed for better performance!
        </p>
      )}
    </div>
  );
};

  // Render Beefery Input with Autocomplete
  const renderBeeferyInput = () => {
    return (
      <div className="relative" ref={beeferyFieldRef}>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Beefery Name
        </label>
        <div className="relative">
          <input
            type="text"
            name="beefery"
            value={formData.beefery}
            onChange={(e) => {
              handleInputChange(e);
              const newValue = e.target.value;
              const suggestions = getBeeferySuggestions(newValue);
              setBeeferySuggestions(suggestions);
              setShowBeeferySuggestions(suggestions.length > 0);
            }}
            onFocus={(e) => {
              const suggestions = getBeeferySuggestions(e.target.value);
              setBeeferySuggestions(suggestions);
              setShowBeeferySuggestions(suggestions.length > 0);
            }}
            className="w-full p-3 pl-10 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            required
            placeholder="Enter beefery name"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        </div>

        {/* Beefery Suggestions Dropdown */}
        {showBeeferySuggestions && (
          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
            {beeferySuggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.name}-${suggestion.location}-${index}`}
                type="button"
                onClick={(e) => handleBeeferySelect(suggestion, e)}
                className="w-full text-left px-4 py-3 hover:bg-secondary transition-colors border-b border-border last:border-0"
              >
                <div className="flex items-start">
                  <div className="flex-grow">
                    <div className="font-medium text-foreground">{suggestion.name}</div>
                    {suggestion.location && (
                      <div className="text-sm text-muted-foreground mt-0.5 flex items-center">
                        <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                        {suggestion.location}
                      </div>
                    )}
                  </div>
                  {suggestion.type === 'poi' ? (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full ml-2">POI</span>
                  ) : (
                    <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded-full ml-2">Existing</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render unified Location Input with Autocomplete + Geocoding
  const renderLocationInput = () => {
    return (
      <div className="relative" ref={locationFieldRef}>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Location
        </label>
        <div className="flex">
          <div className="relative flex-grow">
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={(e) => {
                handleInputChange(e);
                const newValue = e.target.value;
                const suggestions = getLocationSuggestions(newValue);
                setLocationSuggestions(suggestions);
                setShowLocationSuggestions(suggestions.length > 0);
              }}
              onFocus={(e) => {
                const suggestions = getLocationSuggestions(e.target.value);
                setLocationSuggestions(suggestions);
                setShowLocationSuggestions(suggestions.length > 0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (locationSuggestions.length === 0) {
                    handleAddressGeocode();
                  }
                }
              }}
              className="w-full p-3 pl-10 border border-border rounded-l-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Enter address or location"
            />
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={handleAddressGeocode}
            disabled={loading || !formData.location.trim()}
            className="px-3 py-2 bg-secondary text-foreground rounded-r-lg hover:bg-border disabled:opacity-50 flex items-center"
            title="Find coordinates for this address"
          >
            {loading ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowRight className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Location Suggestions Dropdown */}
        {showLocationSuggestions && (
          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
            {locationSuggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.name}-${suggestion.location}-${index}`}
                type="button"
                onClick={(e) => handleLocationSelect(suggestion, e)}
                className="w-full text-left px-4 py-3 hover:bg-secondary transition-colors border-b border-border last:border-0"
              >
                <div className="flex items-start">
                  <div className="flex-grow">
                    <div className="font-medium text-foreground">{suggestion.location}</div>
                    {suggestion.name && (
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {suggestion.name}
                      </div>
                    )}
                  </div>
                  {suggestion.type === 'poi' ? (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full ml-2">POI</span>
                  ) : (
                    <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded-full ml-2">Existing</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        
        <p className="text-xs text-muted-foreground mt-1">
          Type to see suggestions or enter any address and click the arrow button to geocode it.
        </p>
      </div>
    );
  };
  
  // Render rating slider
  const renderRatingSlider = () => {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Rating (0.00-10.00)
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="0"
            max="1000"
            value={formData.rating * 100}
            onChange={handleRatingChange}
            className="flex-1 h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <span className="text-2xl font-bold text-primary min-w-[5rem] text-center">
            {formData.rating.toFixed(2)}
          </span>
        </div>
      </div>
    );
  };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <Card className="w-full max-w-3xl bg-card shadow-xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              {isEditing ? 'Edit Review' : 'Add Review'}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-secondary rounded-full transition-colors"
              aria-label="Close form"
            >
              <X className="h-6 w-6 text-slate-500" />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Form */}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {/* Title Field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Review Title
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full p-3 pl-10 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent emoji-font"
                  placeholder="Give your review a title..."
                />
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Introduction Summary Field with Emoji Support */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Introduction Summary
              </label>
              {renderEmojiTextArea({
                id: 'introSummary',
                name: 'introSummary',
                value: formData.introSummary,
                placeholder: 'A quick summary of your beef experience...',
                rows: 2
              })}
            </div>

            {/* Basic Info Section with improved bidirectional autofill */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Beefery Name with Autofill */}
              {renderBeeferyInput()}

              {/* Unified Location Field */}
              {renderLocationInput()}
            </div>

            {/* Media Upload Section with FFmpeg compression */}
            {renderMediaUploadSection()}

            {/* Time Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Time of Beefing (TOB)
                </label>
                <input
                  type="text"
                  name="timeOfBeefing"
                  value={formData.timeOfBeefing}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., 12:30 PM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Time in Bag (TIB)
                </label>
                <input
                  type="text"
                  name="timeInBag"
                  value={formData.timeInBag}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., 5 minutes"
                />
              </div>
            </div>

            {/* Beef Quality Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Price of Beef (POB)
                </label>
                <input
                  type="text"
                  name="priceOfBeef"
                  value={formData.priceOfBeef}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., $8.99"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fresh, Pink and Warm (FPW)
                </label>
                <input
                  type="text"
                  name="freshPinkWarm"
                  value={formData.freshPinkWarm}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Describe the meat's appearance"
                />
              </div>
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Beef to Bun Ratio (B2B)
                </label>
                <input
                  type="text"
                  name="beefToBun"
                  value={formData.beefToBun}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Describe the ratio"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Flavor of Beef (FOB)
                </label>
                <input
                  type="text"
                  name="flavorOfBeef"
                  value={formData.flavorOfBeef}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Describe the flavor"
                />
              </div>
            </div>

            {/* Sauce and Cheese */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sauce to Mayo (S2M)
                </label>
                <input
                  type="text"
                  name="sauceToMayo"
                  value={formData.sauceToMayo}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Describe the sauce ratio"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cheese Position (COTB/COTT)
                </label>
                <div className="flex space-x-4 mt-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="cheesePosition"
                      value="bottom"
                      checked={formData.cheesePosition === 'bottom'}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    Bottom
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="cheesePosition"
                      value="top"
                      checked={formData.cheesePosition === 'top'}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    Top
                  </label>
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nicely Griddled Bun (NGB)
                </label>
                <input
                  type="text"
                  name="nicelyGriddledBun"
                  value={formData.nicelyGriddledBun}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Describe the bun's preparation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Napkin Count (NC)
                </label>
                <input
                  type="number"
                  name="napkinCount"
                  value={formData.napkinCount}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="0"
                  placeholder="Number of napkins used"
                />
              </div>
            </div>

            {/* Day Old Beef Checkbox */}
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="dayOldBeef"
                  checked={formData.dayOldBeef}
                  onChange={handleInputChange}
                  className="rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-slate-700">Day Old Beef (DOB)</span>
              </label>
            </div>

            {/* Rating Slider - shows 2 decimal places */}
            {renderRatingSlider()}

            {/* Detailed Review with Emoji Support */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Detailed Review
              </label>
              {renderEmojiTextArea({
                id: 'introComments',
                name: 'introComments',
                value: formData.introComments,
                placeholder: 'Share your detailed thoughts about the beef experience...',
                rows: 4
              })}
            </div>

            {/* Closing Summary with Emoji Support */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Closing Summary
              </label>
              {renderEmojiTextArea({
                id: 'closingSummary',
                name: 'closingSummary',
                value: formData.closingSummary,
                placeholder: 'Sum up your experience and final thoughts...',
                rows: 2,
                icon: <PenTool className="h-5 w-5 text-muted-foreground pointer-events-none" />,
                iconPosition: 'left'
              })}
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-between pt-6 border-t">
              {/* Test Data Button - Only show in development */}
              {process.env.NODE_ENV === 'development' && (
                <button
                  type="button"
                  onClick={loadTestData}
                  className="px-4 py-2 text-sm bg-secondary hover:bg-border rounded-lg transition-colors flex items-center"
                  disabled={loading}
                >
                  <Beaker className="h-4 w-4 mr-2" />
                  Load Test Data
                </button>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-secondary rounded-lg transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center"
                >
                  {loading ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      {isEditing ? 'Updating...' : 'Submitting...'}
                    </>
                  ) : (
                    <>{isEditing ? 'Update Review' : 'Submit Review'}</>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default ReviewForm;