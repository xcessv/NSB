const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const mediaProcessor = {
  async compressVideo(inputPath) {
    const outputPath = inputPath.replace(/\.[^/.]+$/, '') + '_compressed.mp4';
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .size('720x?') // Maintain aspect ratio
        .videoBitrate('1000k')
        .audioCodec('aac')
        .audioBitrate('128k')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .run();
    });
  },

  async generateThumbnail(inputPath, isVideo) {
    const thumbnailPath = inputPath.replace(/\.[^/.]+$/, '') + '_thumb.jpg';

    if (isVideo) {
      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .screenshots({
            timestamps: ['00:00:01'],
            filename: path.basename(thumbnailPath),
            folder: path.dirname(thumbnailPath),
            size: '320x240'
          })
          .on('end', () => resolve(thumbnailPath))
          .on('error', (err) => reject(err));
      });
    } else {
      // For images, create a resized version
      await sharp(inputPath)
        .resize(320, 240, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);
      
      return thumbnailPath;
    }
  },

  async processMedia(file) {
    const isVideo = file.mimetype.startsWith('video/');
    const results = {
      originalPath: file.path,
      thumbnailPath: null,
      compressedPath: null
    };

    try {
      // Generate thumbnail
      results.thumbnailPath = await this.generateThumbnail(file.path, isVideo);

      // Compress video if it's a video file
      if (isVideo) {
        results.compressedPath = await this.compressVideo(file.path);
      }

      return results;
    } catch (error) {
      // Clean up any created files if there's an error
      const filesToDelete = [
        results.thumbnailPath,
        results.compressedPath
      ].filter(Boolean);

      await Promise.all(
        filesToDelete.map(filePath => 
          fs.unlink(filePath).catch(() => {})
        )
      );

      throw error;
    }
  }
};

module.exports = mediaProcessor;