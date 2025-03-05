// src/utils/MediaCompression.js
import { isVideo, isGif } from './MediaUtils';

/**
 * Compresses an image using canvas
 * 
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width in pixels
 * @param {number} options.maxHeight - Maximum height in pixels
 * @param {number} options.quality - JPEG quality (0-1)
 * @returns {Promise<File>} Compressed image file
 */
export const compressImage = async (file, options = {}) => {
  // Skip GIFs - compressing animated GIFs requires specialized libraries
  if (isGif(file)) {
    console.log('Skipping GIF compression');
    return file;
  }
  
  // Skip small files
  const skipThreshold = options.skipThreshold || 512 * 1024; // Skip small files (default 512KB)
  if (file.size < skipThreshold) {
    console.log('File size below threshold, skipping compression');
    return file;
  }
  
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    mimeType = file.type
  } = options;

  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      
      img.onload = () => {
        try {
          // Create a canvas with the desired dimensions
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions while maintaining aspect ratio
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw image on canvas
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to blob
          canvas.toBlob((blob) => {
            if (!blob) {
              console.error('Canvas to Blob conversion failed');
              resolve(file); // Return original file if compression fails
              return;
            }
            
            // If the compressed blob is larger than the original, use the original
            if (blob.size >= file.size) {
              console.log('Compressed file is larger than original, using original');
              resolve(file);
              return;
            }
            
            // Create new File object
            const fileName = file.name.replace(/\.[^/.]+$/, "") + "_compressed" + 
                            (mimeType === 'image/jpeg' ? '.jpg' : 
                             mimeType === 'image/png' ? '.png' : '.webp');
                            
            try {
              const compressedFile = new File(
                [blob], 
                fileName,
                { type: mimeType }
              );
              
              // Add useful properties for debugging
              compressedFile.originalSize = file.size;
              compressedFile.compressedSize = blob.size;
              compressedFile.compressionRatio = (file.size / blob.size).toFixed(2) + 'x';
              
              console.log(`Image compressed: ${compressedFile.compressionRatio} reduction, ${(file.size/1024/1024).toFixed(2)}MB → ${(blob.size/1024/1024).toFixed(2)}MB`);
              
              resolve(compressedFile);
            } catch (fileError) {
              console.error('Error creating File object:', fileError);
              resolve(file); // Return original file on error
            }
          }, mimeType, quality);
        } catch (canvasError) {
          console.error('Canvas error during compression:', canvasError);
          resolve(file); // Return original file on error
        }
      };
      
      img.onerror = (error) => {
        console.error('Failed to load image for compression:', error);
        resolve(file); // Return original file on error
      };
      
      img.src = URL.createObjectURL(file);
    } catch (error) {
      console.error('Image compression error:', error);
      resolve(file); // Return original file on error
    }
  });
};

/**
 * Compresses a video using browser MediaRecorder API
 * For more advanced video compression, you can install @ffmpeg/ffmpeg and @ffmpeg/util
 * 
 * @param {File} file - The video file to compress
 * @param {Object} options - Compression options
 * @param {function} options.onProgress - Progress callback function
 * @returns {Promise<File>} Compressed video file or original if compression is not possible
 */
