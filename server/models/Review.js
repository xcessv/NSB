const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  title: { type: String }, // New field for review title
  introSummary: { type: String }, // New field for introduction summary
  closingSummary: { type: String }, // New field for closing summary
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userDisplayName: { type: String, required: true },
  userImage: String,
  beefery: { type: String, required: true },
  location: String,
  coordinates: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 }
  },
  rating: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 10,
    get: v => parseFloat(v.toFixed(2)), // Format as 0.00
    set: v => parseFloat(parseFloat(v).toFixed(2)) // Ensure 2 decimal places when setting
  },
  date: { type: Date, default: Date.now },
  introComments: String,
  timeOfBeefing: String,
  timeInBag: String,
  priceOfBeef: String,
  freshPinkWarm: String,
  beefToBun: String,
  flavorOfBeef: String,
  sauceToMayo: String,
  cheesePosition: { type: String, enum: ['top', 'bottom'], default: 'bottom' },
  nicelyGriddledBun: String,
  napkinCount: Number,
  dayOldBeef: { type: Boolean, default: false },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userDisplayName: String,
    userImage: String,
    parentId: mongoose.Schema.Types.ObjectId,
    text: String,
    date: { type: Date, default: Date.now },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    media: {
      url: String,
      type: String
    }
  }],
  media: {
    original: String,
    type: String
  },

  // Comments array
  comments: [{
    _id: { 
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      required: true 
    },
    userId: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true 
    },
    userDisplayName: { 
      type: String, 
      required: true 
    },
    userImage: String,
    text: { 
      type: String,
      required: function() {
        return !this.media; // Only required if there's no media
      }
    },
    media: {
      url: { 
        type: String,
        required: function() {
          return !this.text; // Only required if there's no text
        }
      },
      type: { type: String }
    },
    date: { 
      type: Date, 
      default: Date.now 
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    replies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'this'
    }],
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  
  // Likes array
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
// Pinned content field
pinned: {
  isPinned: { type: Boolean, default: false },
  label: String,
  pinnedAt: { type: Date }
},
  // Timestamps
  date: { 
    type: Date, 
    default: Date.now 
  },
  // Featured flag - for admin to mark reviews as featured
  featured: { type: Boolean, default: false },
  
  // Flag to track if this review was reported
  reported: { type: Boolean, default: false },
  reportCount: { type: Number, default: 0 }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Remove undefined/null fields when converting to JSON
      Object.keys(ret).forEach(key => {
        if (ret[key] === null || ret[key] === undefined) {
          delete ret[key];
        }
      });
      return ret;
    },
    getters: true // Apply getters when converting to JSON
  }
});

// Text index for search functionality
reviewSchema.index({ 
  title: 'text', // Add title to text index
  beefery: 'text',
  location: 'text',
  introComments: 'text',
  introSummary: 'text', // Add introSummary to text index
  closingSummary: 'text' // Add closingSummary to text index
});

// Add geospatial index for location-based queries
reviewSchema.index({ coordinates: '2dsphere' });

module.exports = mongoose.model('Review', reviewSchema);