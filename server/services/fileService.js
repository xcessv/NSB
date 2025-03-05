const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class FileService {
 constructor() {
   this.storage = multer.diskStorage({
     destination: async (req, file, cb) => {
       let uploadPath = 'uploads/';
       
       // Determine subdirectory based on file type
       switch (file.fieldname) {
         case 'profileImage':
           uploadPath += 'profiles/';
           break;
         case 'reviewImage':
           uploadPath += 'reviews/';
           break;
         case 'newsImage':
           uploadPath += 'news/';
           break;
         default:
           uploadPath += 'misc/';
       }

       try {
         // Create directory if it doesn't exist
         await fs.mkdir(uploadPath, { recursive: true });
         cb(null, uploadPath);
       } catch (error) {
         cb(error);
       }
     },
     filename: (req, file, cb) => {
       // Generate unique filename
       const uniqueSuffix = '${Date.now()}-${crypto.randomBytes(6).toString('hex')}';
       cb(null, uniqueSuffix + path.extname(file.originalname));
     }
   });

   this.fileFilter = (req, file, cb) => {
     // Validate file types
     const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
     
     if (allowedTypes.includes(file.mimetype)) {
       cb(null, true);
     } else {
       cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'), false);
     }
   };

   this.upload = multer({
     storage: this.storage,
     fileFilter: this.fileFilter,
     limits: {
       fileSize: 5 * 1024 * 1024 // 5MB limit
     }
   });
 }

 handleUpload(fieldName) {
   return (req, res, next) => {
     this.upload.single(fieldName)(req, res, (err) => {
       if (err instanceof multer.MulterError) {
         if (err.code === 'LIMIT_FILE_SIZE') {
           return res.status(400).json({ 
             message: 'File is too large. Maximum size is 5MB' 
           });
         }
         return res.status(400).json({ message: err.message });
       } else if (err) {
         return res.status(400).json({ message: err.message });
       }
       next();
     });
   };
 }

 async deleteFile(filepath) {
   try {
     await fs.unlink(filepath);
     return true;
   } catch (error) {
     console.error('File deletion error:', error);
     return false;
   }
 }

 async replaceFile(oldPath, newFile) {
   try {
     // Delete old file if it exists
     if (oldPath) {
       await this.deleteFile(oldPath);
     }
     
     // Handle new file upload
     return await this.handleUpload(newFile);
   } catch (error) {
     console.error('File replacement error:', error);
     throw error;
   }
 }

 validateFileSize(file, maxSize = 5 * 1024 * 1024) {
   return file.size <= maxSize;
 }

 validateFileType(file, allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']) {
   return allowedTypes.includes(file.mimetype);
 }

 getFileExtension(filename) {
   return path.extname(filename);
 }

 generateUniqueFilename(originalFilename) {
   const extension = this.getFileExtension(originalFilename);
   const uniqueSuffix = '${Date.now()}-${crypto.randomBytes(6).toString('hex')}';
   return uniqueSuffix + extension;
 }

 async createUploadDirectories() {
   const directories = ['uploads', 'uploads/profiles', 'uploads/reviews', 'uploads/news'];
   
   for (const dir of directories) {
     try {
       await fs.mkdir(dir, { recursive: true });
     } catch (error) {
       console.error('Error creating directory ${dir}:', error);
       throw error;
     }
   }
 }

 getFilePath(type, filename) {
   const baseDir = 'uploads';
   switch (type) {
     case 'profile':
       return path.join(baseDir, 'profiles', filename);
     case 'review':
       return path.join(baseDir, 'reviews', filename);
     case 'news':
       return path.join(baseDir, 'news', filename);
     default:
       return path.join(baseDir, 'misc', filename);
   }
 }
}

const fileService = new FileService();
module.exports = fileService;