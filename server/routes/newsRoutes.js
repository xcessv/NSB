const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const { handleFileUpload, deleteFile } = require('../middleware/fileMiddleware');
const News = require('../models/News');
const activityService = require('../services/activityService');
const path = require('path');
const fs = require('fs');

// Get all news (public route)
router.get('/', async (req, res) => {
  try {
    const news = await News.find()
      .sort({ date: -1 })
      .populate('author.userId', 'displayName profileImage');

    res.json({ news });
  } catch (error) {
    console.error('Get news error:', error);
    res.status(500).json({ message: 'Failed to fetch news' });
  }
});

// Create news (admin only)
router.post('/', requireAdmin, handleFileUpload('image'), async (req, res) => {
  try {
    // Debug log of raw request body
    console.log('CREATE NEWS: Raw request body keys:', Object.keys(req.body));
    console.log('CREATE NEWS: Tags received:', req.body.tags);
    
    // Parse tags - simplified and more direct approach
    let tags = [];
    try {
      if (req.body.tags) {
        if (typeof req.body.tags === 'string') {
          // Simple check if it looks like a JSON array
          if (req.body.tags.trim().startsWith('[') && req.body.tags.trim().endsWith(']')) {
            tags = JSON.parse(req.body.tags);
            console.log('CREATE NEWS: Successfully parsed tags JSON:', tags);
          } else {
            // Treat as single tag
            tags = [{ text: req.body.tags.trim(), color: 'primary' }];
          }
        } else if (Array.isArray(req.body.tags)) {
          tags = req.body.tags;
        }
      }
    } catch (tagsError) {
      console.error('CREATE NEWS: Error parsing tags:', tagsError);
      // Emergency fallback - create fixed tags for testing
      tags = [
        { text: "Fallback Tag", color: "red" },
        { text: "Error Handling", color: "blue" }
      ];
    }
    
    // Parse pinned status 
    let pinned = { isPinned: false };
    try {
      if (req.body.pinned) {
        pinned = JSON.parse(req.body.pinned);
      }
    } catch (pinnedError) {
      console.error('CREATE NEWS: Error parsing pinned status:', pinnedError);
      pinned = { isPinned: false, label: '' };
    }
    
    // Create news data
    const newsData = {
      title: req.body.title,
      content: req.body.content,
      author: {
        userId: req.user._id,
        displayName: req.user.displayName,
        profileImage: req.user.profileImage
      },
      visible: req.body.visible === 'true',
      tags: tags,
      pinned: pinned
    };

    // Handle image upload
    if (req.file) {
      const filename = req.file.filename;
      newsData.imageUrl = `/uploads/news/${filename}`;
      
      // Process uploaded file if needed
      const targetDir = path.join(__dirname, '../uploads/news');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      const targetPath = path.join(targetDir, filename);
      if (req.file.path !== targetPath) {
        await fs.promises.rename(req.file.path, targetPath);
      }
    }

    console.log('CREATE NEWS: Creating news with tags:', newsData.tags);
    
    // Create and save the news item
    const news = new News(newsData);
    await news.save();
    
    // Double-check if tags were saved
    console.log('CREATE NEWS: Saved news item with tags:', news.tags);
    
    // Force fetching from the database to verify tags are saved
    const savedNews = await News.findById(news._id);
    console.log('CREATE NEWS: Verified tags in database:', savedNews.tags);
    
    res.status(201).json(savedNews); // Send the freshly fetched news item
  } catch (error) {
    if (req.file) {
      await deleteFile(req.file.path);
    }
    console.error('CREATE NEWS: Error:', error);
    res.status(500).json({ message: 'Failed to create news', error: error.message });
  }
});