export const compressVideo = async (file, options = {}) => {
  try {
    // Skip small files
    const skipThreshold = options.skipThreshold || 1024 * 1024; // 1MB default
    if (file.size < skipThreshold) {
      console.log('Video size below threshold, skipping compression');
      return file;
    }
    
    // Check if the MediaRecorder API is supported
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported('video/webm')) {
      console.warn('Video compression not supported in this browser');
      return file;
    }
    
    // Create video element to load the file
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = false;
    video.playsInline = true;
    video.srcObject = null;
    
    // Default options
    const {
      videoWidth = 1280,
      videoHeight = 720,
      videoBitrate = 2500000, // 2.5 Mbps
      audioBitrate = 128000,   // 128 kbps
      onProgress = () => {},
      maxDuration = 300 // 5 minutes max duration for safety
    } = options;
    
    return new Promise((resolve, reject) => {
      // Set a timeout for the entire compression process
      const compressionTimeout = setTimeout(() => {
        console.warn('Video compression timed out, returning original file');
        cleanup();
        resolve(file);
      }, 180000); // 3 minute timeout
      
      // Cleanup function to prevent memory leaks
      const cleanup = () => {
        clearTimeout(compressionTimeout);
        if (video.src) URL.revokeObjectURL(video.src);
        
        // Stop any active streams
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        if (audioTrack) {
          audioTrack.stop();
        }
        
        // Make sure the video is stopped and freed
        video.pause();
        video.src = '';
        video.load();
      };
      
      let stream = null;
      let audioTrack = null;
      let recorder = null;
      
      // Set up the video element
      video.src = URL.createObjectURL(file);
      
      video.onloadedmetadata = async () => {
        try {
          // Safety check for video duration
          if (video.duration > maxDuration) {
            console.warn(`Video exceeds maximum duration (${maxDuration}s), returning original`);
            cleanup();
            resolve(file);
            return;
          }
          
          // Capture the video using a canvas and MediaRecorder
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(video.videoWidth, videoWidth);
          canvas.height = Math.min(video.videoHeight, videoHeight);
          const ctx = canvas.getContext('2d');
          
          // Ensure the canvas was created successfully
          if (!ctx) {
            console.error('Failed to get canvas context');
            cleanup();
            resolve(file);
            return;
          }
          
          try {
            stream = canvas.captureStream();
          } catch (streamError) {
            console.error('Failed to capture canvas stream:', streamError);
            cleanup();
            resolve(file);
            return;
          }
          
          // Try to add audio, but this might not work in all browsers
          try {
            // Create a dummy audio context to use as a source
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const dest = audioCtx.createMediaStreamDestination();
            
            // Add the audio track to the stream if we could get one
            if (dest.stream.getAudioTracks().length > 0) {
              audioTrack = dest.stream.getAudioTracks()[0];
              stream.addTrack(audioTrack);
            }
          } catch (audioError) {
            console.warn('Could not add audio track to compressed video:', audioError);
            // Continue without audio
          }
          
          // Check supported formats
          let mimeType = 'video/webm';
          if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            mimeType = 'video/webm;codecs=vp9';
          } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
            mimeType = 'video/webm;codecs=vp8';
          }
          
          // Configure the MediaRecorder with compression settings
          const recorderOptions = {
            mimeType,
            videoBitsPerSecond: videoBitrate,
            audioBitsPerSecond: audioBitrate
          };
          
          try {
            recorder = new MediaRecorder(stream, recorderOptions);
          } catch (recorderError) {
            console.error('Failed to create MediaRecorder:', recorderError);
            cleanup();
            resolve(file);
            return;
          }
          
          const chunks = [];
          
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
          };
          
          recorder.onerror = (error) => {
            console.error('MediaRecorder error:', error);
            cleanup();
            resolve(file); // Return original on error
          };
          
          recorder.onstop = () => {
            try {
              // Create a new file from the recorded chunks
              const blob = new Blob(chunks, { type: mimeType });
              
              // If compressed file is larger or has no data, return original
              if (blob.size === 0 || blob.size >= file.size) {
                console.log('Compressed video larger than original or empty, using original');
                cleanup();
                resolve(file);
                return;
              }
              
              const fileName = file.name.replace(/\.[^/.]+$/, "") + "_compressed.webm";
              
              const compressedFile = new File(
                [blob], 
                fileName, 
                { type: mimeType }
              );
              
              // Add useful properties for debugging
              compressedFile.originalSize = file.size;
              compressedFile.compressedSize = blob.size;
              compressedFile.compressionRatio = (file.size / blob.size).toFixed(2) + 'x';
              
              console.log(`Video compressed: ${compressedFile.compressionRatio} reduction, ${(file.size/1024/1024).toFixed(2)}MB → ${(blob.size/1024/1024).toFixed(2)}MB`);
              
              cleanup();
              resolve(compressedFile);
            } catch (error) {
              console.error('Error creating compressed video file:', error);
              cleanup();
              resolve(file); // Return original on error
            }
          };
          
          // Set up progress tracking
          const duration = video.duration * 1000;
          let progress = 0;
          const progressInterval = setInterval(() => {
            progress += 1;
            const percent = Math.min(Math.round((progress / duration) * 100), 99);
            onProgress(percent);
          }, 100);
          
          // Start recording
          recorder.start();
          
          // Play the video for recording
          try {
            await video.play();
          } catch (playError) {
            console.error('Error playing video:', playError);
            recorder.stop();
            clearInterval(progressInterval);
            cleanup();
            resolve(file);
            return;
          }
          
          // Draw each frame to the canvas
          const drawFrame = () => {
            if (!recorder || recorder.state === 'inactive') return;
            
            if (video.ended || video.paused) {
              recorder.stop();
              clearInterval(progressInterval);
              onProgress(100);
              return;
            }
            
            try {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              requestAnimationFrame(drawFrame);
            } catch (drawError) {
              console.error('Error drawing video frame:', drawError);
              // Try to continue anyway
              requestAnimationFrame(drawFrame);
            }
          };
          
          drawFrame();
          
          // Automatically stop after the video duration plus a small buffer
          setTimeout(() => {
            if (recorder && recorder.state === 'recording') {
              recorder.stop();
              clearInterval(progressInterval);
              onProgress(100);
            }
          }, video.duration * 1000 + 2000); // Add a 2 second buffer
          
        } catch (error) {
          console.error('Video compression error:', error);
          cleanup();
          // Return original file if compression fails
          onProgress(100);
          resolve(file);
        }
      };
      
      video.onerror = (error) => {
        console.error('Error loading video for compression:', error);
        cleanup();
        resolve(file); // Return original file on error
      };
    });
  } catch (error) {
    console.error('Video compression error:', error);
    // Always fall back to the original file if anything goes wrong
    if (typeof options.onProgress === 'function') {
      options.onProgress(100);
    }
    return file;
  }
};

