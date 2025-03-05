// services/activityService.js
const Activity = require('../models/Activity');
const notificationService = require('./notificationService');
const { ACTIVITY_TYPES } = require('../models/Activity');

const activityService = {
  /**
   * Log an activity with proper error handling and notification creation
   * @param {Object} data - Activity data to log
   * @returns {Promise<Object>} Created activity
   */
  async logActivity(data) {
    try {
      // Create activity record
      const activity = new Activity(data);
      await activity.save();

      // Create notification for the subject user if applicable
      if (data.subject?.userId && data.subject.userId.toString() !== data.actor.userId.toString()) {
        try {
          // Format notification data based on activity type
          const notificationData = {
            type: data.type,
            sender: {
              id: data.actor.userId,
              displayName: data.actor.displayName,
              profileImage: data.actor.profileImage
            },
            recipient: data.subject.userId,
            reviewId: data.target.type === 'review' ? data.target.id : data.target.reviewId,
            reviewTitle: data.target.beefery,
            commentId: data.target.type === 'comment' ? data.target.id : undefined,
            commentContent: data.target.content
          };

          // Add parent comment ID if this is a reply to a comment
          if (data.metadata?.parentCommentId) {
            notificationData.parentCommentId = data.metadata.parentCommentId;
          }

          await notificationService.createNotification(notificationData);
        } catch (notifyError) {
          console.error('Error creating notification in logActivity:', notifyError);
          // Continue anyway - activity is already saved
        }
      }

      return activity;
    } catch (error) {
      console.error('Error logging activity:', error);
      throw error;
    }
  },

  /**
   * Get recent activities
   * @param {number} limit - Maximum number of activities to return
   * @returns {Promise<Array>} Recent activities
   */
  async getRecentActivity(limit = 50) {
    try {
      return await Activity.find()
        .sort({ date: -1 })
        .limit(parseInt(limit))
        .lean();
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      throw error;
    }
  },

  /**
   * Get user's activities (both as actor and subject)
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of activities to return
   * @returns {Promise<Array>} User activities
   */
  async getUserActivity(userId, limit = 20) {
    try {
      return await Activity.find({
        $or: [
          { 'actor.userId': userId },
          { 'subject.userId': userId }
        ]
      })
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .lean();
    } catch (error) {
      console.error('Error fetching user activity:', error);
      throw error;
    }
  },

  /**
   * Log a comment activity (creating a comment or replying to a comment)
   * @param {Object} actor - User creating the comment
   * @param {Object} review - Review being commented on
   * @param {Object} comment - The comment being added
   * @param {string} type - Activity type (defaults to REVIEW_COMMENT)
   * @returns {Promise<Object>} Created activity
   */
  async logCommentActivity(actor, review, comment, type = ACTIVITY_TYPES.REVIEW_COMMENT) {
    try {
      // Prepare activity data
      let activityData = {
        type,
        actor: {
          userId: actor._id,
          displayName: actor.displayName,
          profileImage: actor.profileImage
        },
        target: {
          type: 'comment',
          id: comment._id,
          content: comment.text,
          beefery: review.beefery,
          reviewId: review._id,
          media: comment.media
        },
        metadata: {
          reviewId: review._id,
          commentId: comment._id
        }
      };

      // Determine if this is a reply to a comment or a comment on the review
      if (comment.parentId) {
        const parentComment = review.comments.find(c => c._id.toString() === comment.parentId.toString());
        if (parentComment) {
          // This is a reply to another comment
          activityData.subject = {
            userId: parentComment.userId,
            displayName: parentComment.userDisplayName || 'User'
          };
          activityData.metadata.parentCommentId = comment.parentId;
        }
      } else {
        // This is a comment directly on the review
        activityData.subject = {
          userId: review.userId,
          displayName: review.userDisplayName || 'User'
        };
      }

      // Log the activity
      const activity = await this.logActivity(activityData);

      // Create a specific notification for the comment or reply
      // We handle this even though logActivity creates a generic notification,
      // so we can customize it for comments and replies
      if (activityData.subject?.userId && activityData.subject.userId.toString() !== actor._id.toString()) {
        try {
          if (comment.parentId) {
            // This is a reply to a comment
            await notificationService.sendCommentReplyNotification(
              {
                id: actor._id,
                displayName: actor.displayName,
                profileImage: actor.profileImage
              },
              activityData.subject.userId,
              review,
              comment,
              comment.parentId
            );
          } else {
            // This is a comment on the review
            await notificationService.sendReviewCommentNotification(
              {
                id: actor._id,
                displayName: actor.displayName,
                profileImage: actor.profileImage
              },
              activityData.subject.userId,
              review,
              comment
            );
          }
        } catch (notifyError) {
          console.error('Error sending comment notification:', notifyError);
          // Continue anyway - activity is already logged
        }
      }

      return activity;
    } catch (error) {
      console.error('Error logging comment activity:', error);
      throw error;
    }
  },
  
  /**
   * Log a comment like activity with notification
   * @param {Object} actor - User liking the comment
   * @param {Object} review - Review containing the comment
   * @param {Object} comment - Comment being liked
   * @returns {Promise<Object>} Created activity or null if failed
   */
  async logCommentLikeActivity(actor, review, comment) {
    try {
      // Normalize the userId - it could be an object or a string
      const commentUserId = typeof comment.userId === 'object' 
        ? (comment.userId._id || comment.userId.id) 
        : comment.userId;
      
      // Make sure we have valid user data
      if (!commentUserId) {
        console.error('Invalid comment userId:', comment.userId);
        return null; // Skip activity logging but don't throw error
      }

      // Create the activity data
      const activityData = {
        type: ACTIVITY_TYPES.COMMENT_LIKE,
        actor: {
          userId: actor._id,
          displayName: actor.displayName,
          profileImage: actor.profileImage
        },
        subject: {
          userId: commentUserId,
          displayName: comment.userDisplayName || 'User'
        },
        target: {
          type: 'comment',
          id: comment._id,
          content: comment.text || 'Comment',
          beefery: review.beefery,
          reviewId: review._id
        },
        metadata: {
          reviewId: review._id,
          commentId: comment._id,
          parentCommentId: comment.parentId
        }
      };

      // Log the activity
      const activity = await this.logActivity(activityData);

      // Send specific notification for comment like
      // Only send notification if different user and we have valid IDs
      if (actor._id.toString() !== commentUserId.toString()) {
        try {
          await notificationService.sendCommentLikeNotification(
            {
              id: actor._id,
              displayName: actor.displayName,
              profileImage: actor.profileImage
            },
            commentUserId,
            review,
            comment
          );
        } catch (notifyError) {
          console.error('Error sending comment like notification:', notifyError);
          // Continue anyway - activity is already logged
        }
      }

      return activity;
    } catch (error) {
      console.error('Error logging comment like activity:', error);
      // Return null instead of throwing to prevent API failure
      return null;
    }
  },

  /**
   * Log a review like activity with notification
   * @param {Object} actor - User liking the review
   * @param {Object} review - Review being liked
   * @returns {Promise<Object>} Created activity or null if failed
   */
  async logReviewLike(actor, review) {
    try {
      // Create activity data
      const activityData = {
        type: ACTIVITY_TYPES.REVIEW_LIKE,
        actor: {
          userId: actor._id,
          displayName: actor.displayName,
          profileImage: actor.profileImage
        },
        subject: {
          userId: review.userId,
          displayName: review.userDisplayName || 'User'
        },
        target: {
          type: 'review',
          id: review._id,
          beefery: review.beefery
        },
        metadata: {
          rating: review.rating
        }
      };
      
      // Log the activity
      const activity = await this.logActivity(activityData);
      
      // Create specific notification for review like
      if (review.userId && review.userId.toString() !== actor._id.toString()) {
        try {
          await notificationService.sendReviewLikeNotification(
            {
              id: actor._id,
              displayName: actor.displayName,
              profileImage: actor.profileImage
            },
            review.userId,
            review
          );
        } catch (notifyError) {
          console.error('Error creating notification for review like:', notifyError);
          // Continue anyway - activity is logged
        }
      }
      
      return activity;
    } catch (error) {
      console.error('Error logging review like:', error);
      return null; // Don't throw - just log the error and continue
    }
  },

  /**
 * Log a news like activity with notification
 * @param {Object} actor - User liking the news
 * @param {Object} news - News being liked
 * @returns {Promise<Object>} Created activity or null if failed
 */
async logNewsLike(actor, news) {
  try {
    console.log('logNewsLike called for news:', news._id);
    
    // Get the author information safely
    const authorId = news.author && (
      typeof news.author.userId === 'object' 
        ? news.author.userId._id || news.author.userId.id
        : news.author.userId
    );
    
    const authorDisplayName = news.author?.displayName || 'Unknown Author';
    
    console.log('News author ID:', authorId);
    console.log('News author displayName:', authorDisplayName);
    
    // Create activity data
    const activityData = {
      type: ACTIVITY_TYPES.NEWS_LIKE,
      actor: {
        userId: actor._id,
        displayName: actor.displayName,
        profileImage: actor.profileImage
      },
      subject: authorId ? {
        userId: authorId,
        displayName: authorDisplayName
      } : undefined,
      target: {
        type: 'news',
        id: news._id,
        title: news.title
      },
      metadata: {
        // Any additional metadata for news likes
      }
    };
    
    console.log('Activity data prepared, logging activity...');
    
    // Log the activity
    const activity = await this.logActivity(activityData);
    console.log('Activity logged:', activity?._id);
    
    // Create notification for news author
    if (authorId && authorId.toString() !== actor._id.toString()) {
      try {
        console.log('Creating notification for news like...');
        
        // Call createNotification directly instead of sendNewsLikeNotification
        await notificationService.createNotification({
          type: 'news_like',
          sender: {
            id: actor._id,
            displayName: actor.displayName,
            profileImage: actor.profileImage
          },
          recipient: authorId,
          reviewId: news._id, // Using reviewId for news ID
          reviewTitle: news.title // Using reviewTitle for news title
        });
        
        console.log('Notification created successfully');
      } catch (notifyError) {
        console.error('Error creating notification for news like:', notifyError);
        // Continue anyway - activity is logged
      }
    } else {
      console.log('Skipping notification - no author or author is the actor');
    }
    
    return activity;
  } catch (error) {
    console.error('Error logging news like activity:', error);
    // Don't throw - just log the error and continue
    return null;
  }
},

  /**
   * Log a new review activity
   * @param {Object} actor - User creating the review
   * @param {Object} review - Review being created
   * @returns {Promise<Object>} Created activity
   */
  async logNewReview(actor, review) {
    return this.logActivity({
      type: ACTIVITY_TYPES.NEW_REVIEW,
      actor: {
        userId: actor._id,
        displayName: actor.displayName,
        profileImage: actor.profileImage
      },
      target: {
        type: 'review',
        id: review._id,
        beefery: review.beefery,
        media: review.media
      },
      metadata: {
        rating: review.rating
      }
    });
  },

  /**
   * Log a new user activity
   * @param {Object} user - New user
   * @returns {Promise<Object>} Created activity
   */
  async logNewUser(user) {
    return this.logActivity({
      type: ACTIVITY_TYPES.NEW_USER,
      actor: {
        userId: user._id,
        displayName: user.displayName,
        profileImage: user.profileImage
      }
    });
  },

  /**
   * Delete all activities related to a review
   * @param {string} reviewId - Review ID
   * @returns {Promise<void>}
   */
  async deleteActivitiesForReview(reviewId) {
    try {
      await Activity.deleteMany({
        $or: [
          { 'target.id': reviewId },
          { 'target.reviewId': reviewId },
          { 'metadata.reviewId': reviewId }
        ]
      });
      
      // Also delete related notifications
      try {
        await notificationService.deleteContentNotifications(reviewId);
      } catch (notificationError) {
        console.error('Error deleting notifications for review:', notificationError);
      }
    } catch (error) {
      console.error('Error deleting review activities:', error);
      throw error;
    }
  },

  /**
   * Delete all activities related to a user
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async deleteActivitiesForUser(userId) {
    try {
      await Activity.deleteMany({
        $or: [
          { 'actor.userId': userId },
          { 'subject.userId': userId }
        ]
      });
      
      // Also delete user's notifications
      try {
        await notificationService.deleteAllUserNotifications(userId);
      } catch (notificationError) {
        console.error('Error deleting notifications for user:', notificationError);
      }
    } catch (error) {
      console.error('Error deleting user activities:', error);
      throw error;
    }
  },

  /**
   * Get unread activities for a user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum activities to return
   * @returns {Promise<Object>} Unread activities and count
   */
  async getUnreadActivities(userId, limit = 20) {
    try {
      const activities = await Activity.find({
        'subject.userId': userId,
        read: false
      })
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .lean();

      const count = await Activity.countDocuments({
        'subject.userId': userId,
        read: false
      });

      return {
        activities,
        count
      };
    } catch (error) {
      console.error('Error fetching unread activities:', error);
      return { activities: [], count: 0 };
    }
  },

  /**
   * Mark an activity as read
   * @param {string} activityId - Activity ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated activity
   */
  async markActivityRead(activityId, userId) {
    try {
      const activity = await Activity.findOneAndUpdate(
        {
          _id: activityId,
          'subject.userId': userId
        },
        { $set: { read: true } },
        { new: true }
      );

      return activity;
    } catch (error) {
      console.error('Error marking activity as read:', error);
      throw error;
    }
  },

  /**
   * Mark all activities for a user as read
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async markAllActivitiesRead(userId) {
    try {
      await Activity.updateMany(
        { 'subject.userId': userId },
        { $set: { read: true } }
      );
    } catch (error) {
      console.error('Error marking all activities as read:', error);
      throw error;
    }
  },
  
  /**
   * Log a poll vote activity
   * @param {Object} actor - User voting
   * @param {Object} news - News article with poll
   * @param {number} optionIndex - Selected option index
   * @returns {Promise<Object>} Created activity or null if failed
   */
  async logPollVote(actor, news, optionIndex) {
    try {
      // Get option title for better context
      const optionTitle = news.poll?.options[optionIndex]?.title || 'Unknown option';
      
      return this.logActivity({
        type: ACTIVITY_TYPES.POLL_VOTE,
        actor: {
          userId: actor._id,
          displayName: actor.displayName,
          profileImage: actor.profileImage
        },
        subject: news.author
          ? {
              userId: news.author.userId,
              displayName: news.author.displayName
            }
          : undefined,
        target: {
          type: 'news',
          id: news._id,
          title: news.title,
          content: news.poll?.question || 'Poll'
        },
        metadata: {
          optionIndex,
          optionTitle
        }
      });
    } catch (error) {
      console.error('Error logging poll vote activity:', error);
      // Return null instead of throwing to prevent API failure
      return null;
    }
  },

  /**
   * Refresh activities via API call or WebSocket event
   * @returns {Promise<boolean>} Success status
   */
  async refreshActivities() {
    try {
      // In a real implementation, this could:
      // 1. Trigger a WebSocket event to connected clients
      // 2. Update a cache of recent activities
      // 3. Calculate new activity counts to send to clients
      
      console.log('Activity refresh requested');
      
      // For now, just return success
      return true;
    } catch (error) {
      console.error('Error refreshing activities:', error);
      return false;
    }
  }
};

module.exports = activityService;