// Toggle visibility
router.put('/:id/visibility', requireAdmin, async (req, res) => {
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

// Update news (admin only)
router.put('/:id', requireAdmin, handleFileUpload('image'), async (req, res) => {
  try {
    console.log('UPDATE NEWS: Raw request body keys:', Object.keys(req.body));
    console.log('UPDATE NEWS: Tags received:', req.body.tags);
    
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    // Parse tags - simplified approach
    let tags = [];
    try {
      if (req.body.tags) {
        if (typeof req.body.tags === 'string') {
          // Simple check if it looks like a JSON array
          if (req.body.tags.trim().startsWith('[') && req.body.tags.trim().endsWith(']')) {
            tags = JSON.parse(req.body.tags);
            console.log('UPDATE NEWS: Successfully parsed tags JSON:', tags);
          } else {
            // Treat as single tag
            tags = [{ text: req.body.tags.trim(), color: 'primary' }];
          }
        } else if (Array.isArray(req.body.tags)) {
          tags = req.body.tags;
        }
      }
    } catch (tagsError) {
      console.error('UPDATE NEWS: Error parsing tags:', tagsError);
      // Emergency fallback - create fixed tags for testing
      tags = [
        { text: "Update Fallback", color: "green" },
        { text: "Error Recovery", color: "purple" }
      ];
    }
    
    // Parse pinned status
    let pinned = news.pinned || { isPinned: false };
    try {
      if (req.body.pinned) {
        if (typeof req.body.pinned === 'string') {
          pinned = JSON.parse(req.body.pinned);
        } else if (typeof req.body.pinned === 'object') {
          pinned = req.body.pinned;
        }
      }
    } catch (pinnedError) {
      console.error('UPDATE NEWS: Error parsing pinned status:', pinnedError);
    }

    // Update the news fields
    news.title = req.body.title;
    news.content = req.body.content;
    news.visible = req.body.visible === 'true';
    news.lastModified = new Date();
    
    // Important: Set tags and log them
    news.tags = tags;
    console.log('UPDATE NEWS: Updated news with tags:', news.tags);
    
    // Set pinned status
    news.pinned = pinned;

    // Handle image update
    if (req.file) {
      // Delete old image if it exists
      if (news.imageUrl) {
        try {
          const oldImagePath = news.imageUrl.replace(/^\/uploads\//, '');
          await deleteFile(oldImagePath);
        } catch (err) {
          console.warn('Error deleting old image:', err);
        }
      }
      
      // Store new image
      const filename = req.file.filename;
      news.imageUrl = `/uploads/news/${filename}`;
    }

    // Save the updated news
    await news.save();
    
    // Double-check if tags were saved
    console.log('UPDATE NEWS: Saved news with tags:', news.tags);
    
    // Force fetching from the database to verify tags are saved
    const savedNews = await News.findById(news._id);
    console.log('UPDATE NEWS: Verified tags in database:', savedNews.tags);
    
    // Return the verified news item from the database
    res.json(savedNews);
  } catch (error) {
    if (req.file) {
      await deleteFile(req.file.path);
    }
    console.error('UPDATE NEWS: Error:', error);
    res.status(500).json({ message: 'Failed to update news', error: error.message });
  }
});

// Delete news
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    // If there's an image, delete it
    if (news.imageUrl) {
      const imagePath = news.imageUrl.replace(/^\/uploads\//, '');
      await deleteFile(imagePath);
    }

    await News.deleteOne({ _id: req.params.id });
    res.json({ message: 'News deleted successfully' });
  } catch (error) {
    console.error('Delete news error:', error);
    res.status(500).json({ message: 'Failed to delete news', error: error.message });
  }
});

// Like/unlike news (authenticated users)
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const news = await News.findById(req.params.id)
      .populate('author.userId', 'displayName profileImage');
      
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    const userLikeIndex = news.likes.indexOf(req.user._id);
    
    if (userLikeIndex === -1) {
      // Add like
      news.likes.push(req.user._id);
      
      // Log activity for the like
      try {
        await activityService.logNewsLike(req.user, news);
      } catch (activityError) {
        console.error('Error logging news like activity:', activityError);
        // Continue with the like operation even if activity logging fails
      }
    } else {
      // Remove like
      news.likes.splice(userLikeIndex, 1);
      // Note: We don't remove activity logs for unlikes
    }

    await news.save();
    res.json({ 
      message: userLikeIndex === -1 ? 'News liked' : 'News unliked',
      likes: news.likes
    });
  } catch (error) {
    console.error('Like news error:', error);
    res.status(500).json({ message: 'Failed to update like status' });
  }
});

// Get single news item by ID
router.get('/:id', async (req, res) => {
  try {
    const news = await News.findById(req.params.id)
      .populate('author.userId', 'displayName profileImage');
    
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    res.json(news);
  } catch (error) {
    console.error('Get news by ID error:', error);
    res.status(500).json({ message: 'Failed to fetch news' });
  }
});

