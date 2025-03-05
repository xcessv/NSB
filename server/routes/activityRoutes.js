const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/adminMiddleware');
const Activity = require('../models/Activity');
const { ACTIVITY_TYPES } = require('../models/Activity');
const User = require('../models/User');
const Review = require('../models/Review');
const path = require('path');
const activityService = require('../services/activityService');

// Get activity stats
router.get('/activity-stats', requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

    // Fetch current stats
    const [
      activeUsers,
      newReviews,
      currentWeekLikes,
      lastWeekLikes,
      currentWeekComments,
      lastWeekComments,
      totalUsers,
      totalReviews
    ] = await Promise.all([
      User.countDocuments({ lastActive: { $gte: new Date(now - 24 * 60 * 60 * 1000) } }),
      Review.countDocuments({ date: { $gte: weekAgo } }),
      Activity.countDocuments({ 
        type: ACTIVITY_TYPES.REVIEW_LIKE,
        date: { $gte: weekAgo }
      }),
      Activity.countDocuments({
        type: ACTIVITY_TYPES.REVIEW_LIKE,
        date: { $gte: twoWeeksAgo, $lt: weekAgo }
      }),
      Activity.countDocuments({
        type: ACTIVITY_TYPES.REVIEW_COMMENT,
        date: { $gte: weekAgo }
      }),
      Activity.countDocuments({
        type: ACTIVITY_TYPES.REVIEW_COMMENT,
        date: { $gte: twoWeeksAgo, $lt: weekAgo }
      }),
      User.countDocuments(),
      Review.countDocuments()
    ]);

    const likeGrowth = lastWeekLikes === 0 
      ? 100 
      : ((currentWeekLikes - lastWeekLikes) / lastWeekLikes * 100).toFixed(1);

    const commentGrowth = lastWeekComments === 0 
      ? 100 
      : ((currentWeekComments - lastWeekComments) / lastWeekComments * 100).toFixed(1);

    res.json({
      activeUsers,
      newReviews,
      totalLikes: currentWeekLikes,
      totalComments: currentWeekComments,
      likeGrowth: parseFloat(likeGrowth),
      commentGrowth: parseFloat(commentGrowth),
      totalUsers,
      totalReviews
    });
  } catch (error) {
    console.error('Get activity stats error:', error);
    res.status(500).json({ message: 'Failed to fetch activity stats' });
  }
});

