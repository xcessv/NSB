// models/Notification.js
const mongoose = require('mongoose');

/**
 * Notification Schema
 * Represents user notifications for activities like 
 * likes, comments, replies and other interactions
 */
const notificationSchema = new mongoose.Schema({
  /**
   * User receiving the notification
   */
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  /**
   * Type of notification
   * - review_like: Someone liked user's review
   * - comment_like: Someone liked user's comment
   * - review_comment: Someone commented on user's review
   * - comment_reply: Someone replied to user's comment
   * - new_review: Someone posted a new review (for followers)
   * - new_user: A new user joined (for admins)
   * - news_like: Someone liked user's news post
   * - poll_vote: Someone voted on user's poll
   */
  type: {
    type: String,
    enum: [
      'review_like', 
      'comment_like', 
      'review_comment', 
      'comment_reply',
      'new_review',
      'new_user',
      'news_like',
      'poll_vote',
      'test' // For testing
    ],
    required: true,
    index: true
  },
  
  /**
   * User who initiated the action
   */
  sender: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    displayName: { 
      type: String, 
      required: true 
    },
    profileImage: String
  },
  
  /**
   * Target object of the notification
   */
  target: {
    /**
     * Type of content involved
     */
    type: {
      type: String,
      enum: ['review', 'comment', 'news', 'test'],
      required: true
    },
    
    /**
     * ID of the content (review, comment, news)
     */
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    
    /**
     * Parent review ID (useful for comments)
     */
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review'
    },
    
    /**
     * Name of the beefery for review notifications
     */
    beefery: String,
    
    /**
     * Content text for comment notifications
     */
    content: String,
    
    /**
     * News title for news notifications
     */
    title: String
  },
  
  /**
   * Whether the notification has been read
   */
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  
  /**
   * Timestamp of the notification
   */
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  /**
   * Additional metadata for the notification
   * Can store custom data specific to notification type
   */
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Compound index for efficient querying of unread notifications
notificationSchema.index({ recipient: 1, read: 1, date: -1 });
notificationSchema.index({ type: 1, recipient: 1 });
notificationSchema.index({ 'target.id': 1 });

// Virtual for time elapsed since notification
notificationSchema.virtual('timeElapsed').get(function() {
  const now = new Date();
  const diff = now - this.date;
  
  // Convert to seconds
  const seconds = Math.floor(diff / 1000);
  
  // Less than a minute
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  
  // Convert to minutes
  const minutes = Math.floor(seconds / 60);
  
  // Less than an hour
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  
  // Convert to hours
  const hours = Math.floor(minutes / 60);
  
  // Less than a day
  if (hours < 24) {
    return `${hours}h ago`;
  }
  
  // Convert to days
  const days = Math.floor(hours / 24);
  
  // Less than a week
  if (days < 7) {
    return `${days}d ago`;
  }
  
  // Format date
  return this.date.toLocaleDateString();
});

// Methods
notificationSchema.methods.markAsRead = async function() {
  this.read = true;
  return this.save();
};

// Static methods
notificationSchema.statics.findUnreadByUser = function(userId) {
  return this.find({ recipient: userId, read: false }).sort({ date: -1 });
};

notificationSchema.statics.countUnreadByUser = function(userId) {
  return this.countDocuments({ recipient: userId, read: false });
};

notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { recipient: userId, read: false },
    { $set: { read: true } }
  );
};

module.exports = mongoose.model('Notification', notificationSchema);