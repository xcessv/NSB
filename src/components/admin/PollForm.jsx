import React, { useState, useEffect } from 'react';
import { X, Plus, Image, Loader, AlertTriangle, Check } from 'lucide-react';
import { Card } from '../ui/card';
import config from '../../config';

const PollForm = ({ initialPoll = null, onSubmit, onCancel, isSubmitting = false }) => {
  const [formData, setFormData] = useState({
    question: initialPoll?.question || '',
    options: initialPoll?.options?.length > 0
      ? initialPoll.options.map(opt => ({
          title: opt.title || '',
          imageUrl: opt.imageUrl || ''
        }))
      : [{ title: '', imageUrl: '' }, { title: '', imageUrl: '' }]
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({
    question: false,
    options: {}
  });
  
  // When parent signals submission is in progress
  useEffect(() => {
    setLoading(isSubmitting);
  }, [isSubmitting]);
  
  // Mark fields as touched when user interacts with them
  const markTouched = (field, index = null) => {
    if (index !== null) {
      setTouchedFields(prev => ({
        ...prev,
        options: { ...prev.options, [index]: true }
      }));
    } else {
      setTouchedFields(prev => ({
        ...prev,
        [field]: true
      }));
    }
  };
  
  const handleOptionChange = (index, field, value) => {
    const updatedOptions = [...formData.options];
    updatedOptions[index] = {
      ...updatedOptions[index],
      [field]: value
    };
    setFormData({
      ...formData,
      options: updatedOptions
    });
    
    // Mark this option as touched
    markTouched('options', index);
  };
  
  const addOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { title: '', imageUrl: '' }]
    });
  };
  
  const removeOption = (index) => {
    if (formData.options.length <= 2) {
      setError('A poll requires at least two options');
      return;
    }
    
    const updatedOptions = [...formData.options];
    updatedOptions.splice(index, 1);
    
    // Update touched fields when removing an option
    const updatedTouchedOptions = { ...touchedFields.options };
    delete updatedTouchedOptions[index];
    
    // Renumber the keys for higher indices
    const newTouchedOptions = {};
    Object.keys(updatedTouchedOptions).forEach(key => {
      const keyNum = parseInt(key, 10);
      if (keyNum > index) {
        newTouchedOptions[keyNum - 1] = updatedTouchedOptions[key];
      } else {
        newTouchedOptions[key] = updatedTouchedOptions[key];
      }
    });
    
    setTouchedFields({
      ...touchedFields,
      options: newTouchedOptions
    });
    
    setFormData({
      ...formData,
      options: updatedOptions
    });
  };
  
  const handleImageUpload = async (index, file) => {
    if (!file) return;
    
    // Clear previous errors for this image
    setImageErrors(prev => ({
      ...prev,
      [index]: null
    }));
    
    // Validate file size (default 5MB unless configured otherwise)
    const maxSize = config.MAX_IMAGE_SIZE || 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const sizeInMB = Math.round(maxSize / (1024 * 1024));
      setImageErrors(prev => ({
        ...prev,
        [index]: `Image must be less than ${sizeInMB}MB`
      }));
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setImageErrors(prev => ({
        ...prev,
        [index]: 'File must be an image'
      }));
      return;
    }
    
    try {
      // In a real implementation, upload to server
      // For now, create a data URL for preview
      const reader = new FileReader();
      reader.onloadend = () => {
        handleOptionChange(index, 'imageUrl', reader.result);
      };
      reader.onerror = () => {
        setImageErrors(prev => ({
          ...prev,
          [index]: 'Failed to load image'
        }));
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Image processing error:', err);
      setImageErrors(prev => ({
        ...prev,
        [index]: 'Error processing image'
      }));
    }
  };
  
  const validateField = (field, value, index = null) => {
    if (field === 'question') {
      return value.trim() ? null : 'Question is required';
    } else if (field === 'option' && index !== null) {
      return value.trim() ? null : `Option ${index + 1} title is required`;
    }
    return null;
  };
  
  const validateForm = () => {
    let valid = true;
    let newError = null;
    
    // Validate question
    if (!formData.question.trim()) {
      newError = 'Poll question is required';
      valid = false;
    }
    
    // Count valid options
    const validOptions = formData.options.filter(opt => opt.title.trim());
    if (validOptions.length < 2) {
      newError = 'At least two options with titles are required';
      valid = false;
    }
    
    // Check for any image errors
    if (Object.values(imageErrors).some(error => error !== null)) {
      newError = 'Please fix the image errors before continuing';
      valid = false;
    }
    
    setError(newError);
    return valid;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Mark all fields as touched for validation
    setTouchedFields({
      question: true,
      options: formData.options.reduce((acc, _, index) => {
        acc[index] = true;
        return acc;
      }, {})
    });
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Filter out empty options
      const validOptions = formData.options
        .filter(opt => opt.title.trim())
        .map(opt => ({
          title: opt.title.trim(),
          imageUrl: opt.imageUrl || null
        }));
      
      // Call parent's onSubmit handler
      await onSubmit({
        question: formData.question.trim(),
        options: validOptions,
        active: true // New polls are active by default
      });
    } catch (error) {
      console.error('Poll submission error:', error);
      setError(error.message || 'Failed to save poll');
      setLoading(false); // Only set loading false on error, success is handled by parent
    }
  };
  
  // Render field error if touched and invalid
  const getFieldError = (field, index = null) => {
    if (field === 'question' && touchedFields.question) {
      return validateField('question', formData.question);
    } else if (field === 'option' && index !== null && touchedFields.options[index]) {
      return validateField('option', formData.options[index].title, index);
    }
    return null;
  };
  
  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-foreground">
          {initialPoll ? 'Edit Poll' : 'Create Poll'}
        </h3>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-secondary rounded-full transition-colors"
          disabled={loading}
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg text-red-600 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Poll Question */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Poll Question
          </label>
          <input
            type="text"
            value={formData.question}
            onChange={(e) => {
              setFormData({ ...formData, question: e.target.value });
              markTouched('question');
            }}
            className={`w-full p-3 border ${
              getFieldError('question') 
                ? 'border-red-300 focus:ring-red-500' 
                : 'border-border focus:ring-primary'
            } rounded-lg focus:ring-2 focus:border-transparent`}
            placeholder="What's your favorite beef?"
            required
            disabled={loading}
          />
          {getFieldError('question') && (
            <p className="mt-1 text-sm text-red-500">{getFieldError('question')}</p>
          )}
        </div>
        
        {/* Poll Options */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Options
          </label>
          
          <div className="space-y-3">
            {formData.options.map((option, index) => (
              <div key={index} className="flex items-start space-x-2">
                <div className="flex-grow">
                  <input
                    type="text"
                    value={option.title}
                    onChange={(e) => handleOptionChange(index, 'title', e.target.value)}
                    className={`w-full p-3 border ${
                      getFieldError('option', index) 
                        ? 'border-red-300 focus:ring-red-500' 
                        : 'border-border focus:ring-primary'
                    } rounded-lg focus:ring-2 focus:border-transparent`}
                    placeholder={`Option ${index + 1}`}
                    required
                    disabled={loading}
                  />
                  {getFieldError('option', index) && (
                    <p className="mt-1 text-sm text-red-500">{getFieldError('option', index)}</p>
                  )}
                </div>
                
                <div className="w-20 h-20 flex-shrink-0">
                  {option.imageUrl ? (
                    <div className="relative h-full w-full group">
                      <img
                        src={option.imageUrl}
                        alt={option.title || `Option ${index + 1}`}
                        className="h-full w-full object-cover rounded-lg border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => handleOptionChange(index, 'imageUrl', '')}
                        className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center h-full w-full border-2 border-dashed ${
                      imageErrors[index] ? 'border-red-300' : 'border-border'
                    } rounded-lg cursor-pointer hover:border-primary/50 transition-colors ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}>
                      <Image className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Add Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleImageUpload(index, e.target.files[0]);
                          }
                        }}
                        disabled={loading}
                      />
                    </label>
                  )}
                  {imageErrors[index] && (
                    <p className="mt-1 text-xs text-red-500">{imageErrors[index]}</p>
                  )}
                </div>
                
                {formData.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors"
                    disabled={loading}
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          
          <button
            type="button"
            onClick={addOption}
            className={`mt-3 flex items-center px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={loading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Option
          </button>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-foreground hover:bg-secondary rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Poll'
            )}
          </button>
        </div>
      </form>
    </Card>
  );
};

export default PollForm;