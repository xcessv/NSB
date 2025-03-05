const User = require('../models/User');
const Review = require('../models/Review');
const Report = require('../models/Report');

const adminController = {
  // Get admin dashboard stats
  getStats: async (req, res) => {
    try {
      // Get current date and date 24 hours ago
      const now = new Date();
      const yesterday = new Date(now - 24 * 60 * 60 * 1000);

      // Run all queries in parallel
      const [
        totalUsers,
        newUsers,
        totalReviews,
        activeUsers,
        totalLikes,
        totalComments,
        averageRating,
        activeReports
      ] = await Promise.all([
        // Total users count
        User.countDocuments(),
        
        // New users in last 24 hours
        User.countDocuments({ createdAt: { $gte: yesterday } }),
        
        // Total reviews count
        Review.countDocuments(),
        
        // Active users (users who have interacted in last 24 hours)
        User.countDocuments({ lastActive: { $gte: yesterday } }),
        
        // Total likes across all reviews
        Review.aggregate([
          { $group: { _id: null, totalLikes: { $sum: { $size: '$likes' } } } }
        ]).then(result => result[0]?.totalLikes || 0),
        
        // Total comments across all reviews
        Review.aggregate([
          { $group: { _id: null, totalComments: { $sum: { $size: '$comments' } } } }
        ]).then(result => result[0]?.totalComments || 0),
        
        // Average rating
        Review.aggregate([
          { $group: { _id: null, avgRating: { $avg: '$rating' } } }
        ]).then(result => result[0]?.avgRating || 0),
        
        // Active reports count
        Report.countDocuments({ status: 'open' })
      ]);

      res.json({
        users: totalUsers,
        reviews: totalReviews,
        reports: activeReports,
        newUsers,
        activeUsers,
        totalLikes,
        totalComments,
        averageRating: parseFloat(averageRating.toFixed(1))
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      res.status(500).json({ message: 'Failed to fetch admin stats' });
    }
  }
};

module.exports = adminController;