const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/adminMiddleware');
const { handleFileUpload, deleteFile } = require('../middleware/fileMiddleware');
const News = require('../models/News');
const User = require('../models/User');
const Review = require('../models/Review');
const Poi = require('../models/Poi');

// Enhanced stats endpoint with real data
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Get current date and date 24 hours ago
    const now = new Date();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000);

    // Run all queries in parallel for better performance
    const [
      totalUsers,
      newUsers,
      totalReviews,
      activeUsers,
      reviewStats,
      // We'll handle reports later when you add that feature
      reports
    ] = await Promise.all([
      // Total users count
      User.countDocuments(),
      
      // New users in last 24 hours
      User.countDocuments({ createdAt: { $gte: yesterday } }),
      
      // Total reviews count
      Review.countDocuments(),
      
      // Active users (users who have interacted in last 24 hours)
      User.countDocuments({ lastActive: { $gte: yesterday } }),
      
      // Get review stats (likes, comments, average rating) in one query
      Review.aggregate([
        {
          $group: {
            _id: null,
            totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } },
            totalComments: { $sum: { $size: { $ifNull: ['$comments', []] } } },
            avgRating: { $avg: '$rating' }
          }
        }
      ]),

      // Placeholder for reports count until you implement that feature
      Promise.resolve(0)
    ]);

    // Extract review stats or use defaults if no reviews exist
    const stats = reviewStats[0] || { totalLikes: 0, totalComments: 0, avgRating: 0 };

    res.json({
      users: totalUsers,
      reviews: totalReviews,
      reports,
      newUsers,
      activeUsers,
      totalLikes: stats.totalLikes,
      totalComments: stats.totalComments,
      averageRating: parseFloat((stats.avgRating || 0).toFixed(1))
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Failed to fetch admin statistics' });
  }
});

// Existing News Management Routes
router.get('/news', requireAdmin, async (req, res) => {
  try {
    const news = await News.find()
      .sort({ date: -1 })
      .populate('author.userId', 'displayName profileImage');

    res.json({ news });
  } catch (error) {
    console.error('Admin news fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch news' });
  }
});

router.post('/news', requireAdmin, handleFileUpload('image'), async (req, res) => {
  try {
    const newsData = {
      title: req.body.title,
      content: req.body.content,
      author: {
        userId: req.user._id,
        displayName: req.user.displayName,
        profileImage: req.user.profileImage
      },
      visible: req.body.visible === 'true'
    };

    if (req.file) {
      newsData.imageUrl = '/' + req.file.path.replace(/\\/g, '/');
    }

    const news = new News(newsData);
    await news.save();

    res.status(201).json(news);
  } catch (error) {
    if (req.file) {
      await deleteFile(req.file.path);
    }
    console.error('Create news error:', error);
    res.status(500).json({ message: 'Failed to create news' });
  }
});

router.put('/news/:id', requireAdmin, handleFileUpload('image'), async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    news.title = req.body.title;
    news.content = req.body.content;
    news.visible = req.body.visible === 'true';
    news.lastModified = new Date();

    if (req.file) {
      if (news.imageUrl) {
        await deleteFile(news.imageUrl.substring(1));
      }
      news.imageUrl = '/' + req.file.path.replace(/\\/g, '/');
    }

    await news.save();
    res.json(news);
  } catch (error) {
    if (req.file) {
      await deleteFile(req.file.path);
    }
    console.error('Update news error:', error);
    res.status(500).json({ message: 'Failed to update news' });
  }
});

router.put('/news/:id/visibility', requireAdmin, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    news.visible = req.body.visible;
    await news.save();

    res.json({ message: 'Visibility updated successfully', news });
  } catch (error) {
    console.error('Update visibility error:', error);
    res.status(500).json({ message: 'Failed to update visibility' });
  }
});

router.delete('/news/:id', requireAdmin, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    if (news.imageUrl) {
      const imagePath = news.imageUrl.replace(/^\//, '');
      await deleteFile(imagePath);
    }

    await News.deleteOne({ _id: req.params.id });
    res.json({ message: 'News deleted successfully' });
  } catch (error) {
    console.error('Delete news error:', error);
    res.status(500).json({ message: 'Failed to delete news', error: error.message });
  }
});

