// src/utils/MediaUtils.js
import config from '../config';

/**
 * Utility function to generate consistent media URLs across the application
 * 
 * @param {Object|string} media - Media object with url/original property or direct URL string
 * @param {string} mediaType - Optional type of media ('review', 'comment', 'news', 'profile')
 * @returns {string|null} Properly formatted URL or null if invalid
 */
// Update this function in MediaUtils.js
export const getMediaUrl = (media, mediaType = 'general') => {
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
    console.warn('Invalid media object structure:', media);
    return null;
  }
  
  if (!url) {
    console.warn('No valid URL found in media object');
    return null;
  }
  
  // Handle absolute filesystem paths that shouldn't appear in URLs
  if (url.includes(':\\') || url.startsWith('C:/') || url.startsWith('/C:/')) {
    console.warn('Converting absolute file path to web URL:', url);
    // Extract just the filename as a fallback
    const filename = url.split(/[/\\]/).pop();
    if (filename) {
      url = `/uploads/${mediaType}/${filename}`;
      console.log('Converted to:', url);
    } else {
      console.error('Failed to extract filename from path:', url);
      return null;
    }
  }
  
  // Clean up path
  url = url.replace(/\/uploads\/uploads\//, '/uploads/');
  url = url.replace(/^\/api\//, '');
  
  // Ensure path starts with /uploads/ if it doesn't have a proper prefix
  if (!url.startsWith('/uploads/') && !url.startsWith('http')) {
    url = `/uploads/${mediaType}/${url}`;
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

/**
 * Utility function to validate media files before upload
 * 
 * @param {File} file - The file object to validate
 * @param {Object} options - Validation options
 * @param {number} options.maxImageSize - Maximum allowed image size in bytes
 * @param {number} options.maxVideoSize - Maximum allowed video size in bytes
 * @param {Array} options.allowedImageTypes - Allowed image MIME types
 * @param {Array} options.allowedVideoTypes - Allowed video MIME types
 * @returns {Object} Validation result {valid: boolean, error: string|null}
 */
export const validateMedia = (file, options = {}) => {
  if (!file) return { valid: true, error: null };

  const {
    maxImageSize = config.MAX_IMAGE_SIZE || 5 * 1024 * 1024, // 5MB default
    maxVideoSize = config.MAX_VIDEO_SIZE || 50 * 1024 * 1024, // 50MB default
    allowedImageTypes = config.ALLOWED_IMAGE_TYPES || ['image/jpeg', 'image/png', 'image/gif'],
    allowedVideoTypes = config.ALLOWED_VIDEO_TYPES || ['video/mp4', 'video/quicktime', 'video/webm']
  } = options;

  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: 'File type not supported. Please upload an image or video.'
    };
  }

  // Check file size based on type
  const maxSize = file.type.startsWith('video/') ? maxVideoSize : maxImageSize;
  if (file.size > maxSize) {
    const sizeInMB = Math.round(maxSize / (1024 * 1024));
    return { 
      valid: false, 
      error: `File size must be less than ${sizeInMB}MB`
    };
  }

  return { valid: true, error: null };
};

/**
 * Creates a preview URL for a media file
 * 
 * @param {File|string} media - File object or URL string
 * @param {string} existingUrl - Optional existing URL for the media
 * @returns {string|null} URL that can be used for preview
 */
export const getMediaPreviewUrl = (media, existingUrl = null) => {
  if (!media && !existingUrl) return null;
  
  // If media is a File object, create an object URL
  if (media instanceof File) {
    return URL.createObjectURL(media);
  }
  
  // If media is a string URL or we have an existing URL, process it
  if (typeof media === 'string' || existingUrl) {
    return getMediaUrl(media || existingUrl);
  }
  
  // If media is an object with a URL property
  if (media && (media.url || media.original)) {
    return getMediaUrl(media);
  }
  
  return null;
};

/**
 * Safely releases an object URL to prevent memory leaks
 * 
 * @param {string} url - Object URL to revoke
 */
export const revokeMediaPreview = (url) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

/**
 * Determines if a file is a video based on its type
 * 
 * @param {File|Object} file - File object or media object with type property
 * @returns {boolean} True if the file is a video
 */
export const isVideo = (file) => {
  if (!file) return false;
  
  const type = file.type || file.mimetype;
  return type && type.startsWith('video/');
};

/**
 * Determines if a file is a GIF based on its type
 * 
 * @param {File|Object} file - File object or media object with type property
 * @returns {boolean} True if the file is a GIF
 */
export const isGif = (file) => {
  if (!file) return false;
  
  const type = file.type || file.mimetype;
  return type && type.includes('gif');
};

export default {
  getMediaUrl,
  validateMedia,
  getMediaPreviewUrl,
  revokeMediaPreview,
  isVideo,
  isGif
};
