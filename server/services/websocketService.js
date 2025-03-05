const WebSocket = require('ws');
const url = require('url');

class WebSocketService {
 constructor(server) {
   this.wss = new WebSocket.Server({ server });
   this.clients = new Map(); // userId -> WebSocket
   this.pingInterval = null;
   
   this.init();
   this.startPingInterval();
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

     ws.on('pong', () => {
       ws.isAlive = true;
     });

     ws.on('close', () => {
       this.clients.delete(userId);
       console.log('Client disconnected: ${userId}');
     });

     ws.on('error', (error) => {
       console.error('WebSocket error for user ${userId}:', error);
       this.clients.delete(userId);
     });

     // Mark the connection as alive
     ws.isAlive = true;
   });
 }

 startPingInterval() {
   this.pingInterval = setInterval(() => {
     this.wss.clients.forEach(ws => {
       if (ws.isAlive === false) {
         return ws.terminate();
       }
       
       ws.isAlive = false;
       ws.ping();
     });
   }, 30000); // Check every 30 seconds
 }

 stopPingInterval() {
   if (this.pingInterval) {
     clearInterval(this.pingInterval);
   }
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

 broadcastToAll(notification, excludeUserId = null) {
   this.clients.forEach((ws, userId) => {
     if (userId !== excludeUserId) {
       this.sendNotification(userId, notification);
     }
   });
 }

 sendToFollowers(userId, notification) {
   // Requires user model with followers
   User.findById(userId)
     .select('followers')
     .then(user => {
       if (user && user.followers.length > 0) {
         this.broadcastNotification(user.followers, notification);
       }
     })
     .catch(error => {
       console.error('Error sending to followers:', error);
     });
 }

 isUserConnected(userId) {
   const client = this.clients.get(userId);
   return client && client.readyState === WebSocket.OPEN;
 }

 getConnectedUsers() {
   return Array.from(this.clients.keys());
 }

 getConnectionCount() {
   return this.clients.size;
 }

 closeConnection(userId) {
   const client = this.clients.get(userId);
   if (client) {
     client.close();
     this.clients.delete(userId);
     return true;
   }
   return false;
 }

 closeAllConnections() {
   this.clients.forEach((ws, userId) => {
     ws.close();
   });
   this.clients.clear();
 }

 destroy() {
   this.stopPingInterval();
   this.closeAllConnections();
   if (this.wss) {
     this.wss.close();
   }
 }
}

// Usage in server.js:
// const server = http.createServer(app);
// const webSocketService = new WebSocketService(server);
// module.exports = webSocketService;

module.exports = WebSocketService;