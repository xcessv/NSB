import React, { useState } from 'react';
import ProfileModalService from './ProfileModalService';
import config from '../../config';

const ProfileImage = ({ 
  user,
  size = 'md',
  className = '',
  clickable = true,
  showModal = true
}) => {
  const [imageError, setImageError] = useState(false);
  
  // Size classes mapping
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
    '2xl': 'w-16 h-16'
  };

  const containerClasses = `
    ${sizeClasses[size]} 
    rounded-full 
    overflow-hidden
    ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-primary transition-all' : ''}
    ${className}
  `.trim();

  const handleClick = () => {
    if (!clickable || !showModal) return;
    
    // Only open modal if we have a valid user with an _id
    if (user && (typeof user._id === 'string' || 
       (typeof user._id === 'object' && user._id !== null && 
        (user._id.id || user._id._id || user._id.userId)))) {
      // Use our ProfileModalService to open the modal
      ProfileModalService.openModal(user);
    } else {
      console.warn('Cannot show profile - invalid user ID:', user?._id);
    }
  };

  // Ensure we have a valid user object to work with
  const safeUser = user || { displayName: 'User' };

  // Custom function to handle profile image paths properly
  const getProfileImageUrl = (user) => {
    if (!user) return '/images/default-avatar.png';
    if (!user.profileImage) return '/images/default-avatar.png';
    
    let imagePath = user.profileImage;
    
    // Fix absolute file paths (which should never be exposed to browser)
    if (imagePath.includes(':\\') || imagePath.startsWith('C:/') || imagePath.startsWith('/C:/')) {
      console.log('Converting absolute path to relative for user profile:', user.displayName);
      // Extract just the filename as a fallback
      const filename = imagePath.split(/[/\\]/).pop();
      imagePath = `/uploads/profiles/${filename}`;
    }
    
    // Handle direct URLs
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // Clean up the path
    if (imagePath.startsWith('/api/')) {
      imagePath = imagePath.slice(4);
    }
    
    // Ensure path starts with /uploads/
    if (!imagePath.startsWith('/uploads/')) {
      imagePath = `/uploads/${imagePath}`;
    }
    
    // Clean up any duplicate paths
    imagePath = imagePath.replace(/\/uploads\/uploads\//, '/uploads/');
    
    // Create base URL without API suffix
    const baseUrl = config.API_URL.endsWith('/api/') 
      ? config.API_URL.slice(0, -5)  // Remove trailing "/api/"
      : config.API_URL.endsWith('/api') 
        ? config.API_URL.slice(0, -4)  // Remove trailing "/api"
        : config.API_URL;
    
    return `${baseUrl}${imagePath}`;
  };

  return (
    <div 
      className={containerClasses}
      onClick={handleClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {imageError ? (
        <img
          src="/images/default-avatar.png"
          alt={safeUser.displayName || 'User profile'}
          className="w-full h-full object-cover"
        />
      ) : (
        <img
          src={getProfileImageUrl(safeUser)}
          alt={safeUser.displayName || 'User profile'}
          className="w-full h-full object-cover"
          onError={(e) => {
            console.error('ProfileImage error loading:', safeUser.displayName, 'Source:', e.target.src);
            setImageError(true);
            e.target.onerror = null; // Prevent infinite error loops
          }}
        />
      )}
    </div>
  );
};

export default ProfileImage;