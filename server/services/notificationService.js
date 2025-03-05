const WebSocket = require('ws');
const Notification = require('../models/Notification');

let wss = null; // WebSocket server instance

const notificationService = {
  initializeWebSocket(server) {
    wss = new WebSocket.Server({ 
      server,
      path: '/ws/notifications'
    });
    
    wss.on('connection', (ws, req) => {
      const userId = req.url.split('/').pop();
      ws.userId = userId;
      
      console.log(`WebSocket connected for user: ${userId}`);
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
      
      ws.on('close', () => {
        console.log(`WebSocket closed for user: ${userId}`);
      });
    });

    return wss;
  },

  getWebSocketServer() {
    return wss;
  },

  // Single robust implementation of broadcastToUser
  broadcastToUser(userId, data) {
    if (!wss || !userId) return;

    try {
      wss.clients.forEach((client) => {
        if (client.userId === userId && client.readyState === WebSocket.OPEN) {
          try {
            client.send(JSON.stringify(data));
          } catch (error) {
            console.error('Error sending message to client:', error);
          }
        }
      });
    } catch (error) {
      console.error('Error broadcasting to user:', error);
    }
  },

  async createNotification(data) {
    try {
      // Validate that we have all required data
      if (!data.recipient || !data.type || !data.sender?.id) {
        console.warn('Missing required data for notification:', 
          {recipient: !!data.recipient, type: !!data.type, sender: !!data.sender?.id});
        return null;
      }

      const notification = new Notification({
        recipient: data.recipient,
        type: data.type,
        sender: {
          id: data.sender.id,
          displayName: data.sender.displayName || 'Unknown User',
          profileImage: data.sender.profileImage
        },
        target: {
          type: data.type.includes('comment') ? 'comment' : 'review',
          id: data.type.includes('comment') ? data.commentId : data.reviewId,
          beefery: data.reviewTitle || 'Review',
          content: data.commentContent || ''
        }
      });

      await notification.save();

      // Try to broadcast, but don't fail if it doesn't work
      try {
        this.broadcastToUser(data.recipient.toString(), {
          type: 'new_notification',
          notification
        });
      } catch (broadcastError) {
        console.warn('Error broadcasting notification:', broadcastError);
        // Continue anyway
      }

      return notification;
    } catch (error) {
      console.error('Create notification error:', error);
      // Return null instead of throwing to prevent cascading failures
      return null;
    }
  },

  async getUnreadCount(userId) {
    try {
      return await Notification.countDocuments({
        recipient: userId,
        read: false
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      return 0;
    }
  },

  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          recipient: userId
        },
        { $set: { read: true } },
        { new: true }
      );

      if (notification) {
        const unreadCount = await this.getUnreadCount(userId);
        this.broadcastToUser(userId.toString(), {
          type: 'unread_count_update',
          count: unreadCount
        });
      }

      return notification;
    } catch (error) {
      console.error('Mark as read error:', error);
      throw error;
    }
  }
};

module.exports = notificationService;