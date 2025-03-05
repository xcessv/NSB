const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/authMiddleware');
const { handleFileUpload, deleteFile } = require('../middleware/fileMiddleware');
const User = require('../models/User');
const Review = require('../models/Review');

// Login route
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    const user = await User.findOne({
      $or: [
        { username: new RegExp(`^${login}$`, 'i') },
        { email: new RegExp(`^${login}$`, 'i') }
      ]
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.banned) {
      return res.status(403).json({ message: 'Account is banned' });
    }

    const token = jwt.sign(
      { 
        id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET || 'NSBxsv',
      { expiresIn: '30d' }
    );

    user.lastActive = new Date();
    await user.save();

    const userData = user.toObject();
    delete userData.password;

    if (userData.profileImage) {
      userData.profileImage = `/${userData.profileImage}`;
    }

    res.json({
      user: userData,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Validate session
router.get('/validate-session', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .lean();
    
    if (!user) {
      return res.status(401).json({ valid: false });
    }

    await User.findByIdAndUpdate(user._id, { 
      lastActive: new Date() 
    });

    res.json({ 
      valid: true,
      user: {
        ...user,
        profileImage: user.profileImage ? `/${user.profileImage}` : null,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ valid: false });
  }
});

// Register new user
router.post('/register', handleFileUpload('profileImage'), async (req, res) => {
  try {
    const existingUser = await User.findOne({
      $or: [
        { username: new RegExp(`^${req.body.username}$`, 'i') },
        { email: new RegExp(`^${req.body.email}$`, 'i') }
      ]
    });

    if (existingUser) {
      if (existingUser.username.toLowerCase() === req.body.username.toLowerCase()) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      return res.status(400).json({ message: 'Email already exists' });
    }

    const userData = {
      username: req.body.username.toLowerCase(),
      email: req.body.email.toLowerCase(),
      password: req.body.password,
      displayName: req.body.displayName
    };

    if (req.file) {
      userData.profileImage = req.file.path.replace(/\\/g, '/');
    }

    const user = new User(userData);
    await user.save();

    const token = jwt.sign(
      { 
        id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET || 'NSBxsv',
      { expiresIn: '30d' }
    );

    const userObject = user.toObject();
    delete userObject.password;

    res.status(201).json({
      user: userObject,
      token
    });
  } catch (error) {
    if (req.file) {
      await deleteFile(req.file.path);
    }
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Registration failed',
      error: error.message
    });
  }
});

// Get user profile
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const reviews = await Review.find({ userId: user._id })
      .sort({ date: -1 })
      .limit(10);

    res.json({
      user,
      reviews
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', requireAuth, handleFileUpload('profileImage'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Handle profile image
    if (req.file) {
      // Delete old profile image if it exists
      if (user.profileImage) {
        try {
          await deleteFile(user.profileImage);
        } catch (error) {
          console.error('Error deleting old profile image:', error);
        }
      }
      user.profileImage = req.file.path.replace(/\\/g, '/');
    } else if (req.body.removeProfileImage === 'true') {
      if (user.profileImage) {
        try {
          await deleteFile(user.profileImage);
        } catch (error) {
          console.error('Error deleting profile image:', error);
        }
      }
      user.profileImage = null;
    }

    // Update other fields
    const fieldsToUpdate = ['displayName', 'email', 'bio'];
    fieldsToUpdate.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = field === 'email' ? req.body[field].toLowerCase() : req.body[field];
      }
    });

    await user.save();

    // Prepare response data
    const userData = user.toObject();
    delete userData.password;

    // Ensure profile image path is properly formatted
    if (userData.profileImage) {
      userData.profileImage = `/${userData.profileImage}`;
    }

    res.json(userData);
  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        await deleteFile(req.file.path);
      } catch (deleteError) {
        console.error('Error deleting uploaded file:', deleteError);
      }
    }
    res.status(500).json({ 
      message: 'Failed to update profile', 
      error: error.message 
    });
  }
});

// Update password
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (currentPassword !== user.password) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ message: 'Failed to update password' });
  }
});

// Follow/unfollow user
router.post('/follow/:id', requireAuth, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const userToFollow = await User.findById(req.params.id);
    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = await User.findById(req.user._id);

    if (user.following.includes(userToFollow._id)) {
      user.following.pull(userToFollow._id);
      userToFollow.followers.pull(user._id);
    } else {
      user.following.push(userToFollow._id);
      userToFollow.followers.push(user._id);
    }

    await Promise.all([user.save(), userToFollow.save()]);

    res.json({ message: 'Follow status updated successfully' });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ message: 'Failed to update follow status' });
  }
});

// Get user reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ userId: req.params.id })
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({ userId: req.params.id });

    res.json({
      reviews,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({ message: 'Failed to fetch user reviews' });
  }
});

// In your userRoutes.js
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (currentPassword !== user.password) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;