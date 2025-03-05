import React, { useState } from 'react';
import { 
  X, 
  Image as ImageIcon,
  Upload,
  Loader
} from 'lucide-react';
import { Card } from '../ui/card';

const NewsModal = ({ news = null, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: news?.title || '',
    content: news?.content || '',
    image: null,
    visible: news?.visible ?? true
  });
  const [imagePreview, setImagePreview] = useState(news?.imageUrl || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 50 * 1024 * 1024) {
        setError('Image size must be less than 50MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('File must be an image');
        return;
      }

      setFormData({ ...formData, image: file });
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate form data
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      if (!formData.content.trim()) {
        throw new Error('Content is required');
      }

      // Create FormData for file upload
      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null) {
          submitData.append(key, formData[key]);
        }
      });

      await onSubmit(submitData);
      onClose();
    } catch (error) {
      setError(error.message || 'Failed to save news');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-card shadow-xl rounded-2xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              {news ? 'Edit News' : 'Add News'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-full transition-colors"
            >
              <X className="h-6 w-6 text-slate-500" />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center">
              <X className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter news title..."
                required
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Content
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Write your news content..."
                required
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Image
              </label>
              <div className="flex items-center space-x-4">
                {/* Image Preview */}
                {imagePreview && (
                  <div className="relative group">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-32 h-24 object-cover rounded-lg border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview('');
                        setFormData({ ...formData, image: null });
                      }}
                      className="absolute top-1 right-1 p-1 bg-card rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                )}

                {/* Upload Button */}
                <label className="flex flex-col items-center justify-center w-32 h-24 border-2 border-dashed border-slate-300 rounded-lg hover:border-primary cursor-pointer transition-colors">
                  <ImageIcon className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-sm text-slate-500">Upload image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Recommended: 1200x630px, max 50MB
              </p>
            </div>

            {/* Visibility Toggle */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="visible"
                checked={formData.visible}
                onChange={(e) => setFormData({ ...formData, visible: e.target.checked })}
                className="rounded border-slate-300 text-primary focus:ring-primary"
              />
              <label htmlFor="visible" className="text-sm text-slate-700">
                Publish immediately
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-700 hover:bg-secondary rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>{news ? 'Update News' : 'Add News'}</>
                )}
              </button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default NewsModal;