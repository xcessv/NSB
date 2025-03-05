const config = {
  API_URL: import.meta.env.VITE_API_URL || 'http://10.0.0.57:5000/api',
  DEFAULT_AVATAR: '/images/default-avatar.png',
  UPLOAD_PATH: '/uploads',
  MAX_IMAGE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_VIDEO_SIZE: 500 * 1024 * 1024, // 500MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/quicktime'],

  // Get base URL without /api
  getBaseUrl: () => {
    const apiUrl = config.API_URL;
    return apiUrl.endsWith('/api/') 
      ? apiUrl.slice(0, -5)
      : apiUrl.endsWith('/api')
        ? apiUrl.slice(0, -4)
        : apiUrl;
  },

  // Enhanced image URL handling for any image type (news, reviews, profiles)
  getImageUrl: (imagePath) => {
    if (!imagePath) return config.DEFAULT_AVATAR;
    
    const baseUrl = config.getBaseUrl();
    
    // Handle absolute paths that mistakenly got into the database
    if (imagePath.includes(':\\') || imagePath.includes('/Users/')) {
      // Extract just the filename and folder
      const parts = imagePath.split(/[\/\\]/);
      const folder = parts[parts.length - 2] === 'news' ? 'news' : 'reviews';
      const filename = parts[parts.length - 1];
      return `${baseUrl}/uploads/${folder}/${filename}`;
    }
    
    // Clean up the path - remove double slashes, ensure it starts with /
    let cleanPath = imagePath.replace(/\/+/g, '/');
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }
    
    // If path already includes 'uploads', don't prefix with it again
    if (cleanPath.includes('/uploads/')) {
      return `${baseUrl}${cleanPath}`;
    }
    
    return `${baseUrl}/uploads${cleanPath}`;
  },

  // Get full URL for uploaded files - enhanced version
  getUploadUrl: (path) => {
    if (!path) return config.DEFAULT_AVATAR;
    
    console.log('getUploadUrl input:', path);
    
    // Handle absolute paths
    if (path.includes(':\\') || path.includes('/Users/')) {
      const parts = path.split(/[\/\\]/);
      const filename = parts[parts.length - 1];
      // Try to determine folder from path
      let folder = 'misc';
      if (parts.includes('news')) {
        folder = 'news';
      } else if (parts.includes('reviews')) {
        folder = 'reviews';
      } else if (parts.includes('profiles')) {
        folder = 'profiles';
      }
      
      const result = `${config.getBaseUrl()}/uploads/${folder}/${filename}`;
      console.log('getUploadUrl output (absolute path):', result);
      return result;
    }
    
    // Remove any absolute path components
    const cleanPath = path
      .split('/')
      .filter(part => !part.includes(':'))  // Remove parts with drive letters
      .join('/')
      .replace(/^uploads\//, '')   // Remove leading uploads/
      .replace(/^\/uploads\//, '') // Remove leading /uploads/
      .replace(/^\//, '');         // Remove any remaining leading slash
    
    const fullUrl = `${config.getBaseUrl()}/uploads/${cleanPath}`;
    
    console.log('getUploadUrl output:', {
      originalPath: path,
      cleanPath,
      baseUrl: config.getBaseUrl(),
      fullUrl
    });
    
    return fullUrl;
  },
  
  // Normalize image paths for storage
  normalizeImagePath: (path) => {
    if (!path) return null;
    
    // Convert backslashes to forward slashes
    let normalizedPath = path.replace(/\\/g, '/');
    
    // Handle absolute paths
    if (normalizedPath.includes(':/') || normalizedPath.includes('/Users/')) {
      const parts = normalizedPath.split(/[\/\\]/);
      const filename = parts[parts.length - 1];
      // Determine folder from context if possible
      if (parts.includes('news')) {
        return `news/${filename}`;
      } else if (parts.includes('reviews')) {
        return `reviews/${filename}`;
      } else {
        return filename;
      }
    }
    
    // For relative paths, ensure consistent format
    if (normalizedPath.startsWith('/uploads/')) {
      return normalizedPath.substring(9); // Remove '/uploads/'
    } else if (normalizedPath.startsWith('uploads/')) {
      return normalizedPath.substring(8); // Remove 'uploads/'
    }
    
    return normalizedPath;
  }
};

export default config;