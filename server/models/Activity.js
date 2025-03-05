const mongoose = require('mongoose');

// Activity type constants
const ACTIVITY_TYPES = {
  REVIEW_LIKE: 'review_like',
  COMMENT_LIKE: 'comment_like',
  REVIEW_COMMENT: 'review_comment',
  NEW_USER: 'new_user',
  NEW_REVIEW: 'new_review',
  NEWS_LIKE: 'news_like',
  POLL_VOTE: 'poll_vote'
};

const activitySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(ACTIVITY_TYPES),
    required: true
  },
  actor: {
    userId: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true 
    },
    displayName: { type: String, required: true },
    profileImage: String
  },
  target: {
    type: { type: String, enum: ['review', 'comment', 'news'] },  // Added 'news' type
    id: mongoose.Schema.Types.ObjectId,
    content: String,
    beefery: String,
    reviewId: mongoose.Schema.Types.ObjectId,
    title: String,  // Added for news titles
    media: {
      url: String,
      type: String,
      _id: false  // Prevents Mongoose from adding _id to this subdocument
    }
  },
  subject: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    displayName: String
  },
  metadata: {
    rating: Number,
    commentId: mongoose.Schema.Types.ObjectId,
    parentCommentId: mongoose.Schema.Types.ObjectId,
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      // Remove any null or undefined fields when converting to JSON
      Object.keys(ret).forEach(key => {
        if (ret[key] === null || ret[key] === undefined) {
          delete ret[key];
        }
      });
      return ret;
    }
  }
});

// Indices for efficient querying
activitySchema.index({ 'actor.userId': 1 });
activitySchema.index({ 'subject.userId': 1 });
activitySchema.index({ date: -1 });
activitySchema.index({ type: 1, date: -1 });
activitySchema.index({ 'target.reviewId': 1 });
activitySchema.index({ 'target.id': 1 });

// Static methods
activitySchema.statics.findByType = function(type) {
  return this.find({ type });
};

activitySchema.statics.findByActorId = function(userId) {
  return this.find({ 'actor.userId': userId });
};

activitySchema.statics.findBySubjectId = function(userId) {
  return this.find({ 'subject.userId': userId });
};

// Create the model
const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity;
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
module.exports.isValidActivityType = (type) => Object.values(ACTIVITY_TYPES).includes(type);