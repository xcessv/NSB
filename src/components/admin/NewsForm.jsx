import React, { useState, useEffect } from 'react';
import { 
  X, 
  Upload,
  Loader,
  AlertTriangle,
  ImageIcon,
  Plus,
  PinIcon,
  Tag,
  Check
} from 'lucide-react';
import { Card } from '../ui/card';
import PollForm from './PollForm';
import config from '../../config';

// Common tag presets
const TAG_PRESETS = [
  { text: 'Beef Madness', color: 'purple' },
  { text: 'Event', color: 'green' },
  { text: 'Important', color: 'red' },
  { text: 'Announcement', color: 'blue' },
  { text: 'Featured', color: 'amber' },
  { text: 'Sponsored', color: 'pink' },
  { text: 'Update', color: 'cyan' }
];

// Color options for tags
const TAG_COLORS = [
  { name: 'primary', value: 'primary' },
  { name: 'Red', value: 'red' },
  { name: 'Green', value: 'green' },
  { name: 'Blue', value: 'blue' },
  { name: 'Yellow', value: 'yellow' },
  { name: 'Purple', value: 'purple' },
  { name: 'Pink', value: 'pink' },
  { name: 'Orange', value: 'orange' },
  { name: 'Cyan', value: 'cyan' },
  { name: 'Amber', value: 'amber' },
  { name: 'Gray', value: 'gray' }
];

