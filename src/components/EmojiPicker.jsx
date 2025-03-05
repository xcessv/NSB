import React, { useState, useEffect, useRef } from 'react';
import Picker from 'emoji-picker-react';
import { Smile } from 'lucide-react';
import PropTypes from 'prop-types';

/**
 * Enhanced Emoji Picker component with mobile support
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onEmojiSelect - Function to handle emoji selection
 * @param {string} props.buttonClassName - Optional CSS classes for button
 * @param {boolean} props.isMobile - Whether component is in mobile view
 * @param {Array} props.recentEmojis - Array of recently used emojis
 */
const EmojiPicker = ({ 
  onEmojiSelect, 
  buttonClassName = "",
  isMobile = false,
  recentEmojis = ['🔥', '😊', '👍', '🥩', '⭐', '💯'] 
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);
  const buttonRef = useRef(null);

  // Handle clicking outside to close the picker
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        pickerRef.current && 
        !pickerRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add ESC key handler
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showPicker) {
        setShowPicker(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showPicker]);

  // Handle emoji selection
  const handleEmojiClick = (event, emojiObject) => {
    onEmojiSelect(emojiObject.emoji);
    setShowPicker(false);
  };

  // Quick selection of recent emojis
  const renderRecentEmojis = () => {
    if (!showPicker) return null;
    
    return (
      <div className="absolute z-50 bottom-full right-0 mb-2 bg-card p-2 rounded-lg shadow-lg border border-border">
        <div className="grid grid-cols-6 gap-1">
          {recentEmojis.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onEmojiSelect(emoji);
                setShowPicker(false);
              }}
              className="p-1 hover:bg-secondary rounded text-2xl emoji-reaction"
              aria-label={`Insert ${emoji} emoji`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative inline-block emoji-picker-container">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className={`text-muted-foreground hover:text-foreground transition-colors ${buttonClassName}`}
        aria-label="Insert emoji"
      >
        <Smile className="h-5 w-5" />
      </button>
      
      {/* Quick selection for recent emojis */}
      {renderRecentEmojis()}
      
      {/* Full emoji picker */}
      {showPicker && (
        <div 
          ref={pickerRef}
          className={`absolute z-50 ${
            isMobile ? 'emoji-picker-mobile' : 'bottom-full right-0 mb-2'
          }`}
        >
          {isMobile && <div className="emoji-picker-handle" />}
          <Picker 
            onEmojiClick={handleEmojiClick}
            disableAutoFocus={true}
            native={true}
            searchPlaceholder="Search emojis..."
          />
        </div>
      )}
    </div>
  );
};

EmojiPicker.propTypes = {
  onEmojiSelect: PropTypes.func.isRequired,
  buttonClassName: PropTypes.string,
  isMobile: PropTypes.bool,
  recentEmojis: PropTypes.arrayOf(PropTypes.string)
};

export default EmojiPicker;
