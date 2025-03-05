const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/adminMiddleware');
const User = require('../models/User');
const Review = require('../models/Review');

// Get users with filtering and pagination
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const {
      search = '',
      role = 'all',
      status = 'all',
      sortBy = 'joinDate',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { username: new RegExp(search, 'i') },
        { displayName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    // Role filter
    if (role !== 'all') {
      query.role = role;
    }

    // Status filter
    if (status === 'banned') {
      query.banned = true;
    } else if (status === 'active') {
      query.banned = false;
    }

    // Get total count for pagination
    const total = await User.countDocuments(query);

    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const users = await User.find(query)
      .select('-password')
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Get review counts and average ratings
    const userStats = await Promise.all(users.map(async (user) => {
      const reviewCount = await Review.countDocuments({ userId: user._id });
      const reviews = await Review.find({ userId: user._id });
      const avgRating = reviews.length > 0
        ? reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviews.length
        : 0;

      return {
        ...user.toObject(),
        reviewCount,
        avgRating
      };
    }));

    res.json({
      users: userStats,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Update user role
router.put('/users/:userId/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const { userId } = req.params;

    // Prevent removing the last admin
    if (role === 'user') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      const user = await User.findById(userId);
      if (adminCount === 1 && user.role === 'admin') {
        return res.status(400).json({ 
          message: 'Cannot remove the last admin user' 
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// Ban/unban user
router.put('/users/:userId/ban', requireAdmin, async (req, res) => {
  try {
    const { banned } = req.body;
    const { userId } = req.params;

    // Prevent banning admins
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ 
        message: 'Cannot ban admin users' 
      });
    }

    user.banned = banned;
    user.banDate = banned ? new Date() : null;
    await user.save();

    res.json(user);
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ message: 'Failed to update user ban status' });
  }
});

module.exports = router;