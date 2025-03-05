import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { X, Image as ImageIcon, Paperclip, Send, Loader, Smile, AlertCircle } from 'lucide-react';
import ProfileImage from '../user/ProfileImage';
import EmojiPicker from 'emoji-picker-react';
import { refreshActivities } from '../../services/api';
import config from '../../config';

// Constants
const VALID_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/x-gif',
  'application/x-gif'
];

const ERROR_MESSAGES = {
  FILE_TYPE: 'Please select an image file (JPEG, PNG, GIF, or WEBP)',
  FILE_SIZE: 'File is too large. Maximum size is 10MB.',
  FILE_READ: 'Error reading file preview',
  SUBMIT: 'Failed to submit comment'
};

const CommentForm = ({ 
  currentUser, 
  onSubmit,
  placeholder = "Write a comment...",
  isReply = false,
  parentId = null,
  onCancel = null,
  maxImageSize = 50 * 1024 * 1024, // 50MB default
  reviewId = null  // Add reviewId as a prop
}) => {
  // State declarations
  const [text, setText] = useState('');
  const [media, setMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [error, setError] = useState(null);

  // Refs
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiButtonRef = useRef(null);

  // Click outside handler for emoji picker
  const handleClickOutside = (e) => {
    if (showEmojiPicker && 
        emojiButtonRef.current && 
        !emojiButtonRef.current.contains(e.target)) {
      setShowEmojiPicker(false);
    }
  };

  React.useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showEmojiPicker]);
  
  const handleMediaSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Clear any previous errors
    setError(null);

    // Validate file type and size
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      setError(ERROR_MESSAGES.FILE_TYPE);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (file.size > maxSize) {
      setError(ERROR_MESSAGES.FILE_SIZE);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setMedia(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result);
    };
    reader.onerror = () => {
      setError(ERROR_MESSAGES.FILE_READ);
      setMedia(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const removeMedia = () => {
    setMedia(null);
    setMediaPreview('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEmojiSelect = (emojiData, event) => {
    const { selectionStart, selectionEnd } = textareaRef.current;
    const newText = 
      text.slice(0, selectionStart) + 
      emojiData.emoji + 
      text.slice(selectionEnd);
    
    setText(newText);
    
    // Close emoji picker and focus textarea
    setShowEmojiPicker(false);
    textareaRef.current.focus();
    
    // Set cursor position after emoji
    const newCursorPosition = selectionStart + emojiData.emoji.length;
    setTimeout(() => {
      textareaRef.current.selectionStart = newCursorPosition;
      textareaRef.current.selectionEnd = newCursorPosition;
    }, 0);
  };

  // Reset form function
  const resetForm = () => {
    setText('');
    setMedia(null);
    setMediaPreview('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowEmojiPicker(false);
  };

  const handleSubmit = async (e) => {
  // This is crucial - prevent the default form submission
  e.preventDefault();
  
  const trimmedText = text.trim();
  
  // Allow submission if there's either text or media
  if ((!trimmedText && !media) || isSubmitting) return;

  try {
    setIsSubmitting(true);
    setError(null);
    
    const formData = new FormData();
    
    // Add required fields to the form data
    if (trimmedText) {
      formData.append('text', trimmedText);
    }
    
    if (parentId) {
      formData.append('parentId', parentId);
    }
    
    if (media) {
      formData.append('commentMedia', media, media.name);
    }
    
    // Add reviewId if provided directly to this component
    if (reviewId) {
      formData.append('reviewId', reviewId);
    }

    // Debug log what we're about to submit
    console.log('Submitting comment: reviewId=', reviewId || 'from parent', 
      'text=', trimmedText?.substring(0, 20) + (trimmedText?.length > 20 ? '...' : ''),
      'parentId=', parentId || 'none',
      'hasMedia=', !!media);
    
    // IMPORTANT: Make a direct API call if reviewId is available
    if (reviewId) {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Authentication required');
        
        const response = await fetch(`${config.API_URL}/reviews/${reviewId}/comment`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to add comment');
        }
        
        const updatedReview = await response.json();
        
        // Reset form immediately to give feedback
        resetForm();
        
        // Close reply form if needed
        if (isReply && onCancel) {
          onCancel();
        }
        
        // Now inform the parent component
        try {
          await onSubmit(updatedReview);
        } catch (e) {
          console.warn('Parent handler error (non-critical):', e);
        }
        
        // Try to refresh activities
        try {
          await refreshActivities();
        } catch (activityError) {
          console.error('Failed to refresh activities:', activityError);
        }
        
        return updatedReview;
      } catch (directApiError) {
        console.error('Direct API call error:', directApiError);
        throw directApiError;
      }
    } else {
      // No reviewId available, use the provided onSubmit handler
      const result = await onSubmit(formData);
      
      // Reset form
      resetForm();
      
      // Close reply form if needed
      if (isReply && onCancel) {
        onCancel();
      }

      try {
        await refreshActivities();
      } catch (activityError) {
        console.error('Failed to refresh activities:', activityError);
      }

      return result;
    }
  } catch (error) {
    console.error('Comment submission error:', error);
    setError(error.message || ERROR_MESSAGES.SUBMIT);
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <form onSubmit={handleSubmit} className={`flex ${isReply ? 'pl-10' : ''}`}>
      <div className="flex-shrink-0 mr-3">
        <ProfileImage
          user={currentUser}
          size={isReply ? "sm" : "md"}
          clickable={false}
        />
      </div>
      
      <div className="flex-grow space-y-2">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 p-2 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        
        <div className="relative flex items-center">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="w-full p-3 pr-32 min-h-[80px] max-h-[200px] border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
            disabled={isSubmitting}
          />
          
          <div className="absolute right-2 flex space-x-1">
            <div className="relative" ref={emojiButtonRef}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-secondary transition-colors"
                disabled={isSubmitting}
                title="Add emoji"
              >
                <Smile className="h-5 w-5" />
              </button>
              
              {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-2 z-50">
                  <EmojiPicker
                    onEmojiClick={handleEmojiSelect}
                    lazyLoadEmojis={true}
                    searchPlaceHolder="Search emojis..."
                  />
                </div>
              )}
            </div>

            <div className="relative group">
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-secondary transition-colors"
                disabled={isSubmitting}
                title="Add image or GIF"
              >
                <ImageIcon className="h-5 w-5" />
              </button>
              <div className="absolute bottom-full mb-2 right-0 invisible group-hover:visible bg-card shadow-lg rounded-lg p-2 text-xs whitespace-nowrap">
                Supported: JPG, PNG, GIF, WebP (max 10MB)
              </div>
            </div>
            
            <button
              type="submit"
              disabled={(!text.trim() && !media) || isSubmitting}
              className="p-2 text-primary hover:bg-secondary rounded-full transition-colors disabled:opacity-50"
              title="Send comment"
            >
              {isSubmitting ? (
                <Loader className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleMediaSelect}
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
          />
        </div>

        {mediaPreview && (
          <div className="relative inline-block">
            <img
              src={mediaPreview}
              alt="Media preview"
              className="max-h-40 rounded-lg border border-border"
            />
            <button
              type="button"
              onClick={removeMedia}
              className="absolute -top-2 -right-2 p-1 bg-background rounded-full border border-border shadow-sm hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {isReply && onCancel && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onCancel();
              }}
              className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </form>
  );
};

CommentForm.propTypes = {
  currentUser: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    profileImage: PropTypes.string,
    role: PropTypes.string
  }).isRequired,
  onSubmit: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  isReply: PropTypes.bool,
  parentId: PropTypes.string,
  onCancel: PropTypes.func,
  maxImageSize: PropTypes.number,
  reviewId: PropTypes.string
};

export default CommentForm;