router.post('/:id/poll', requireAdmin, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    // Validate poll data first
    if (!req.body.question || !Array.isArray(req.body.options) || req.body.options.length < 2) {
      return res.status(400).json({ 
        message: 'Invalid poll data. A question and at least two options are required.' 
      });
    }

    // Only create a poll if valid data is provided
    news.poll = {
      active: true,
      question: req.body.question,
      options: req.body.options.map(option => ({
        title: option.title,
        imageUrl: option.imageUrl,
        votes: []
      })),
      winner: null
    };

    await news.save();
    res.json(news);
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ message: 'Failed to create poll' });
  }
});

// Remove a poll from a news item
router.delete('/:id/poll', requireAdmin, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    news.poll = undefined;
    await news.save();
    res.json({ message: 'Poll removed successfully' });
  } catch (error) {
    console.error('Delete poll error:', error);
    res.status(500).json({ message: 'Failed to delete poll' });
  }
});

// Fixed Poll Vote Route in newsRoutes.js
router.post('/:id/poll/vote', requireAuth, async (req, res) => {
  try {
    const newsId = req.params.id;
    const optionIndex = req.body.optionIndex;
    
    console.log('Poll vote request:', {
      newsId,
      optionIndex,
      userId: req.user._id
    });
    
    // Validate input
    if (optionIndex === undefined || optionIndex === null) {
      return res.status(400).json({ message: 'Option index is required' });
    }
    
    // Parse as integer if it's a string
    const parsedOptionIndex = parseInt(optionIndex, 10);
    if (isNaN(parsedOptionIndex)) {
      return res.status(400).json({ message: 'Invalid option index format' });
    }

    // Get the news item
    const news = await News.findById(newsId);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    // Validate poll existence
    if (!news.poll) {
      return res.status(400).json({ message: 'No poll found for this news item' });
    }

    // Validate poll is active
    if (!news.poll.active) {
      return res.status(400).json({ message: 'Poll is not active' });
    }

    // Validate option index is within range
    if (parsedOptionIndex < 0 || parsedOptionIndex >= news.poll.options.length) {
      return res.status(400).json({ message: 'Invalid option index' });
    }

    // Check if user has already voted on any option
    let previousVoteIndex = -1;
    for (let i = 0; i < news.poll.options.length; i++) {
      const option = news.poll.options[i];
      if (!option.votes) {
        // Initialize votes array if it doesn't exist
        option.votes = [];
        continue;
      }
      
      const userVoteIndex = option.votes.findIndex(vote => {
        // Handle both formats of votes (object with userId or just userId)
        if (typeof vote === 'object' && vote !== null) {
          return vote.userId.toString() === req.user._id.toString();
        }
        return vote.toString() === req.user._id.toString();
      });
      
      if (userVoteIndex !== -1) {
        previousVoteIndex = i;
        // Remove the vote if it's on a different option than the one we're voting for
        if (i !== parsedOptionIndex) {
          option.votes.splice(userVoteIndex, 1);
        }
      }
    }

    // If the user hasn't voted on this option yet, add their vote
    if (previousVoteIndex !== parsedOptionIndex) {
      // Ensure the option has a votes array
      if (!news.poll.options[parsedOptionIndex].votes) {
        news.poll.options[parsedOptionIndex].votes = [];
      }

      // Add the vote
      news.poll.options[parsedOptionIndex].votes.push({
        userId: req.user._id,
        timestamp: new Date()
      });
    }

    // Save the updated news item
    await news.save();
    
    console.log('Vote recorded successfully');
    
    // Return the updated news item
    res.json(news);
  } catch (error) {
    console.error('Poll vote error:', error);
    res.status(500).json({ message: 'Failed to record vote', error: error.message });
  }
});

