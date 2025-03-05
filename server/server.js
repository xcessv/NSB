const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
require('dotenv').config();
const fs = require('fs');

// Import services
const notificationService = require('./services/notificationService');
const activityService = require('./services/activityService');


const app = express();
const server = http.createServer(app);

// Initialize WebSocket for notifications
notificationService.initializeWebSocket(server);

// Middleware
app.use(cors({
  // Allow connections from any origin during development
  origin: '*', // This will accept any origin including your Android app
  // Alternative: specify multiple allowed origins
  // origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'capacitor://localhost'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

app.use((req, res, next) => {
  res.header('Cross-Origin-Embedder-Policy', 'require-corp');
  res.header('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Set up uploads directories
const uploadsDir = path.join(__dirname, 'uploads');
const profilesDir = path.join(uploadsDir, 'profiles');
const reviewsDir = path.join(uploadsDir, 'reviews');
const newsDir = path.join(uploadsDir, 'news');

// Create directories if they don't exist
[uploadsDir, profilesDir, reviewsDir, newsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    // Disable caching for all uploaded files
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/northshorebeefs';

console.log('Attempting to connect to MongoDB...');
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB:', MONGODB_URI);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Import routes
const reviewRoutes = require('./routes/reviewRoutes');
const userRoutes = require('./routes/userRoutes');
const { router: notificationRoutes } = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const newsRoutes = require('./routes/newsRoutes');
const activityRoutes = require('./routes/activityRoutes');
const { ACTIVITY_TYPES } = require('./routes/activityRoutes');
const reportRoutes = require('./routes/reportRoutes');

// WebSocket endpoint for notifications
app.get('/api/ws/notifications/:userId', (req, res) => {
  // WebSocket upgrade will be handled by the notification service
  res.end();
});

// API Routes
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminUserRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/admin', activityRoutes);
app.use('/api', reportRoutes);

// ACTIVITY_TYPES is available if needed
console.log('Available activity types:', ACTIVITY_TYPES);

// Redirect /api/uploads to /uploads
app.use('/api/uploads', (req, res) => {
  const newPath = req.url.replace('/api/uploads', '/uploads');
  res.redirect(newPath);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: process.env.npm_package_version || '1.0.0',
    websocket: wss?.clients?.size ?? 0
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  // Handle WebSocket errors
  if (err instanceof WebSocket.ErrorEvent) {
    console.error('WebSocket error:', err);
    return;
  }

  console.error('Error:', err);
  
  // Delete uploaded files if there's an error
  if (req.file && req.file.path) {
    fs.unlink(req.file.path, (unlinkError) => {
      if (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Handle 404s for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/build');
  
  if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
  } else {
    console.warn('Production build directory not found:', clientBuildPath);
  }
}

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Frontend URL:', process.env.FRONTEND_URL || 'http://localhost:5173');
  console.log('Server IP: 0.0.0.0 (all interfaces)');
  console.log('WebSocket server initialized');
});

// Track active WebSocket connections
const wss = notificationService.getWebSocketServer();
setInterval(() => {
  const activeConnections = wss?.clients?.size ?? 0;
  console.log(`Active WebSocket connections: ${activeConnections}`);
}, 300000); // Log every 5 minutes

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  
  try {
    // Close WebSocket server first
    if (wss) {
      await new Promise((resolve) => {
        wss.close(() => {
          console.log('WebSocket server closed');
          resolve();
        });
      });
    }

    // Close HTTP server
    await new Promise((resolve) => {
      server.close((err) => {
        if (err) {
          console.error('Error closing server:', err);
        }
        console.log('HTTP server closed');
        resolve();
      });
    });

    // Close database connection
    await mongoose.connection.close(false);
    console.log('MongoDB connection closed');

    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = server;