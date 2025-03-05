// src/components/review/MediaUploadSection.jsx
import React, { useState, useEffect } from 'react';
import { Upload, X, ImageIcon, Loader } from 'lucide-react';
import { validateMedia, getMediaPreviewUrl, revokeMediaPreview, isVideo } from '../../utils/MediaUtils';
import { compressMedia, loadFFmpeg } from '../../utils/FFmpegMediaCompression';
import config from '../../config';

const MediaUploadSection = ({ 
  formData, 
  setFormData, 
  mediaPreview, 
  setMediaPreview,
  setFormTouched,
  setError 
}) => {
  const [mediaLoading, setMediaLoading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionStats, setCompressionStats] = useState(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  
  // Check for SharedArrayBuffer support
  const hasSharedArrayBufferSupport = typeof window !== 'undefined' && 
    typeof window.SharedArrayBuffer !== 'undefined';
  
  // Pre-load FFmpeg when component mounts
  useEffect(() => {
    // Only try to pre-load if this browser supports SharedArrayBuffer
    // This is required for FFmpeg.wasm in most browsers
    if (hasSharedArrayBufferSupport && window.crossOriginIsolated) {
      loadFFmpeg()
        .then(() => {
          console.log('FFmpeg loaded successfully');
          setFfmpegLoaded(true);
        })
        .catch(err => {
          console.warn('Failed to preload FFmpeg, will load on demand:', err);
        });
    }
  }, []);

  // Handle media change with FFmpeg compression
  const handleMediaChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show loading indicator
    setMediaLoading(true);
    setCompressionProgress(0);
    setError('');

    try {
      // 1. Validate media first
      const validation = validateMedia(file, {
        maxImageSize: config.MAX_IMAGE_SIZE || 10 * 1024 * 1024,
        maxVideoSize: config.MAX_VIDEO_SIZE || 100 * 1024 * 1024,
        allowedImageTypes: config.ALLOWED_IMAGE_TYPES || ['image/jpeg', 'image/png', 'image/gif'],
        allowedVideoTypes: config.ALLOWED_VIDEO_TYPES || ['video/mp4', 'video/quicktime', 'video/webm']
      });

      if (!validation.valid) {
        setError(validation.error);
        e.target.value = null; // Clear input
        setMediaLoading(false);
        return;
      }

      // 2. Revoke previous preview URL if it exists
      if (mediaPreview && mediaPreview.startsWith('blob:')) {
        revokeMediaPreview(mediaPreview);
      }

      // 3. Show a temporary preview of the original file while compressing
      const tempPreview = URL.createObjectURL(file);
      setMediaPreview(tempPreview);
      
      // 4. Compress the media file with progress tracking for videos
      const isVideoFile = isVideo(file);
      
      // Only try video compression with FFmpeg if the browser supports it
      const canUseFFmpegForVideo = hasSharedArrayBufferSupport && 
                                  window.crossOriginIsolated && 
                                  isVideoFile;
      
      // Configure compression options
      const compressionOptions = {
        // Image options
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.8,
        
        // Video options (FFmpeg)
        preset: 'medium',      // Compression preset
        crf: 23,               // Quality factor (lower = better)
        scale: '1280:720',     // Output resolution
        bitrate: '2M',         // Target bitrate
        
        // Progress tracking for videos
        onProgress: canUseFFmpegForVideo ? (percent) => {
          setCompressionProgress(percent);
        } : undefined,
        
        // General options
        skipThreshold: 512 * 1024 // Skip compression for files under 512KB
      };
      
      // Log what we're doing
      console.log(`Processing ${isVideoFile ? 'video' : 'image'} file:`, {
        size: (file.size / (1024 * 1024)).toFixed(2) + 'MB',
        type: file.type, 
        name: file.name,
        usingFFmpeg: canUseFFmpegForVideo
      });
      
      const compressedFile = await compressMedia(file, compressionOptions);

      // 5. Revoke the temporary preview
      URL.revokeObjectURL(tempPreview);
      
      // 6. Create final preview URL
      const finalPreview = URL.createObjectURL(compressedFile);
      setMediaPreview(finalPreview);
      
      // 7. Track compression statistics
      if (compressedFile.compressionRatio) {
        setCompressionStats({
          originalSize: (file.size / (1024 * 1024)).toFixed(2) + 'MB',
          compressedSize: (compressedFile.size / (1024 * 1024)).toFixed(2) + 'MB',
          ratio: compressedFile.compressionRatio
        });
      }
      
      // 8. Update form data with compressed file
      setFormData(prev => ({ ...prev, media: compressedFile }));
      setFormTouched(true);
      
    } catch (error) {
      console.error('Media processing error:', error);
      setError('Failed to process media. Using original file instead.');
      
      // Fallback to original file if compression fails
      const previewUrl = URL.createObjectURL(file);
      setMediaPreview(previewUrl);
      setFormData(prev => ({ ...prev, media: file }));
      
    } finally {
      setMediaLoading(false);
      setCompressionProgress(0);
      e.target.value = null; // Reset file input
    }
  };
  
  // Handle media removal
  const handleRemoveMedia = () => {
    if (mediaPreview && mediaPreview.startsWith('blob:')) {
      revokeMediaPreview(mediaPreview);
    }
    
    setMediaPreview('');
    setFormData(prev => ({ ...prev, media: null }));
    setCompressionStats(null);
    setFormTouched(true);
  };
  
  // Render compression stats
  const renderCompressionStats = () => {
    if (!compressionStats) return null;
    
    return (
      <div className="mt-2 text-xs text-green-500">
        Compressed: {compressionStats.originalSize} → {compressionStats.compressedSize} ({compressionStats.ratio} reduction)
      </div>
    );
  };
  
  // Render loading/progress state
  const renderLoadingState = () => {
    if (!mediaLoading) return null;
    
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="relative h-10 w-10">
          <Loader className="h-10 w-10 animate-spin text-primary" />
          {compressionProgress > 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
              {compressionProgress}%
            </div>
          )}
        </div>
        <span className="text-xs mt-2 text-muted-foreground">
          {compressionProgress > 0 
            ? 'Compressing video...' 
            : 'Processing media...'}
        </span>
      </div>
    );
  };
  
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Add Photo/Video
      </label>
      <div className="flex items-center space-x-4">
        {mediaPreview ? (
          <div className="relative group">
            {formData.media?.type?.startsWith('image/') || (!formData.media?.type && mediaPreview) ? (
              <img
                src={mediaPreview}
                alt="Preview"
                className="w-32 h-32 object-cover rounded-lg"
              />
            ) : (
              <video
                src={mediaPreview}
                className="w-32 h-32 object-cover rounded-lg"
                controls
              />
            )}
            <button
              type="button"
              onClick={handleRemoveMedia}
              className="absolute top-1 right-1 p-1 bg-card rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4 text-slate-500" />
            </button>
            {renderCompressionStats()}
          </div>
        ) : (
          <div className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center">
            {mediaLoading ? renderLoadingState() : (
              <ImageIcon className="h-8 w-8 text-slate-400" />
            )}
          </div>
        )}
        <label className={`flex items-center px-4 py-2 bg-secondary text-slate-700 rounded-lg ${mediaLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-border'} transition-colors`}>
          <Upload className="h-5 w-5 mr-2" />
          {mediaLoading ? 'Processing...' : 'Upload Media'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,video/mp4,video/quicktime,video/webm"
            onChange={handleMediaChange}
            className="hidden"
            disabled={mediaLoading}
          />
        </label>
      </div>
      
      <p className="mt-2 text-sm text-slate-500">
        Supported formats: JPG, PNG, GIF, MP4, MOV (QuickTime), WebM (max {(config.MAX_FILE_SIZE || 100 * 1024 * 1024) / (1024 * 1024)}MB)
        {!hasSharedArrayBufferSupport && (
          <span className="block text-yellow-500 mt-1">
            Note: Advanced video compression not supported in this browser. Basic compression will be used instead.
          </span>
        )}
        {compressionStats && (
          <span className="block text-green-500 mt-1">
            Your upload was automatically compressed for better performance!
          </span>
        )}
      </p>
    </div>
  );
};

export default MediaUploadSection;