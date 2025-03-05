// Complete updated News.js model
const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  content: { 
    type: String, 
    required: true 
  },
  imageUrl: String,
  author: {
    userId: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true 
    },
    displayName: { 
      type: String, 
      required: true 
    },
    profileImage: String
  },
  visible: {
    type: Boolean,
    default: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Modified poll field to not create ghost polls
  poll: {
    type: {
      active: { type: Boolean, default: true },
      question: { type: String, required: true },
      options: [{
        title: { type: String, required: true },
        imageUrl: String,
        votes: [{
          userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
          },
          timestamp: { type: Date, default: Date.now }
        }]
      }],
      winner: {
        optionIndex: Number,
        announced: { type: Boolean, default: false }
      }
    },
    required: false,  // Make the entire poll field optional
    default: undefined // Don't create a default empty poll
  },
  // Fields for tags - ensuring proper schema definition
  tags: {
  type: [{
    text: { type: String, required: true },
    color: { type: String, default: 'primary' },
    icon: String,
    _id: false // Prevents Mongoose from adding _id to each tag object
  }],
  default: [] // Ensure it's always an array
},
  // Fields for pinning content
  pinned: {
    isPinned: { type: Boolean, default: false },
    label: String,
    pinnedAt: { type: Date }
  }
});

newsSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('News', newsSchema);