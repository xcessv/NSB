const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const reviewsDir = path.join(uploadsDir, 'reviews');
const newsDir = path.join(uploadsDir, 'news');
const profilesDir = path.join(uploadsDir, 'profiles');
fsSync.mkdirSync(reviewsDir, { recursive: true });
fsSync.mkdirSync(newsDir, { recursive: true });
fsSync.mkdirSync(profilesDir, { recursive: true });

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Choose destination based on field name
    switch (file.fieldname) {
      case 'media':
      case 'reviewMedia':
      case 'commentMedia':
        cb(null, reviewsDir);
        break;
      case 'image':
      case 'newsImage':
        cb(null, newsDir);
        break;
      case 'profileImage':
        cb(null, profilesDir);
        break;
      default:
        cb(new Error('Invalid field name for file upload'));
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Preserve original extension for proper mime type handling
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uniqueSuffix + ext);
  }
});

// Enhanced file filter with comprehensive MIME type support
const fileFilter = (req, file, cb) => {
  // Expanded MIME type list for better format support
  const allowedTypes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/x-gif',         // Alternative GIF MIME type
    'application/x-gif',   // Legacy GIF MIME type
    // Videos
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-msvideo',     // AVI format
    'video/mpeg'           // MPEG format
  ];

  // Check size before processing (10MB for images, 50MB for videos)
  const maxSize = file.mimetype.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  
  if (allowedTypes.includes(file.mimetype)) {
    // Add custom properties to track file info
    file.isImage = file.mimetype.startsWith('image/');
    file.isGif = file.mimetype.includes('gif');
    file.maxSize = maxSize;
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Supported formats: JPG, PNG, GIF, WebP, MP4, WebM'), false);
  }
};

// Create upload middleware with enhanced configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max, individual limits handled in fileFilter
    files: 1 // Only allow one file at a time
  }
});

// Update getRelativePath function to normalize paths
const getRelativePath = (absolutePath) => {
  if (!absolutePath) return null;

  // Normalize path separators to forward slashes
  const normalizedPath = absolutePath.replace(/\\/g, '/');
  
  // Get the relative path based on directory
  if (normalizedPath.includes('/uploads/reviews/')) {
    const relativePath = normalizedPath.split('/uploads/reviews/')[1];
    return `reviews/${relativePath}`;
  } else if (normalizedPath.includes('/uploads/news/')) {
    const relativePath = normalizedPath.split('/uploads/news/')[1];
    return `news/${relativePath}`;
  } else if (normalizedPath.includes('/uploads/profiles/')) {
    const relativePath = normalizedPath.split('/uploads/profiles/')[1];
    return `profiles/${relativePath}`;
  }
  
  // Fallback to just the filename
  const filenameParts = normalizedPath.split('/');
  return filenameParts[filenameParts.length - 1];
};

// Enhanced file upload middleware with better error handling
const handleFileUpload = (fieldName) => [
  (req, res, next) => {
    console.log(`Processing file upload for field: ${fieldName}`);
    
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        console.error('File upload error:', err);
        
        // Enhanced error messages
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              message: 'File is too large. Maximum size is 10MB for images and 50MB for videos'
            });
          }
        }
        
        return res.status(400).json({
          message: err.message || 'Error uploading file'
        });
      }

      if (req.file) {
        // Store a consistent relative path format
        const relativePath = getRelativePath(req.file.path);
        req.file.relativePath = relativePath;
        
        // Additional metadata for client use
        req.file.isGif = req.file.mimetype.includes('gif');
        req.file.isImage = req.file.mimetype.startsWith('image/');
        
        console.log('File uploaded:', {
          originalPath: req.file.path,
          relativePath: relativePath,
          fieldName: fieldName,
          mime: req.file.mimetype,
          size: req.file.size
        });
      }

      next();
    });
  }
];

// Enhanced file deletion utility with better error handling
const deleteFile = async (filePath) => {
  if (!filePath) return false;

  try {
    // Handle different path formats
    let fullPath;
    if (filePath.startsWith('/uploads/')) {
      fullPath = path.join(__dirname, '..', filePath);
    } else if (filePath.includes(':\\') || filePath.includes('/Users/')) {
      fullPath = filePath;
    } else {
      fullPath = path.join(uploadsDir, filePath);
    }

    // Normalize path for consistency
    fullPath = fullPath.replace(/\\/g, '/');
    console.log('Attempting to delete file:', fullPath);
    
    const exists = await fs.access(fullPath)
      .then(() => true)
      .catch(() => false);

    if (exists) {
      await fs.unlink(fullPath);
      console.log('Successfully deleted file:', fullPath);
      return true;
    } else {
      console.log('File not found for deletion:', fullPath);
      return false;
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

module.exports = {
  handleFileUpload,
  deleteFile
};