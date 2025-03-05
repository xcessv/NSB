// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Review = require('../models/Review');
const User = require('../models/User');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const notificationService = require('../services/notificationService');

// Create a new report
router.post('/reports', requireAuth, async (req, res) => {
  try {
    // Get content preview based on content type
    let contentPreview = '';
    const { contentType, contentId } = req.body;
    
    if (contentType === 'review') {
      const review = await Review.findById(contentId);
      if (review) {
        contentPreview = review.introComments 
          ? review.introComments.substring(0, 150) 
          : `${review.beefery} review with rating ${review.rating}/10`;
      }
    } else if (contentType === 'comment') {
      // Find the review containing this comment
      const review = await Review.findOne({ 'comments._id': contentId });
      if (review) {
        const comment = review.comments.id(contentId);
        if (comment) {
          contentPreview = comment.text ? comment.text.substring(0, 150) : 'Comment with media';
        }
      }
    } else if (contentType === 'user') {
      const user = await User.findById(contentId);
      if (user) {
        contentPreview = `User: ${user.displayName}`;
      }
    }

    const report = new Report({
      type: contentType,
      contentId: contentId,
      contentPreview: contentPreview || 'Content preview unavailable',
      reason: req.body.reason,
      additionalInfo: req.body.additionalInfo,
      reportedBy: req.user._id
    });

    await report.save();
    
    // Notify admins about new report
    try {
      const admins = await User.find({ role: 'admin' }).select('_id');
      for (const admin of admins) {
        await notificationService.createNotification({
          type: 'report',
          recipient: admin._id,
          data: {
            reportId: report._id,
            contentType: report.type,
            reason: report.reason
          },
          message: `New ${report.type} report: ${report.reason}`
        });
      }
    } catch (notifyError) {
      console.error('Error notifying admins about report:', notifyError);
      // Continue anyway - report is created
    }

    res.status(201).json(report);
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ message: 'Failed to create report' });
  }
});

// Get reports (admin only)
router.get('/admin/reports', requireAdmin, async (req, res) => {
  try {
    const { filter = 'pending', type, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { status: filter };
    
    // Add type filter if provided
    if (type && type !== 'all') {
      query.type = type;
    }

    const reports = await Report.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('reportedBy', 'displayName profileImage')
      .populate('resolvedBy', 'displayName profileImage');

    const total = await Report.countDocuments(query);

    res.json({
      reports,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ message: 'Failed to fetch reports' });
  }
});

// Handle report (admin only)
router.post('/admin/reports/:id/action', requireAdmin, async (req, res) => {
  try {
    const { action } = req.body;
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    switch (action) {
      case 'dismiss':
        report.status = 'dismissed';
        report.resolution = 'dismissed';
        break;
      case 'reviewing':
        report.status = 'reviewing';
        break;
      case 'resolve':
        report.status = 'resolved';
        report.resolution = 'removed';
        
        // Take action on the reported content
        if (report.type === 'review') {
          await handleReportedReview(report.contentId);
        } else if (report.type === 'comment') {
          await handleReportedComment(report.contentId);
        } else if (report.type === 'user') {
          await handleReportedUser(report.contentId);
        }
        break;
      default:
        return res.status(400).json({ message: 'Invalid action' });
    }

    report.resolvedBy = req.user._id;
    report.resolvedDate = new Date();

    await report.save();
    res.json(report);
  } catch (error) {
    console.error('Handle report error:', error);
    res.status(500).json({ message: 'Failed to handle report' });
  }
});

// Helper functions to handle reported content
async function handleReportedReview(reviewId) {
  try {
    // We could either delete the review or flag it as inappropriate
    // For now, let's just remove it
    await Review.findByIdAndDelete(reviewId);
  } catch (error) {
    console.error('Error handling reported review:', error);
    throw error;
  }
}

async function handleReportedComment(commentId) {
  try {
    // Find the review containing this comment
    const review = await Review.findOne({ 'comments._id': commentId });
    if (!review) return;
    
    // Remove the comment
    review.comments.pull(commentId);
    await review.save();
  } catch (error) {
    console.error('Error handling reported comment:', error);
    throw error;
  }
}

async function handleReportedUser(userId) {
  try {
    // For users, we might want to ban them or flag for review
    await User.findByIdAndUpdate(userId, { banned: true });
  } catch (error) {
    console.error('Error handling reported user:', error);
    throw error;
  }
}

// Get report counts by status
router.get('/admin/report-counts', requireAdmin, async (req, res) => {
  try {
    const counts = await Report.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      pending: 0,
      reviewing: 0,
      resolved: 0,
      dismissed: 0
    };

    counts.forEach(item => {
      result[item._id] = item.count;
    });

    res.json(result);
  } catch (error) {
    console.error('Get report counts error:', error);
    res.status(500).json({ message: 'Failed to fetch report counts' });
  }
});

module.exports = router;