const NewsForm = ({ news = null, onClose, onSubmit, onRefreshContent = () => {}, currentUser }) => {
  // Initialize form data from news prop if available
  const [formData, setFormData] = useState({
    title: news?.title || '',
    content: news?.content || '',
    image: null,
    visible: news?.visible ?? true,
    tags: news?.tags || [],
    pinned: news?.pinned?.isPinned || false,
    pinnedLabel: news?.pinned?.label || ''
  });
  
  const [imagePreview, setImagePreview] = useState(
    news?.imageUrl ? (typeof config.getImageUrl === 'function' ? config.getImageUrl(news.imageUrl) : news.imageUrl) : ''
  );
  
  const [showPollForm, setShowPollForm] = useState(false);
  const [showTagForm, setShowTagForm] = useState(false);
  const [newTag, setNewTag] = useState({ text: '', color: 'primary' });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pollSubmitting, setPollSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newsId, setNewsId] = useState(news?._id || null);
  const [isDraft, setIsDraft] = useState(false);

  // Reset success message after a delay
  useEffect(() => {
    let timer;
    if (saveSuccess) {
      timer = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > (config.MAX_IMAGE_SIZE || 5 * 1024 * 1024)) {
      const sizeInMB = Math.round((config.MAX_IMAGE_SIZE || 5 * 1024 * 1024) / (1024 * 1024));
      setError(`Image size must be less than ${sizeInMB}MB`);
      return;
    }

    if (!((config.ALLOWED_IMAGE_TYPES && config.ALLOWED_IMAGE_TYPES.includes(file.type)) || file.type.startsWith('image/'))) {
      setError('File type not supported. Please upload an image.');
      return;
    }

    setFormData(prev => ({ ...prev, image: file }));
    setImagePreview(URL.createObjectURL(file));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser || currentUser.role !== 'admin') {
      setError('You must be an admin to submit news');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Log original tag data
      console.log('Original tags:', formData.tags);
      
      // Create FormData for submission
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('content', formData.content);
      submitData.append('visible', formData.visible);
      
      // CRITICAL FIX: Ensure tags are properly formatted and stringified
      // Even if there are no tags, send an empty array
      const processedTags = Array.isArray(formData.tags) ? formData.tags : [];
      console.log('Tags being sent (pre-stringify):', processedTags);
      
      // Stringify the tags array - important to use proper JSON 
      const tagsJSON = JSON.stringify(processedTags);
      console.log('Tags being sent (stringified):', tagsJSON);
      
      // Add as a plain string - don't use any special encoding
      submitData.append('tags', tagsJSON);
      
      // Add pinned data
      const pinnedData = {
        isPinned: Boolean(formData.pinned),
        label: formData.pinnedLabel || (formData.pinned ? 'Pinned News' : '')
      };
      submitData.append('pinned', JSON.stringify(pinnedData));
      
      if (formData.image) {
        submitData.append('image', formData.image);
      }
      
      // Add direct test tags for debugging
      // This is a backup to verify if direct tags work when form tags don't
      submitData.append('directTestTags', JSON.stringify([
        { text: "Test Tag 1", color: "green" },
        { text: "Test Tag 2", color: "blue" }
      ]));

      // Log submitted data
      console.log('Form data entries:');
      for (let pair of submitData.entries()) {
        console.log(pair[0], ':', typeof pair[1] === 'string' ? pair[1] : '[File or object]');
      }

      // Submit the form
      const response = await onSubmit(submitData);
      
      // Handle response
      if (response) {
        console.log('News saved successfully with response:', response);
        
        // Examine tags in response
        if (Array.isArray(response.tags)) {
          console.log('Tags saved in response:', response.tags);
        } else {
          console.warn('No tags array in response:', response);
        }
        
        // Store the news ID for poll creation
        if (response._id && !newsId) {
          setNewsId(response._id);
        }
        
        setSaveSuccess(true);
        
        // If we're not showing the poll form, close the news form
        if (!showPollForm) {
          onClose();
        }
        
        // Dispatch refresh event
        console.log('Dispatching content-updated event after save');
        const refreshEvent = new CustomEvent('content-updated');
        window.dispatchEvent(refreshEvent);
      }
    } catch (error) {
      console.error('News submission error:', error);
      setError(error.message || 'Failed to submit news');
    } finally {
      setLoading(false);
    }
  };
  
  const addTag = () => {
    if (!newTag.text.trim()) {
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, { ...newTag }]
    }));
    
    setNewTag({ text: '', color: 'primary' });
    setShowTagForm(false);
  };
  
  const removeTag = (index) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };
  
  // Improved poll submission handler
  const handlePollSubmit = async (pollData) => {
    if (!pollData || !pollData.question || !pollData.options || pollData.options.length < 2) {
      setError('Invalid poll data. Make sure to include a question and at least two options.');
      return;
    }
    
    setPollSubmitting(true);
    setError('');
    
    try {
      // If news doesn't exist yet, something is wrong (we should have saved it first)
      if (!newsId) {
        throw new Error('Missing news ID. Please save the news item first.');
      }
      
      console.log('Submitting poll for news ID:', newsId, 'with data:', pollData);
      
      // Now add the poll to the news item
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(`${config.API_URL}/news/${newsId}/poll`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pollData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Poll submission server error:', errorData);
        throw new Error(errorData.message || `Failed to add poll: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Poll added successfully:', result);
      
      // Poll added successfully
      setShowPollForm(false);
      setSaveSuccess(true);
      
      // Refresh content to show the updated news with poll
      if (onRefreshContent) {
        onRefreshContent();
      }
      
      // Show a message to the user that the poll was added but the post is still a draft
      if (isDraft || !formData.visible) {
        setError(''); // Clear any existing errors
        
        // Update message to show the user they need to publish
        setSaveSuccess(true);
        setTimeout(() => {
          // After a short delay, show a special message
          setError('Poll added successfully! You can now publish this news when ready.');
        }, 1500);
        
        // Don't close the form
      } else {
        // If it was already marked visible, close the form after a delay
        setTimeout(() => {
          onClose();
        }, 1500);
      }
      
      // Dispatch global event to refresh other views
      const refreshEvent = new Event('content-updated');
      window.dispatchEvent(refreshEvent);
    } catch (error) {
      console.error('Poll submission error:', error);
      setError(error.message || 'Failed to add poll');
    } finally {
      setPollSubmitting(false);
    }
  };
  
  const getTagColorClass = (color) => {
    switch (color) {
      case 'red': return 'bg-red-100 text-red-800';
      case 'green': return 'bg-green-100 text-green-800';
      case 'blue': return 'bg-blue-100 text-blue-800';
      case 'yellow': return 'bg-yellow-100 text-yellow-800';
      case 'purple': return 'bg-purple-100 text-purple-800';
      case 'pink': return 'bg-pink-100 text-pink-800';
      case 'orange': return 'bg-orange-100 text-orange-800';
      case 'cyan': return 'bg-cyan-100 text-cyan-800';
      case 'amber': return 'bg-amber-100 text-amber-800';
      case 'gray': return 'bg-gray-100 text-gray-800';
      default: return 'bg-primary/10 text-primary';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
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
              disabled={loading || pollSubmitting}
            >
              <X className="h-6 w-6 text-muted-foreground" />
            </button>
          </div>

          {/* Success Message */}
          {saveSuccess && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 flex items-center">
              <Check className="h-5 w-5 mr-2" />
              {news ? 'News updated successfully!' : 'News created successfully!'}
              {isDraft && ' (Saved as draft)'}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter news title..."
                required
                disabled={loading || pollSubmitting}
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Content
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Write your news content..."
                required
                disabled={loading || pollSubmitting}
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Image
              </label>
              <div className="flex items-center space-x-4">
                {imagePreview ? (
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
                      disabled={loading || pollSubmitting}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <label className={`flex items-center px-4 py-2 bg-secondary text-foreground rounded-lg cursor-pointer hover:bg-secondary/90 transition-colors ${
                  (loading || pollSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                }`}>
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={loading || pollSubmitting}
                  />
                </label>
              </div>
            </div>
            
            {/* Tags */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-foreground">
                  Tags
                </label>
                <button
                  type="button"
                  onClick={() => setShowTagForm(true)}
                  className="text-xs flex items-center text-primary hover:text-primary/80"
                  disabled={loading || pollSubmitting}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Tag
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagColorClass(tag.color)}`}
                  >
                    {tag.text}
                    <button
                      type="button"
                      onClick={() => removeTag(index)}
                      className="ml-1.5 h-3.5 w-3.5 rounded-full flex items-center justify-center hover:bg-black/20"
                      disabled={loading || pollSubmitting}
                    >
                      <X className="h-2 w-2" />
                    </button>
                  </span>
                ))}
                
                {formData.tags.length === 0 && (
                  <span className="text-sm text-muted-foreground">No tags added</span>
                )}
              </div>
              
              {showTagForm && (
                <div className="flex items-center space-x-2 mt-2 p-3 bg-secondary/30 rounded-lg">
                  <input
                    type="text"
                    value={newTag.text}
                    onChange={(e) => setNewTag({ ...newTag, text: e.target.value })}
                    className="flex-grow p-2 text-sm border border-border rounded-lg"
                    placeholder="Tag name"
                    disabled={loading || pollSubmitting}
                  />
                  
                  <select
                    value={newTag.color}
                    onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                    className="p-2 text-sm border border-border rounded-lg"
                    disabled={loading || pollSubmitting}
                  >
                    {TAG_COLORS.map((color) => (
                      <option key={color.value} value={color.value}>
                        {color.name}
                      </option>
                    ))}
                  </select>
                  
                  <button
                    type="button"
                    onClick={addTag}
                    className="p-2 bg-primary text-white rounded-lg text-sm"
                    disabled={loading || pollSubmitting}
                  >
                    Add
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setShowTagForm(false)}
                    className="p-2 text-muted-foreground"
                    disabled={loading || pollSubmitting}
                  >
                    Cancel
                  </button>
                </div>
              )}
              
              {!showTagForm && (
                <div className="text-xs text-muted-foreground mt-1">
                  Suggested: 
                  {TAG_PRESETS.map((preset, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        if (!formData.tags.some(tag => tag.text === preset.text)) {
                          setFormData(prev => ({
                            ...prev,
                            tags: [...prev.tags, { ...preset }]
                          }));
                        }
                      }}
                      className="ml-1 underline hover:text-foreground"
                      disabled={loading || pollSubmitting}
                    >
                      {preset.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Pin Settings */}
            <div>
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="pinned"
                  checked={formData.pinned}
                  onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  disabled={loading || pollSubmitting}
                />
                <label htmlFor="pinned" className="ml-2 text-sm font-medium text-foreground flex items-center">
                  <PinIcon className="h-4 w-4 mr-1" />
                  Pin this post
                </label>
              </div>
              
              {formData.pinned && (
                <div className="ml-6 mt-2">
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Pin Label
                  </label>
                  <input
                    type="text"
                    value={formData.pinnedLabel}
                    onChange={(e) => setFormData({ ...formData, pinnedLabel: e.target.value })}
                    className="w-full p-2 text-sm border border-border rounded-lg"
                    placeholder="Important News, Featured, etc."
                    disabled={loading || pollSubmitting}
                  />
                </div>
              )}
            </div>

            {/* Visibility Toggle */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="visible"
                checked={formData.visible}
                onChange={(e) => setFormData({ ...formData, visible: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary"
                disabled={loading || pollSubmitting}
              />
              <label htmlFor="visible" className="text-sm text-foreground">
                Publish immediately
              </label>
            </div>
            
            {/* Poll Creation Button */}
            <div className="pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  if (formData.title.trim() === '' || formData.content.trim() === '') {
                    setError('Please enter a title and content before adding a poll');
                    return;
                  }
                  
                  // If we already have a newsId (editing existing news), show the poll form
                  if (newsId) {
                    setShowPollForm(true);
                    return;
                  }
                  
                  // If creating new news, we need to handle temporary poll creation differently
                  if (!news) {
                    // Store a flag that we're in "poll creation mode"
                    localStorage.setItem('poll_creation_mode', 'true');
                    
                    // Show a dialog explaining what's happening
                    if (window.confirm(
                      'Adding a poll requires saving the news item first. ' +
                      'Would you like to save this news as a draft and add a poll now? ' +
                      'You can publish it after adding the poll.'
                    )) {
                      // User confirmed - do a draft save
                      const saveDraft = async () => {
                        try {
                          setLoading(true);
                          setError('');
                          
                          // Create the FormData object for submission
                          const submitData = new FormData();
                          submitData.append('title', formData.title);
                          submitData.append('content', formData.content);
                          submitData.append('visible', false); // Save as draft, not visible yet
                          
                          // Add tags and pinned data
                          submitData.append('tags', JSON.stringify(formData.tags));
                          submitData.append('pinned', JSON.stringify({
                            isPinned: formData.pinned,
                            label: formData.pinnedLabel
                          }));
                          
                          if (formData.image) {
                            submitData.append('image', formData.image);
                          }
                          
                          console.log('Saving draft news before showing poll form');
                          const response = await onSubmit(submitData);
                          
                          if (response && response._id) {
                            // Store the news ID for poll creation
                            setNewsId(response._id);
                            
                            // Mark as draft and show success message
                            setIsDraft(true);
                            setFormData(prev => ({
                              ...prev,
                              visible: false // Ensure the visible toggle reflects draft status
                            }));
                            setSaveSuccess(true);
                            
                            // Now show the poll form
                            setShowPollForm(true);
                          } else {
                            throw new Error('Failed to get valid response from save operation');
                          }
                        } catch (error) {
                          console.error('Error saving news draft before poll:', error);
                          setError(error.message || 'Failed to save news before adding poll');
                        } finally {
                          setLoading(false);
                        }
                      };
                      
                      // Call the function
                      saveDraft();
                    }
                  } else {
                    // This is an existing news item but without an ID (strange case)
                    setError('Cannot add poll: missing news ID. Try saving first.');
                  }
                }}
                className="flex items-center text-primary hover:text-primary/80"
                disabled={loading || pollSubmitting}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Poll to this post
              </button>
              
              {isDraft && newsId && (
                <p className="mt-2 text-xs text-green-500">
                  News saved as draft. You can add a poll and publish when ready.
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-foreground hover:bg-secondary rounded-lg transition-colors"
                disabled={loading || pollSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || pollSubmitting}
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
      
      {/* Poll Form Modal - Only show if newsId exists */}
      {showPollForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110]">
          <div className="w-full max-w-2xl mx-auto">
            <PollForm
              onSubmit={handlePollSubmit}
              onCancel={() => setShowPollForm(false)}
              isSubmitting={pollSubmitting}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsForm;