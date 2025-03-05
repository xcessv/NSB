// services/notificationService.js
const Notification = require('../models/Notification');
const User = require('../models/User');

// Simple notification service without Firebase dependencies
const notificationService = {
  /**
   * Create a new notification
   * @param {Object} data - Notification data
   * @returns {Promise<Object>} Created notification
   */
  async createNotification(data) {
    try {
      console.log('Creating notification with data:', JSON.stringify(data, null, 2));
      
      const { type, sender, recipient, reviewId, reviewTitle, commentId, commentContent } = data;

      // Don't create notification if sender is recipient
      if (sender.id.toString() === recipient.toString()) {
        console.log('Skipping notification - sender is recipient');
        return null;
      }

      // Ensure we have a valid ID for the target
      const targetId = commentId || reviewId;
      if (!targetId) {
        console.error('Missing target.id - both commentId and reviewId are undefined');
        return null;
      }

      // Create the notification
      const notification = new Notification({
        type,
        sender: {
          id: sender.id,
          displayName: sender.displayName,
          profileImage: sender.profileImage
        },
        recipient,
        target: {
          type: commentId ? 'comment' : 'review',
          id: targetId,
          beefery: reviewTitle || 'Unknown',
          content: commentContent || ''
        },
        read: false,
        date: new Date()
      });

      console.log('Saving notification...');
      await notification.save();
      console.log('Notification created successfully:', notification._id);
      return notification;
    } catch (error) {
      console.error('Create notification error:', error);
      return null;
    }
  },

  /**
   * Send notification for review likes
   * @param {Object} sender - Sender user
   * @param {Object} recipient - Recipient user ID
   * @param {Object} review - Review object
   * @returns {Promise<Object>} Created notification
   */
  async sendReviewLikeNotification(sender, recipient, review) {
    return this.createNotification({
      type: 'review_like',
      sender,
      recipient,
      reviewId: review._id,
      reviewTitle: review.beefery
    });
  },

  /**
   * Send notification for comment likes
   * @param {Object} sender - Sender user
   * @param {string} recipient - Recipient user ID
   * @param {Object} review - Review containing the comment
   * @param {Object} comment - Comment object
   * @returns {Promise<Object>} Created notification
   */
  async sendCommentLikeNotification(sender, recipient, review, comment) {
    return this.createNotification({
      type: 'comment_like',
      sender,
      recipient,
      reviewId: review._id,
      reviewTitle: review.beefery,
      commentId: comment._id,
      commentContent: comment.text
    });
  },

  /**
   * Send notification for review comments
   * @param {Object} sender - Sender user
   * @param {string} recipient - Recipient user ID
   * @param {Object} review - Review object
   * @param {Object} comment - Comment object
   * @returns {Promise<Object>} Created notification
   */
  async sendReviewCommentNotification(sender, recipient, review, comment) {
    return this.createNotification({
      type: 'review_comment',
      sender,
      recipient,
      reviewId: review._id,
      reviewTitle: review.beefery,
      commentId: comment._id,
      commentContent: comment.text
    });
  },

  /**
   * Send notification for comment replies
   * @param {Object} sender - Sender user
   * @param {string} recipient - Recipient user ID
   * @param {Object} review - Review containing the comment
   * @param {Object} comment - Comment object
   * @param {string} parentCommentId - Parent comment ID
   * @returns {Promise<Object>} Created notification
   */
  async sendCommentReplyNotification(sender, recipient, review, comment, parentCommentId) {
    return this.createNotification({
      type: 'comment_reply',
      sender,
      recipient,
      reviewId: review._id,
      reviewTitle: review.beefery,
      commentId: comment._id,
      commentContent: comment.text,
      parentCommentId: parentCommentId
    });
  },

  /**
   * Send notification for news likes
   * @param {Object} sender - Sender user
   * @param {string} recipient - Recipient user ID
   * @param {Object} news - News object
   * @returns {Promise<Object>} Created notification
   */
  async sendNewsLikeNotification(sender, recipient, news) {
    return this.createNotification({
      type: 'news_like',
      sender,
      recipient,
      reviewId: news._id, // Using reviewId for news ID
      reviewTitle: news.title // Using reviewTitle for news title
    });
  },

  /**
   * Get user's notifications with pagination
   * @param {string} userId - User ID
   * @param {Object} options - Options for pagination
   * @returns {Promise<Object>} Notifications with pagination info
   */
  async getUserNotifications(userId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find({ recipient: userId })
          .sort({ date: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Notification.countDocuments({ recipient: userId }),
        Notification.countDocuments({ 
          recipient: userId,
          read: false 
        })
      ]);

      return {
        notifications,
        unreadCount,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      console.error('Get user notifications error:', error);
      throw error;
    }
  },

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated notification
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          recipient: userId
        },
        { $set: { read: true } },
        { new: true }
      );

      if (!notification) {
        throw new Error('Notification not found');
      }

      return notification;
    } catch (error) {
      console.error('Mark notification as read error:', error);
      throw error;
    }
  },

  /**
   * Mark all user's notifications as read
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Update result
   */
  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { recipient: userId, read: false },
        { $set: { read: true } }
      );

      return { 
        success: true,
        count: result.modifiedCount
      };
    } catch (error) {
      console.error('Mark all as read error:', error);
      throw error;
    }
  },

  /**
   * Get unread notification count
   * @param {string} userId - User ID
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount(userId) {
    try {
      return await Notification.countDocuments({
        recipient: userId,
        read: false
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      throw error;
    }
  },

  /**
   * Delete a notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} Success status
   */
  async deleteNotification(notificationId, userId) {
    try {
      const result = await Notification.deleteOne({
        _id: notificationId,
        recipient: userId
      });

      return result.deletedCount > 0;
    } catch (error) {
      console.error('Delete notification error:', error);
      throw error;
    }
  },

  /**
   * Delete all notifications for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of deleted notifications
   */
  async deleteAllUserNotifications(userId) {
    try {
      const result = await Notification.deleteMany({
        recipient: userId
      });

      return result.deletedCount;
    } catch (error) {
      console.error('Delete all notifications error:', error);
      throw error;
    }
  },

  /**
   * Delete notifications related to specific content
   * @param {string} contentId - Content ID (review, comment)
   * @returns {Promise<number>} Number of deleted notifications
   */
  async deleteContentNotifications(contentId) {
    try {
      const result = await Notification.deleteMany({
        $or: [
          { 'target.id': contentId },
          { 'target.reviewId': contentId }
        ]
      });

      return result.deletedCount;
    } catch (error) {
      console.error('Delete content notifications error:', error);
      throw error;
    }
  }
};

module.exports = notificationService;