/**
 * Dummy function that always returns false
 * Replace with actual implementation if you install FFmpeg
 */
export const loadFFmpeg = async () => {
  console.log('FFmpeg not installed. Using browser-based compression only.');
  return false;
};

/**
 * Compresses any media file based on its type
 * 
 * @param {File} file - The media file to compress
 * @param {Object} options - Compression options
 * @returns {Promise<File>} Compressed file or original if compression is not possible
 */
export const compressMedia = async (file, options = {}) => {
  if (!file) return null;
  
  try {
    // Skip if file is small enough already
    const skipThreshold = options.skipThreshold || 1024 * 1024; // 1MB default
    if (file.size < skipThreshold) {
      console.log('File size below threshold, skipping compression');
      return file;
    }
    
    // Compress based on file type
    if (file.type.startsWith('image/')) {
      return await compressImage(file, options);
    } else if (file.type.startsWith('video/')) {
      return await compressVideo(file, options);
    }
    
    // Return original for unsupported types
    return file;
    
  } catch (error) {
    console.error('Media compression error:', error);
    return file; // Return original file if compression fails
  }
};

/**
 * Example usage:
 * 
 * // In your form component:
 * const handleMediaChange = async (e) => {
 *   const file = e.target.files[0];
 *   if (!file) return;
 *   
 *   // Show loading indicator
 *   setMediaLoading(true);
 *   
 *   try {
 *     // Validate the file first
 *     const validation = validateMedia(file);
 *     if (!validation.valid) {
 *       setError(validation.error);
 *       return;
 *     }
 *     
 *     // Compress the file
 *     const compressedFile = await compressMedia(file, {
 *       maxWidth: 1920,
 *       maxHeight: 1080,
 *       quality: 0.8,
 *       onProgress: (percent) => {
 *         setCompressionProgress(percent);
 *       }
 *     });
 *     
 *     // Update form data with compressed file
 *     setFormData(prev => ({
 *       ...prev,
 *       media: compressedFile
 *     }));
 *     
 *     // Create preview URL
 *     const previewUrl = URL.createObjectURL(compressedFile);
 *     setMediaPreview(previewUrl);
 *     
 *   } catch (error) {
 *     console.error('Media processing error:', error);
 *     setError('Failed to process media');
 *   } finally {
 *     setMediaLoading(false);
 *   }
 * };
 */

export default {
  compressImage,
  compressVideo,
  compressMedia,
  loadFFmpeg
};