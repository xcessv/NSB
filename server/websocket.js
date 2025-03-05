// In websocket.js
const WebSocket = require('ws');
const url = require('url');

class NotificationWebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // userId -> WebSocket
    
    this.init();
  }

  init() {
    this.wss.on('connection', (ws, req) => {
      const userId = this.getUserIdFromUrl(req.url);
      if (!userId) {
        ws.close();
        return;
      }

      this.clients.set(userId, ws);
      console.log('Client connected: ${userId}');

      ws.on('close', () => {
        this.clients.delete(userId);
        console.log('Client disconnected: ${userId}');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error for user ${userId}:', error);
        this.clients.delete(userId);
      });
    });
  }

  getUserIdFromUrl(requestUrl) {
    const pathname = url.parse(requestUrl).pathname;
    const match = pathname.match(/^\/ws\/notifications\/(.+)$/);
    return match ? match[1] : null;
  }

  sendNotification(userId, notification) {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(notification));
      } catch (error) {
        console.error('Error sending notification to user ${userId}:', error);
        this.clients.delete(userId);
      }
    }
  }

  broadcastNotification(userIds, notification) {
    userIds.forEach(userId => {
      this.sendNotification(userId, notification);
    });
  }
}