// Get activities with filtering and pagination
router.get('/activities', requireAdmin, async (req, res) => {
  try {
    console.log('Fetching activities...');
    const { 
      filter = 'all', 
      page = 1, 
      limit = 20 
    } = req.query;

    const query = {};
    if (filter !== 'all') {
      switch (filter) {
        case 'reviews':
          query.type = ACTIVITY_TYPES.NEW_REVIEW;
          break;
        case 'likes':
          query.type = { $in: [ACTIVITY_TYPES.REVIEW_LIKE, ACTIVITY_TYPES.COMMENT_LIKE, ACTIVITY_TYPES.NEWS_LIKE] };
          break;
        case 'comments':
          query.type = ACTIVITY_TYPES.REVIEW_COMMENT;
          break;
        case 'users':
          query.type = ACTIVITY_TYPES.NEW_USER;
          break;
        case 'news':
          query.type = ACTIVITY_TYPES.NEWS_LIKE; // Show news-related activities
          break;
      }
    }

    console.log('Query:', JSON.stringify(query));

    const [total, activities] = await Promise.all([
      Activity.countDocuments(query),
      Activity.find(query)
        .sort({ date: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate('actor.userId', 'displayName profileImage')
        .populate('subject.userId', 'displayName')
        .lean()
    ]);

    console.log(`Found ${activities.length} activities`);

    // Clean up media URLs
    activities.forEach(activity => {
      if (activity.target?.media?.url) {
        const filename = activity.target.media.url.split(/[/\\]/).pop();
        activity.target.media.url = `/uploads/${filename}`;
      }
    });

    // Make sure all required fields exist to prevent frontend errors
    const processedActivities = activities.map(activity => ({
      ...activity,
      actor: activity.actor || { displayName: 'Unknown User' },
      target: activity.target || {},
      subject: activity.subject || {},
      metadata: activity.metadata || {}
    }));

    res.json({
      activities: processedActivities,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch activities',
      error: error.message 
    });
  }
});

// Get activity summary for charts
router.get('/activity-summary', requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const activities = await Activity.aggregate([
      {
        $match: {
          date: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            type: '$type'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          activities: {
            $push: {
              type: '$_id.type',
              count: '$count'
            }
          }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    res.json({ activities });
  } catch (error) {
    console.error('Get activity summary error:', error);
    res.status(500).json({ message: 'Failed to fetch activity summary' });
  }
});

// Get user activities
router.get('/user/:userId/activities', requireAdmin, async (req, res) => {
  try {
    const activities = await Activity.find({
      $or: [
        { 'actor.userId': req.params.userId },
        { 'subject.userId': req.params.userId }
      ]
    })
    .sort({ date: -1 })
    .limit(50)
    .populate('actor.userId', 'displayName profileImage')
    .populate('subject.userId', 'displayName')
    .lean();

    // Process activities to ensure consistent data structure
    const processedActivities = activities.map(activity => ({
      ...activity,
      actor: activity.actor || { displayName: 'Unknown User' },
      target: activity.target || {},
      subject: activity.subject || {},
      metadata: activity.metadata || {}
    }));

    // Clean up media URLs if present
    processedActivities.forEach(activity => {
      if (activity.target?.media?.url) {
        const filename = activity.target.media.url.split(/[/\\]/).pop();
        activity.target.media.url = `/uploads/${filename}`;
      }
    });

    res.json({ 
      activities: processedActivities,
      total: processedActivities.length
    });
  } catch (error) {
    console.error('Get user activities error:', error);
    res.status(500).json({ message: 'Failed to fetch user activities' });
  }
});

// Get user activity counts
router.get('/user/:userId/activity-counts', requireAdmin, async (req, res) => {
  try {
    const [
      reviews,
      comments,
      likes,
      receivedLikes
    ] = await Promise.all([
      Activity.countDocuments({
        'actor.userId': req.params.userId,
        type: ACTIVITY_TYPES.NEW_REVIEW
      }),
      Activity.countDocuments({
        'actor.userId': req.params.userId,
        type: ACTIVITY_TYPES.REVIEW_COMMENT
      }),
      Activity.countDocuments({
        'actor.userId': req.params.userId,
        type: { $in: [ACTIVITY_TYPES.REVIEW_LIKE, ACTIVITY_TYPES.COMMENT_LIKE] }
      }),
      Activity.countDocuments({
        'subject.userId': req.params.userId,
        type: { $in: [ACTIVITY_TYPES.REVIEW_LIKE, ACTIVITY_TYPES.COMMENT_LIKE] }
      })
    ]);

    res.json({
      reviews,
      comments,
      likes,
      receivedLikes,
      totalActivities: reviews + comments + likes
    });
  } catch (error) {
    console.error('Get user activity counts error:', error);
    res.status(500).json({ message: 'Failed to fetch user activity counts' });
  }
});

// Delete activities for a user
router.delete('/user/:userId/activities', requireAdmin, async (req, res) => {
  try {
    await Activity.deleteMany({
      $or: [
        { 'actor.userId': req.params.userId },
        { 'subject.userId': req.params.userId }
      ]
    });

    res.json({ message: 'User activities deleted successfully' });
  } catch (error) {
    console.error('Delete user activities error:', error);
    res.status(500).json({ message: 'Failed to delete user activities' });
  }
});

router.post('/activities/comment', requireAdmin, async (req, res) => {
  try {
    const { review, comment, actor } = req.body;
    const activity = await activityService.logCommentActivity(actor, review, comment);
    res.json(activity);
  } catch (error) {
    console.error('Log comment activity error:', error);
    res.status(500).json({ message: 'Failed to log comment activity' });
  }
});

// Export only the router
module.exports = router;

// Export ACTIVITY_TYPES separately if needed elsewhere
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;