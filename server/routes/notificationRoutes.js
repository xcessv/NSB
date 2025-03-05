// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const Notification = require('../models/Notification');
const User = require('../models/User');
const mongoose = require('mongoose');
const notificationService = require('../services/notificationService');

// Debug middleware
router.use((req, res, next) => {
  console.log(`[Notification Route] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

/**
 * @route POST /notifications/test
 * @desc Create a test notification directly
 * @access Private
 */
router.post('/test', requireAuth, async (req, res) => {
  try {
    console.log('=== TEST NOTIFICATION ROUTE ===');
    console.log('User:', req.user._id, req.user.displayName);
    
    // Create a notification document directly
    const notification = new Notification({
      type: 'test',
      sender: {
        id: req.user._id,
        displayName: req.user.displayName,
        profileImage: req.user.profileImage
      },
      recipient: req.user._id, // Send to self for testing
      target: {
        type: 'test',
        id: new mongoose.Types.ObjectId(), // Generate a random ID
        beefery: 'Test Notification',
        content: 'This is a test notification'
      },
      read: false,
      date: new Date()
    });
    
    console.log('Saving test notification to database...');
    await notification.save();
    console.log('Test notification saved with ID:', notification._id);
    
    res.status(201).json({
      message: 'Test notification created successfully',
      notification
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ 
      message: 'Failed to create test notification',
      error: error.message
    });
  }
});

/**
 * @route GET /notifications
 * @desc Get user's notifications with pagination
 * @access Private
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Get notifications with pagination
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ date: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Get total count and unread count
    const [total, unreadCount] = await Promise.all([
      Notification.countDocuments({ recipient: req.user._id }),
      Notification.countDocuments({ 
        recipient: req.user._id,
        read: false 
      })
    ]);

    res.json({
      notifications,
      unreadCount,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

/**
 * @route GET /notifications/unread-count
 * @desc Get unread notification count
 * @access Private
 */
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Get count of unread notifications
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Failed to get unread count' });
  }
});

/**
 * @route PUT /notifications/:id/read
 * @desc Mark single notification as read
 * @access Private
 */
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    // Find and update notification
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user._id
      },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
});

/**
 * @route PUT /notifications/mark-all-read
 * @desc Mark all notifications as read
 * @access Private
 */
router.put('/mark-all-read', requireAuth, async (req, res) => {
  try {
    // Update all unread notifications for user
    const result = await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } }
    );

    res.json({ 
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read' });
  }
});

/**
 * @route DELETE /notifications/:id
 * @desc Delete notification
 * @access Private
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // Delete notification
    const result = await Notification.deleteOne({
      _id: req.params.id,
      recipient: req.user._id
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Failed to delete notification' });
  }
});

/**
 * @route DELETE /notifications/clear-all
 * @desc Delete all user's notifications
 * @access Private
 */
router.delete('/clear-all', requireAuth, async (req, res) => {
  try {
    // Delete all notifications for the user
    const result = await Notification.deleteMany({
      recipient: req.user._id
    });

    res.json({ 
      message: 'All notifications cleared successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({ message: 'Failed to clear notifications' });
  }
});

/**
 * @route GET /notifications/types
 * @desc Get notification types for filtering
 * @access Private
 */
router.get('/types', requireAuth, async (req, res) => {
  try {
    // Return available notification types for filtering
    const types = [
      { id: 'review_like', label: 'Review Likes' },
      { id: 'comment_like', label: 'Comment Likes' },
      { id: 'review_comment', label: 'Review Comments' },
      { id: 'comment_reply', label: 'Comment Replies' },
      { id: 'news_like', label: 'News Likes' }
    ];

    res.json({ types });
  } catch (error) {
    console.error('Get notification types error:', error);
    res.status(500).json({ message: 'Failed to fetch notification types' });
  }
});

/**
 * @route GET /notifications/filtered
 * @desc Get filtered notifications
 * @access Private
 */
router.get('/filtered', requireAuth, async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    
    // Build query
    const query = { recipient: req.user._id };
    
    // Add type filter if provided
    if (type && type !== 'all') {
      query.type = type;
    }
    
    // Get filtered notifications with pagination
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ date: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      Notification.countDocuments(query)
    ]);
    
    res.json({
      notifications,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get filtered notifications error:', error);
    res.status(500).json({ message: 'Failed to fetch filtered notifications' });
  }
});

/**
 * @route GET /notifications/admin/summary
 * @desc Get notification summary (admin only)
 * @access Admin
 */
router.get('/admin/summary', requireAdmin, async (req, res) => {
  try {
    // Get notification counts by type
    const counts = await Notification.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get total and unread counts
    const [total, unread] = await Promise.all([
      Notification.countDocuments(),
      Notification.countDocuments({ read: false })
    ]);
    
    res.json({
      total,
      unread,
      typeCounts: counts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Get notification summary error:', error);
    res.status(500).json({ message: 'Failed to fetch notification summary' });
  }
});

/**
 * @route POST /notifications/test
 * @desc Create a test notification (for development)
 * @access Private
 */
router.post('/test', requireAuth, async (req, res) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Test notifications not allowed in production' });
    }

    const { type = 'test', recipientId } = req.body;
    
    // Determine recipient (can be specified or current user)
    const recipient = recipientId || req.user._id;
    
    // Create notification
    const notification = new Notification({
      type,
      sender: {
        id: req.user._id,
        displayName: req.user.displayName,
        profileImage: req.user.profileImage
      },
      recipient,
      target: {
        type: 'test',
        id: new mongoose.Types.ObjectId(),
        beefery: 'Test Beefery',
        content: 'This is a test notification'
      },
      read: false,
      date: new Date()
    });
    
    await notification.save();
    
    res.status(201).json({
      message: 'Test notification created',
      notification
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ message: 'Failed to create test notification' });
  }
});

// Helper function to create notifications
const createNotification = async (data) => {
  try {
    const { type, sender, recipient, reviewId, reviewTitle, commentId = null } = data;

    // Don't create notification if sender is recipient
    if (sender.id.toString() === recipient.toString()) {
      return null;
    }

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
        id: commentId || reviewId,
        beefery: reviewTitle,
        reviewId: reviewId // Store the parent review ID even for comments
      },
      read: false,
      date: new Date()
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
};

// Create a separate notifications service for internal route use
const localNotificationService = {
  createNotification,
  
  async sendReviewNotification(type, sender, recipient, review) {
    return createNotification({
      type,
      sender,
      recipient,
      reviewId: review._id,
      reviewTitle: review.beefery
    });
  },

  async sendCommentNotification(sender, recipient, review, commentId) {
    return createNotification({
      type: 'comment',
      sender,
      recipient,
      reviewId: review._id,
      reviewTitle: review.beefery,
      commentId
    });
  },
  
  async sendCommentLikeNotification(sender, recipient, review, comment) {
    return createNotification({
      type: 'comment_like',
      sender,
      recipient,
      reviewId: review._id,
      reviewTitle: review.beefery,
      commentId: comment._id
    });
  },
  
  async sendCommentReplyNotification(sender, recipient, review, comment) {
    return createNotification({
      type: 'comment_reply',
      sender,
      recipient,
      reviewId: review._id,
      reviewTitle: review.beefery,
      commentId: comment._id
    });
  }
};

// Export both the router and the service
module.exports = {
  router,
  notificationService: localNotificationService
};