const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const { handleFileUpload, deleteFile } = require('../middleware/fileMiddleware');
const Review = require('../models/Review');
const User = require('../models/User');
const path = require('path');
const activityService = require('../services/activityService');
const mongoose = require('mongoose');

// Debug middleware
router.use((req, res, next) => {
  console.log(`[Review Route] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Files:', req.files);
  next();
});
// Get reviews with filters
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      minRating, 
      maxRating, 
      sortBy = 'date',
      sortOrder = 'desc',
      page = 1, 
      limit = 10,
      commentId 
    } = req.query;

    const query = {};

    // If commentId is provided, find the review containing this comment
    if (commentId) {
      const review = await Review.findOne({ 'comments._id': commentId })
        .populate('likes', 'displayName username profileImage')
        .populate('comments.likes', 'displayName username profileImage');
      
      if (!review) {
        return res.status(404).json({ message: 'Review not found for this comment' });
      }
      
      return res.json({ reviews: [review] });
    }

    if (search) {
      query.$text = { $search: search };
    }

    if (minRating || maxRating) {
      query.rating = {};
      if (minRating) query.rating.$gte = parseFloat(minRating);
      if (maxRating) query.rating.$lte = parseFloat(maxRating);
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const reviews = await Review.find(query)
      .populate('likes', 'displayName username profileImage')
      .populate('comments.likes', 'displayName username profileImage')
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    // Format ratings to have 2 decimal places
    const formattedReviews = reviews.map(review => {
      const reviewObj = review.toObject();
      reviewObj.rating = parseFloat(reviewObj.rating.toFixed(2));
      return reviewObj;
    });

    res.json({
      reviews: formattedReviews,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

// Get single review
router.get('/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('likes', 'displayName username profileImage')
      .populate('comments.likes', 'displayName username profileImage');

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Format rating to have 2 decimal places
    const reviewObj = review.toObject();
    reviewObj.rating = parseFloat(reviewObj.rating.toFixed(2));

    res.json(reviewObj);
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({ message: 'Failed to fetch review' });
  }
});

// Get comments tree for a review
router.get('/:id/comments', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('comments.likes', 'displayName username profileImage');
    
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Organize comments into a tree structure
    const comments = review.comments;
    const commentsById = {};
    const rootComments = [];

    // First pass: index comments by ID
    comments.forEach(comment => {
      commentsById[comment._id] = {
        ...comment.toObject(),
        children: []
      };
    });

    // Second pass: build the tree
    comments.forEach(comment => {
      if (comment.parentId && commentsById[comment.parentId]) {
        commentsById[comment.parentId].children.push(commentsById[comment._id]);
      } else if (!comment.parentId) {
        rootComments.push(commentsById[comment._id]);
      }
    });

    res.json({
      comments: rootComments
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
});

// Get single comment
router.get('/:id/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('comments.likes', 'displayName username profileImage');
    
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const comment = review.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    res.json(comment);
  } catch (error) {
    console.error('Get comment error:', error);
    res.status(500).json({ message: 'Failed to fetch comment' });
  }
});
// Create review
router.post('/', requireAuth, handleFileUpload('media'), async (req, res) => {
  try {
    const reviewData = {
      userId: req.user._id,
      userDisplayName: req.user.displayName,
      userImage: req.user.profileImage,
      title: req.body.title?.trim() || '',
      introSummary: req.body.introSummary?.trim() || '',
      closingSummary: req.body.closingSummary?.trim() || '',
      beefery: req.body.beefery,
      location: req.body.location,
      rating: parseFloat(parseFloat(req.body.rating || 7.0).toFixed(2)),
      
      ...(req.body.coordinates && {
        coordinates: {
          lat: parseFloat(req.body.coordinates.lat) || 0,
          lng: parseFloat(req.body.coordinates.lng) || 0
        }
      }),
      ...(req.body.introComments?.trim() && { introComments: req.body.introComments.trim() }),
      ...(req.body.timeOfBeefing?.trim() && { timeOfBeefing: req.body.timeOfBeefing.trim() }),
      ...(req.body.timeInBag?.trim() && { timeInBag: req.body.timeInBag.trim() }),
      ...(req.body.priceOfBeef?.trim() && { priceOfBeef: req.body.priceOfBeef.trim() }),
      ...(req.body.freshPinkWarm?.trim() && { freshPinkWarm: req.body.freshPinkWarm.trim() }),
      ...(req.body.beefToBun?.trim() && { beefToBun: req.body.beefToBun.trim() }),
      ...(req.body.flavorOfBeef?.trim() && { flavorOfBeef: req.body.flavorOfBeef.trim() }),
      ...(req.body.sauceToMayo?.trim() && { sauceToMayo: req.body.sauceToMayo.trim() }),
      ...(req.body.cheesePosition && { cheesePosition: req.body.cheesePosition }),
      ...(req.body.nicelyGriddledBun?.trim() && { nicelyGriddledBun: req.body.nicelyGriddledBun.trim() }),
      ...(req.body.dayOldBeef === 'true' && { dayOldBeef: true }),
      ...(req.body.napkinCount && { napkinCount: parseInt(req.body.napkinCount) }),
      
      comments: [],
      likes: []
    };

    // FIXED: Store media as a simple string path (not an object)
    if (req.file) {
      const mediaPath = req.file.path.replace(/\\/g, '/');
      const relativePath = mediaPath.split('uploads/')[1];
      
      // Store just the path as a string, matching how ProfileImage expects it
      reviewData.media = `/uploads/${relativePath}`;
      
      console.log('Processed media path:', reviewData.media);
    }

    const review = new Review(reviewData);
    const savedReview = await review.save();
    const populatedReview = await Review.findById(savedReview._id)
      .populate('likes', 'displayName username profileImage')
      .populate('comments.likes', 'displayName username profileImage');

    await activityService.logNewReview(req.user, populatedReview);

    // Format rating to have 2 decimal places in response
    const reviewObj = populatedReview.toObject();
    reviewObj.rating = parseFloat(reviewObj.rating.toFixed(2));

    res.status(201).json(reviewObj);
  } catch (error) {
    if (req.file) {
      await deleteFile(req.file.path);
    }
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Failed to create review' });
  }
});

// Add comment with media support
router.post('/:id/comment', requireAuth, handleFileUpload('commentMedia'), async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const comment = {
      _id: new mongoose.Types.ObjectId(),
      userId: req.user._id,
      userDisplayName: req.user.displayName,
      userImage: req.user.profileImage,
      parentId: req.body.parentId || null,
      text: req.body.text?.trim() || '',
      date: new Date(),
      likes: []
    };

    if (req.file) {
      try {
        const mediaPath = req.file.path.replace(/\\/g, '/');
        const relativePath = mediaPath.split('uploads/')[1];
        comment.media = {
          url: `/uploads/${relativePath}`,
          type: req.file.mimetype
        };
      } catch (mediaError) {
        console.error('Media processing error:', mediaError);
      }
    }

    if (!comment.text && !comment.media) {
      return res.status(400).json({ message: 'Comment must contain either text or media' });
    }

    // Add comment to review
    review.comments.push(comment);
    await review.save();

    // Log the activity
    try {
      await activityService.logCommentActivity(req.user, review, comment);
    } catch (activityError) {
      console.error('Failed to log comment activity:', activityError);
      // Don't fail the request if activity logging fails
    }

    const populatedReview = await Review.findById(review._id)
      .populate('likes', 'displayName username profileImage')
      .populate('comments.likes', 'displayName username profileImage');

    // Format rating to have 2 decimal places in response
    const reviewObj = populatedReview.toObject();
    reviewObj.rating = parseFloat(reviewObj.rating.toFixed(2));

    res.json(reviewObj);
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ 
      message: 'Failed to add comment',
      error: error.message
    });
  }
});
// Update review
router.put('/:id', requireAuth, handleFileUpload('media'), async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to edit this review' });
    }

    const updateData = {
      ...(req.body.title?.trim() && { title: req.body.title.trim() }),
      ...(req.body.introSummary?.trim() && { introSummary: req.body.introSummary.trim() }),
      ...(req.body.closingSummary?.trim() && { closingSummary: req.body.closingSummary.trim() }),
      ...(req.body.beefery?.trim() && { beefery: req.body.beefery.trim() }),
      ...(req.body.location?.trim() && { location: req.body.location.trim() }),
      ...(req.body.coordinates && {
        coordinates: {
          lat: parseFloat(req.body.coordinates.lat) || review.coordinates.lat,
          lng: parseFloat(req.body.coordinates.lng) || review.coordinates.lng
        }
      }),
      ...(req.body.introComments?.trim() && { introComments: req.body.introComments.trim() }),
      ...(req.body.timeOfBeefing?.trim() && { timeOfBeefing: req.body.timeOfBeefing.trim() }),
      ...(req.body.timeInBag?.trim() && { timeInBag: req.body.timeInBag.trim() }),
      ...(req.body.priceOfBeef?.trim() && { priceOfBeef: req.body.priceOfBeef.trim() }),
      ...(req.body.freshPinkWarm?.trim() && { freshPinkWarm: req.body.freshPinkWarm.trim() }),
      ...(req.body.beefToBun?.trim() && { beefToBun: req.body.beefToBun.trim() }),
      ...(req.body.flavorOfBeef?.trim() && { flavorOfBeef: req.body.flavorOfBeef.trim() }),
      ...(req.body.sauceToMayo?.trim() && { sauceToMayo: req.body.sauceToMayo.trim() }),
      ...(req.body.cheesePosition && { cheesePosition: req.body.cheesePosition }),
      ...(req.body.nicelyGriddledBun?.trim() && { nicelyGriddledBun: req.body.nicelyGriddledBun.trim() }),
      ...(req.body.dayOldBeef === 'true' && { dayOldBeef: true }),
      ...(req.body.napkinCount && { napkinCount: parseInt(req.body.napkinCount) }),
      ...(req.body.rating && { rating: parseFloat(parseFloat(req.body.rating).toFixed(2)) })
    };

    if (req.file) {
      if (review.media?.original) {
        const oldPath = path.join(__dirname, '..', review.media.original);
        await deleteFile(oldPath);
      }

      const mediaPath = req.file.path.replace(/\\/g, '/');
      const relativePath = mediaPath.split('uploads/')[1];
      
      updateData.media = {
        original: `/uploads/${relativePath}`,
        type: req.file.mimetype
      };
    }

    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('likes', 'displayName username profileImage')
      .populate('comments.likes', 'displayName username profileImage');

    // Format rating to have 2 decimal places in response
    const reviewObj = updatedReview.toObject();
    reviewObj.rating = parseFloat(reviewObj.rating.toFixed(2));

    res.json(reviewObj);
  } catch (error) {
    if (req.file) {
      await deleteFile(req.file.path);
    }
    console.error('Update review error:', error);
    res.status(500).json({ message: 'Failed to update review' });
  }
});

// Like/unlike review
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const userLikeIndex = review.likes.indexOf(req.user._id);
    
    if (userLikeIndex === -1) {
      // Add like
      review.likes.push(req.user._id);
      
      // Log activity for the like - With error handling
      try {
        await activityService.logActivity({
          type: 'review_like',
          actor: {
            userId: req.user._id,
            displayName: req.user.displayName,
            profileImage: req.user.profileImage
          },
          subject: {
            userId: review.userId,
            displayName: review.userDisplayName
          },
          target: {
            type: 'review',
            id: review._id,
            beefery: review.beefery
          },
          metadata: {
            rating: review.rating
          }
        });
      } catch (activityError) {
        console.error('Error logging review like activity:', activityError);
        // Continue with the like operation even if activity logging fails
      }
    } else {
      // Remove like
      review.likes.splice(userLikeIndex, 1);
      // Note: We don't remove activity logs for unlikes
    }

    await review.save();
    const populatedReview = await Review.findById(review._id)
      .populate('likes', 'displayName username profileImage')
      .populate('comments.likes', 'displayName username profileImage');
    
    // Format rating to have 2 decimal places in response
    const reviewObj = populatedReview.toObject();
    reviewObj.rating = parseFloat(reviewObj.rating.toFixed(2));
    
    res.json(reviewObj);
  } catch (error) {
    console.error('Like review error:', error);
    res.status(500).json({ message: 'Failed to like/unlike review' });
  }
});

// Like/unlike comment
router.post('/:id/comments/:commentId/like', requireAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const comment = review.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Normalized check for existing like
    const userLikeIndex = comment.likes.findIndex(like => {
      if (typeof like === 'object') {
        return (like._id && like._id.toString() === req.user._id.toString()) ||
               (like.id && like.id.toString() === req.user._id.toString());
      }
      return like && like.toString() === req.user._id.toString();
    });
    
    if (userLikeIndex > -1) {
      // Remove like
      comment.likes.splice(userLikeIndex, 1);
    } else {
      // Add like
      comment.likes.push({
        _id: req.user._id,
        displayName: req.user.displayName,
        username: req.user.username,
        profileImage: req.user.profileImage
      });
      
      // Activity logging - wrapped in try/catch to prevent failures
      try {
        await activityService.logCommentLikeActivity(req.user, review, comment);
      } catch (activityError) {
        console.error('Activity logging error:', activityError);
        // Continue - don't fail the like operation due to activity logging
      }
    }

    await review.save();
    const populatedReview = await Review.findById(review._id)
      .populate('likes', 'displayName username profileImage')
      .populate('comments.likes', 'displayName username profileImage');

    // Format rating to have 2 decimal places in response
    const reviewObj = populatedReview.toObject();
    reviewObj.rating = parseFloat(reviewObj.rating.toFixed(2));

    res.json(reviewObj);
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ message: 'Failed to like/unlike comment' });
  }
});
// Delete review
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    // Delete associated media if it exists
    if (review.media?.original) {
      const mediaPath = path.join(__dirname, '..', review.media.original);
      await deleteFile(mediaPath);
    }

    // Delete all associated activities
    await activityService.deleteActivitiesForReview(review._id);

    // Delete the review
    await review.deleteOne();

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Failed to delete review' });
  }
});

// Delete comment (and all its replies)
router.delete('/:reviewId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const comment = review.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is authorized (comment owner or admin)
    if (comment.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // Helper function to recursively find all replies
    const findAllReplies = (commentId) => {
      const replyIds = [];
      const directReplies = comment.replies || [];
      
      directReplies.forEach(replyId => {
        replyIds.push(replyId);
        const replyComment = review.comments.id(replyId);
        if (replyComment && replyComment.replies && replyComment.replies.length > 0) {
          replyIds.push(...findAllReplies(replyId));
        }
      });
      
      return replyIds;
    };

    // Get all reply IDs to delete
    const replyIdsToDelete = findAllReplies(comment._id);

    // Delete media files if they exist
    if (comment.media && comment.media.url) {
      const mediaPath = path.join(__dirname, '..', comment.media.url);
      await deleteFile(mediaPath);
    }

    // Delete replies and their media
    for (const replyId of replyIdsToDelete) {
      const reply = review.comments.id(replyId);
      if (reply && reply.media && reply.media.url) {
        const mediaPath = path.join(__dirname, '..', reply.media.url);
        await deleteFile(mediaPath);
      }
      review.comments.pull(replyId);
    }

    // Remove this comment from its parent's replies array if it's a reply
    if (comment.parentId) {
      const parentComment = review.comments.id(comment.parentId);
      if (parentComment) {
        parentComment.replies = parentComment.replies.filter(
          id => id.toString() !== comment._id.toString()
        );
      }
    }

    // Finally delete the comment itself
    review.comments.pull(comment._id);
    await review.save();

    // Log activity for comment deletion
    await activityService.deleteActivitiesForReview(review._id);

    res.json({ message: 'Comment and all replies deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

// Feature/unfeature a review (admin only)
// Feature/unfeature a review (admin only)
router.put('/admin/reviews/:id/feature', requireAdmin, async (req, res) => {
  try {
    const { featured } = req.body;
    if (typeof featured !== 'boolean') {
      return res.status(400).json({ message: 'Featured status must be a boolean value' });
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    review.featured = featured;
    
    // If review is featured, also update pinned status
    if (featured) {
      review.pinned = {
        isPinned: true,
        label: 'Featured Review',
        pinnedAt: new Date()
      };
    } else if (review.pinned && review.pinned.label === 'Featured Review') {
      // Only remove pinned status if it was set by featuring
      review.pinned = {
        isPinned: false,
        label: null,
        pinnedAt: null
      };
    }
    
    await review.save();

    const updatedReview = await Review.findById(req.params.id)
      .populate('likes', 'displayName username profileImage')
      .populate('comments.likes', 'displayName username profileImage');

    // Format rating to have 2 decimal places in response
    const reviewObj = updatedReview.toObject();
    reviewObj.rating = parseFloat(reviewObj.rating.toFixed(2));

    res.json(reviewObj);
  } catch (error) {
    console.error('Feature review error:', error);
    res.status(500).json({ message: 'Failed to update review feature status' });
  }
});

// Pin/unpin a review
router.put('/:id/pin', requireAdmin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    review.pinned = {
      isPinned: req.body.isPinned,
      label: req.body.label,
      pinnedAt: req.body.isPinned ? new Date() : null
    };

    await review.save();
    res.json(review);
  } catch (error) {
    console.error('Pin review error:', error);
    res.status(500).json({ message: 'Failed to pin/unpin review' });
  }
});

module.exports = router;