// In adminRoutes.js, make the GET route public
router.get('/pois', async (req, res) => {  // Remove requireAdmin middleware
  try {
    const pois = await Poi.find().sort('-createdAt');
    res.json({ pois });
  } catch (error) {
    console.error('Error fetching POIs:', error);
    res.status(500).json({ message: 'Failed to fetch POIs' });
  }
});

// POST /admin/pois - Create new POI
router.post('/pois', requireAdmin, async (req, res) => {
  try {
    const poi = new Poi({
      name: req.body.name,
      location: req.body.location,
      coordinates: req.body.coordinates,
      notes: req.body.notes,
      addedBy: req.user._id
    });

    await poi.save();
    res.status(201).json(poi);
  } catch (error) {
    console.error('Error creating POI:', error);
    res.status(500).json({ message: 'Failed to create POI' });
  }
});

// PUT /admin/pois/:id - Update POI
router.put('/pois/:id', requireAdmin, async (req, res) => {
  try {
    const poi = await Poi.findById(req.params.id);
    if (!poi) {
      return res.status(404).json({ message: 'POI not found' });
    }

    poi.name = req.body.name;
    poi.location = req.body.location;
    poi.coordinates = req.body.coordinates;
    poi.notes = req.body.notes;

    await poi.save();
    res.json(poi);
  } catch (error) {
    console.error('Error updating POI:', error);
    res.status(500).json({ message: 'Failed to update POI' });
  }
});

// Update the delete route in adminRoutes.js
router.delete('/pois/:id', requireAdmin, async (req, res) => {
  try {
    const result = await Poi.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'POI not found' });
    }
    res.json({ message: 'POI deleted successfully' });
  } catch (error) {
    console.error('Error deleting POI:', error);
    res.status(500).json({ message: 'Failed to delete POI' });
  }
});

// Get beefery analytics
router.get('/beefery-analytics', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Parse date range
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);
    
    // Aggregate reviews by beefery
    const reviewsByBeefery = await Review.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: "$beefery",
          reviewCount: { $sum: 1 },
          avgRating: { $avg: "$rating" },
          location: { $first: "$location" },
          lastReviewed: { $max: "$date" },
          // Create a histogram of ratings
          ratingDistribution: {
            $push: "$rating"
          },
          // Collect reviewer information
          reviewers: {
            $push: {
              userId: "$userId",
              displayName: "$userDisplayName",
              date: "$date"
            }
          }
        }
      },
      {
        $sort: { reviewCount: -1 }
      }
    ]);
    
    // Process the aggregation results
    const beeferies = reviewsByBeefery.map(beefery => {
      // Calculate rating distribution
      const ratingDistribution = {};
      if (beefery.ratingDistribution) {
        beefery.ratingDistribution.forEach(rating => {
          // Round to nearest 0.5
          const roundedRating = Math.round(rating * 2) / 2;
          ratingDistribution[roundedRating] = (ratingDistribution[roundedRating] || 0) + 1;
        });
      }
      
      // Get recent reviewers (last 5)
      const recentReviewers = beefery.reviewers
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)
        .map(reviewer => ({
          userId: reviewer.userId,
          displayName: reviewer.displayName
        }));
      
      return {
        name: beefery._id,
        reviewCount: beefery.reviewCount,
        avgRating: beefery.avgRating,
        location: beefery.location,
        lastReviewed: beefery.lastReviewed,
        ratingDistribution,
        recentReviewers
      };
    });
    
    res.json({ beeferies });
  } catch (error) {
    console.error('Beefery analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch beefery analytics' });
  }
});

// Feature/unfeature a review (admin only)
router.put('/reviews/:id/feature', requireAdmin, async (req, res) => {
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
    
    // If the review is featured, ensure it also has the pinned property
    if (featured) {
      review.pinned = {
        isPinned: true,
        label: 'Featured Review',
        pinnedAt: new Date()
      };
    } else if (review.pinned && review.pinned.isPinned) {
      // Only remove pinned if it was automatically set by featuring
      if (review.pinned.label === 'Featured Review') {
        review.pinned = {
          isPinned: false,
          label: null,
          pinnedAt: null
        };
      }
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

module.exports = router;