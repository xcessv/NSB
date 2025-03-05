import React, { useState } from 'react';
import PropTypes from 'prop-types';
import config from '../../config';

// Improved NewsMedia component with robust error handling and proper sizing
const NewsMedia = ({ 
  imageUrl, 
  title = '', 
  className = "w-full h-48" 
}) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  if (!imageUrl || error) return null;

  // Clean up image URL to handle different formats
  const getCleanMediaUrl = (url) => {
    if (!url) return null;
    
    // Debug
    console.log('NewsMedia processing URL:', url);
    
    // If it's already a full URL, return it
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Handle relative path
    try {
      const baseUrl = config.API_URL.endsWith('/api/') 
        ? config.API_URL.slice(0, -5)  // Remove trailing "/api/"
        : config.API_URL.endsWith('/api') 
          ? config.API_URL.slice(0, -4)  // Remove trailing "/api"
          : config.API_URL;
      
      // Clean up the path - handle common issues
      let path = url;
      
      // Handle absolute file paths (like C:/Users/...)
      if (path.includes(':/') || path.includes(':\\') || path.match(/^\/[A-Za-z]:/)) {
        // Extract just the filename
        const parts = path.split(/[/\\]/);
        const filename = parts[parts.length - 1];
        path = `/uploads/news/${filename}`;
        console.log('Converted file path to:', path);
      }
      
      // Other cleanup
      path = path.replace(/\/uploads\/uploads\//, '/uploads/');
      path = path.replace(/^\/api\//, '');
      
      if (!path.startsWith('/uploads/')) {
        path = `/uploads/${path}`;
      }
      
      // Remove duplicate slashes
      path = path.replace(/\/\//g, '/');
      
      const fullUrl = `${baseUrl}${path}`;
      console.log('Final media URL:', fullUrl);
      return fullUrl;
    } catch (error) {
      console.error('Error generating media URL:', error, url);
      return url;
    }
  };

  const mediaUrl = getCleanMediaUrl(imageUrl);
  
  return (
    <div className={`relative ${className} ${loaded ? '' : 'bg-gray-100 animate-pulse'}`}>
      <img
        src={mediaUrl}
        alt={title || 'News image'}
        className={`absolute inset-0 w-full h-full object-cover rounded-lg transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          console.error('News image load error:', {
            src: e.target.src,
            originalUrl: imageUrl
          });
          setError(true);
        }}
      />
    </div>
  );
};

NewsMedia.propTypes = {
  imageUrl: PropTypes.string.isRequired,
  title: PropTypes.string,
  className: PropTypes.string
};

export default NewsMedia;