// End a poll and optionally announce winner
router.put('/:id/poll/end', requireAdmin, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    if (!news.poll) {
      return res.status(400).json({ message: 'No poll found for this news item' });
    }

    news.poll.active = false;

    if (req.body.announceWinner) {
      // Find option with most votes
      let maxVotes = -1;
      let winnerIndex = -1;

      for (let i = 0; i < news.poll.options.length; i++) {
        const voteCount = news.poll.options[i].votes.length;
        if (voteCount > maxVotes) {
          maxVotes = voteCount;
          winnerIndex = i;
        }
      }

      news.poll.winner = {
        optionIndex: winnerIndex,
        announced: true
      };
    }

    await news.save();
    res.json(news);
  } catch (error) {
    console.error('End poll error:', error);
    res.status(500).json({ message: 'Failed to end poll' });
  }
});

// Add/update tags for a news item - combined improved version
router.put('/:id/tags', requireAdmin, async (req, res) => {
  try {
    const newsId = req.params.id;
    console.log(`=== TAG UPDATE FOR NEWS ${newsId} ===`);
    console.log('Request body:', req.body);
    
    // Find the news item
    const news = await News.findById(newsId);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    // Process tags based on request
    let tags = [];
    
    try {
      if (req.body && req.body.tags) {
        // If tags is already an array, use it directly
        if (Array.isArray(req.body.tags)) {
          tags = req.body.tags;
          console.log('Using tags array from request:', tags);
        } 
        // If tags is a string, try to parse it as JSON
        else if (typeof req.body.tags === 'string') {
          tags = JSON.parse(req.body.tags);
          console.log('Successfully parsed tags JSON from string:', tags);
        }
      }
      
      // Validate that tags is an array
      if (!Array.isArray(tags)) {
        console.log('Tags is not an array, using default tags');
        // Use hardcoded tags for fallback
        tags = [
          { text: "Fallback Tag", color: "red" },
          { text: "Default Tag", color: "blue" }
        ];
      }
      
      // Normalize tag format
      tags = tags.map(tag => {
        // If tag is just a string, convert to object
        if (typeof tag === 'string') {
          return { text: tag, color: 'primary' };
        }
        
        // Ensure tag has at least a text property
        if (!tag.text && (tag.name || tag.label)) {
          tag.text = tag.name || tag.label;
        }
        
        // If no color specified, use primary
        if (!tag.color) {
          tag.color = 'primary';
        }
        
        return {
          text: tag.text || 'Untitled Tag',
          color: tag.color
        };
      });
      
    } catch (tagParseError) {
      console.error('Error parsing tags:', tagParseError);
      // If parsing fails, use hardcoded tags
      tags = [
        { text: "Error Tag", color: "red" },
        { text: "Fallback Tag", color: "orange" }
      ];
    }
    
    console.log('Final tags to save:', tags);
    
    // Set the tags directly
    news.tags = tags;
    
    // Save the news
    await news.save();
    console.log('News saved successfully with tags');
    
    // Get the latest version to confirm it worked
    const updatedNews = await News.findById(newsId);
    console.log('Tags after save:', updatedNews.tags);
    
    res.json(updatedNews);
  } catch (error) {
    console.error('Update tags error:', error);
    res.status(500).json({ message: 'Failed to update tags', error: error.message });
  }
});

// Fixed Pin/Unpin Route in newsRoutes.js
router.put('/:id/pin', requireAdmin, async (req, res) => {
  try {
    // Get the news item
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    // Log incoming request for debugging
    console.log('PIN/UNPIN REQUEST:', {
      body: req.body,
      params: req.params
    });

    // Handle different formats of the isPinned field
    let isPinned = false;
    if (req.body.isPinned === true || req.body.isPinned === 'true' || req.body.isPinned === 1) {
      isPinned = true;
    }

    // Create pinned object with default label if needed
    const pinned = {
      isPinned: isPinned,
      label: req.body.label || (isPinned ? 'Pinned News' : ''),
      pinnedAt: isPinned ? new Date() : null
    };

    console.log('Setting pinned status to:', pinned);

    // Set the pinned field directly (don't try to merge with existing)
    news.pinned = pinned;
    
    // Save the news item with updated pin status
    await news.save();
    
    // Log final news item for debugging
    console.log('Updated news with pinned status:', {
      _id: news._id,
      pinned: news.pinned
    });

    // Return the complete updated document
    res.json(news);
  } catch (error) {
    console.error('Pin/unpin news error:', error);
    res.status(500).json({ message: 'Failed to pin/unpin news', error: error.message });
  }
});

module.exports = router;