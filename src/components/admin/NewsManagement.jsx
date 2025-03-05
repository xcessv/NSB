import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { userService, adminService, newsService } from '../../services/api';
import { 
  X, 
  ThumbsUp, 
  Calendar, 
  User, 
  Pencil, 
  Trash2, 
  Eye, 
  EyeOff,
  Loader,
  Plus,
  BarChart2,
  AlertTriangle,
  Pin,
  Tag
} from 'lucide-react';
import NewsForm from './NewsForm';
import config from '../../config';

const NewsManagement = ({ currentUser }) => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  console.log('NewsManagement - Current User:', {
    user: currentUser,
    role: currentUser?.role,
    id: currentUser?._id
  });

  // Helper function for API updates
  const updateNews = async (newsId, newsData) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');

    // Try with PUT method to update the entire news item
    const response = await fetch(`${config.API_URL}/news/${newsId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newsData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update news: ${response.status}`);
    }
    
    return await response.json();
  };

  // Modify fetchNews function to accept a forceRefresh parameter
const fetchNews = async (forceRefresh = false) => {
  try {
    setLoading(true);
    setError(null);
    
    // Use getNews with the forceRefresh parameter
    const response = await newsService.getNews({ forceRefresh });
    
    // Log the response to help debug
    console.log('News API response:', response);
    
    // Make sure we have a valid response
    if (response && Array.isArray(response.news)) {
      setNews(response.news);
    } else if (response && Array.isArray(response)) {
      // Handle case where response might be the array directly
      setNews(response);
    } else {
      console.error('Unexpected news response format:', response);
      setNews([]);
    }
  } catch (error) {
    console.error('Failed to fetch news:', error);
    setError('Failed to load news. Please try again later.');
  } finally {
    setLoading(false);
  }
};

  // This effect will run when the component mounts and when refreshTrigger changes
  useEffect(() => {
    fetchNews();
  }, [refreshTrigger]);

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
  };

  const handleAddNews = async (formData) => {
    try {
      console.log('Adding news with user:', currentUser);
      const response = await newsService.addNews(formData);
      // Add the new news item to the list without refetching everything
      if (response && response._id) {
        setNews(prev => [response, ...prev]);
      } else {
        // If we didn't get a proper response, force a refresh
        setRefreshTrigger(prev => prev + 1);
      }
      return response;
    } catch (error) {
      console.error('Error adding news:', error);
      throw error;
    }
  };

  const handleUpdateNews = async (formData) => {
    try {
      const response = await newsService.updateNews(editingNews._id, formData);
      
      // Update the news item in our local state
      if (response && response._id) {
        setNews(prev => prev.map(item => 
          item._id === response._id ? response : item
        ));
      } else {
        // If we didn't get a proper response, force a refresh
        setRefreshTrigger(prev => prev + 1);
      }
      
      setEditingNews(null);
      return response;
    } catch (error) {
      console.error('Error updating news:', error);
      throw error;
    }
  };

  const handleDeleteNews = async (newsId) => {
  if (window.confirm('Are you sure you want to delete this news item?')) {
    try {
      await newsService.deleteNews(newsId);
      // Remove the deleted item from our state
      setNews(prevNews => prevNews.filter(item => item._id !== newsId));
      
      // Dispatch a refresh event in case the service didn't do it
      console.log('Dispatching backup content-updated event after delete');
      const refreshEvent = new CustomEvent('content-updated', {
        detail: { type: 'news-deleted', id: newsId }
      });
      window.dispatchEvent(refreshEvent);
    } catch (error) {
      console.error('Delete news error:', error);
      setError('Failed to delete news item. Please try again.');
    }
  }
};

  const handleToggleVisibility = async (newsId, currentVisibility) => {
  try {
    // Find the current news item to get all its data
    const newsItem = news.find(item => item._id === newsId);
    if (!newsItem) {
      throw new Error('News item not found');
    }

    // Create a copy of the news item to avoid direct state mutation
    const updatedNewsItem = { ...newsItem, visible: !currentVisibility };

    // Optimistically update the UI immediately
    setNews(prevNews => prevNews.map(item => 
      item._id === newsId ? updatedNewsItem : item
    ));

    // Make API call to update visibility
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${config.API_URL}/news/${newsId}/visibility`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ visible: !currentVisibility })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to update visibility: ${response.status}`);
    }

    // Get updated news data
    const result = await response.json();
    const serverUpdatedNews = result.news || result;
    
    // If we got back the full news item, use it to update state
    if (serverUpdatedNews && typeof serverUpdatedNews === 'object' && serverUpdatedNews._id) {
      setNews(prevNews => prevNews.map(item => 
        item._id === newsId ? serverUpdatedNews : item
      ));
    }
    
    // Otherwise, at least ensure the visibility property is updated correctly
    else {
      setNews(prevNews => prevNews.map(item => 
        item._id === newsId ? { ...item, visible: !currentVisibility } : item
      ));
    }
    
    // Log what happened (for debugging)
    console.log(`Visibility toggled successfully for news ${newsId}. New visibility:`, !currentVisibility);
  } catch (error) {
    console.error('Toggle visibility error:', error);
    
    // Revert the optimistic update if we had a fundamental error
    setNews(prevNews => prevNews.map(item => 
      item._id === newsId ? { ...item, visible: currentVisibility } : item
    ));
    
    setError('Failed to change visibility. Please try again.');
  }
};

  const handleTogglePinning = async (newsId) => {
  try {
    // Find the current news item to get all its data
    const newsItem = news.find(item => item._id === newsId);
    if (!newsItem) {
      throw new Error('News item not found');
    }

    // Determine current pinned state - simplified and more robust approach
    const isPinnedCurrent = Boolean(
      typeof newsItem.pinned === 'object' && newsItem.pinned !== null 
        ? newsItem.pinned.isPinned 
        : newsItem.pinned
    );
    
    console.log('Current pinned state:', isPinnedCurrent);
    
    // Get the pin label (use existing or default)
    const pinLabel = (newsItem.pinned && newsItem.pinned.label) || 'Pinned News';

    // New state is the opposite of current state
    const newPinnedState = !isPinnedCurrent;
    console.log('New pinned state will be:', newPinnedState);
    
    // Optimistically update the UI immediately
    setNews(prevNews => prevNews.map(item => 
      item._id === newsId 
        ? { 
            ...item, 
            pinned: {
              isPinned: newPinnedState,
              label: pinLabel,
              pinnedAt: newPinnedState ? new Date() : null
            } 
          }
        : item
    ));

    // Use direct fetch for maximum control over the request
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');

    // Define the request payload
    const payload = {
      isPinned: newPinnedState,
      label: pinLabel
    };
    
    console.log('Sending pin update with payload:', payload);

    // Make the API call
    const response = await fetch(`${config.API_URL}/news/${newsId}/pin`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pin update API error:', errorText);
      throw new Error(`Failed to update pin status: ${response.status}`);
    }

    // Parse the response
    const updatedNews = await response.json();
    console.log('Pin update response:', updatedNews);
    
    // *** CRITICAL FIX PART 1: Explicitly clear news cache ***
    cacheHelpers.clear('news-data');
    
    // Update the news item in local state with server response
    setNews(prevNews => prevNews.map(item => 
      item._id === newsId ? {
        ...updatedNews,
        pinned: typeof updatedNews.pinned === 'object' 
          ? updatedNews.pinned 
          : { isPinned: Boolean(updatedNews.pinned), label: pinLabel }
      } : item
    ));
    
    // Dispatch global event for other components to refresh
    console.log('Dispatching content-updated event for pin change');
    const refreshEvent = new CustomEvent('content-updated');
    window.dispatchEvent(refreshEvent);
    
    // *** CRITICAL FIX PART 2: Force fresh data fetch ***
    await fetchNews(true); // Add parameter to force refresh
  } catch (error) {
    console.error('Toggle pinning error:', error);
    
    // Revert the optimistic update and fetch fresh data
    setError('Failed to change pinned status. Please try again.');
    
    // Fetch news again to ensure the data is fresh
    try {
      await fetchNews(true); // Force refresh here too
    } catch (fetchError) {
      console.error('Error fetching news after pin failure:', fetchError);
    }
  }
};

  // Function to refresh content (used by NewsForm after poll creation)
  const handleRefreshContent = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Custom function to handle image URLs
  const getNewsImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    
    try {
      // Use config's getImageUrl function if available
      if (config.getImageUrl && typeof config.getImageUrl === 'function') {
        return config.getImageUrl(imageUrl);
      }
      
      // Extract just the filename from the path
      const filename = imageUrl.split(/[/\\]/).pop();
      
      // Fallback if getImageUrl is not available
      const baseUrl = config.API_URL?.replace(/\/api\/?$/, '') || '';
      return `${baseUrl}/uploads/news/${filename}`;
    } catch (error) {
      console.error('Error generating news image URL:', error, imageUrl);
      return null;
    }
  };

  // Check if a news item has a poll
  const hasPoll = (newsItem) => {
    return newsItem && newsItem.poll && newsItem.poll.question;
  };

  // Check if user is admin
  if (!currentUser || currentUser.role !== 'admin') {
    console.log('Access denied - User:', currentUser);
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to access this area.</p>
        <p className="text-muted-foreground mt-2">
          Current user role: {currentUser ? currentUser.role : 'not logged in'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-foreground">News Management</h2>
          <button 
            onClick={() => {
              console.log('Add News clicked - Current user:', currentUser);
              setShowForm(true);
              setEditingNews(null); // Ensure we're creating a new item
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add News
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>{error}</span>
            <button 
              onClick={() => {
                setError(null);
                handleRefreshContent();
              }}
              className="ml-auto text-sm underline"
            >
              Try Again
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-foreground">Loading news...</span>
          </div>
        ) : news.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="mb-4">No news items available</p>
            <button 
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center mx-auto"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create First News Item
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {news.map(item => (
              <Card key={item._id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col space-y-4">
                    {/* Title and Meta Info */}
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center">
                          <User className="w-4 h-4 mr-1" />
                          {item.author?.displayName || 'Unknown Author'}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(item.date)}
                        </span>
                        <span className="flex items-center">
                          <ThumbsUp className="w-4 h-4 mr-1" />
                          {item.likes?.length || 0}
                        </span>
                        {hasPoll(item) && (
                          <span className="flex items-center">
                            <BarChart2 className="w-4 h-4 mr-1" />
                            Poll
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content and Image */}
                    <div className="flex items-start space-x-4">
                      <div className="flex-grow">
                        <p className="text-muted-foreground line-clamp-3">
                          {item.content}
                        </p>
                      </div>
                      {item.imageUrl && (
                        <div className="flex-shrink-0">
                          <img
                            src={getNewsImageUrl(item.imageUrl)}
                            alt={item.title}
                            className="w-32 h-24 rounded-lg object-cover"
                            onError={(e) => {
                              console.error('Image load error:', {
                                src: e.target.src,
                                original: item.imageUrl
                              });
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Visibility Badge */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        item.visible 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.visible ? 'Published' : 'Hidden'}
                      </span>
                      
                      {item.pinned?.isPinned && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                          Pinned{item.pinned.label ? `: ${item.pinned.label}` : ''}
                        </span>
                      )}
                      
                      {hasPoll(item) && (
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                          {item.poll.active ? 'Active Poll' : 'Closed Poll'}
                        </span>
                      )}
                      
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Array.isArray(item.tags) ? (
                            item.tags.map((tag, idx) => (
                              <span 
                                key={idx} 
                                className="text-xs px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full"
                              >
                                {typeof tag === 'string' ? tag : tag.text || tag.name || 'Tag'}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full">
                              {typeof item.tags === 'string' ? item.tags : 'Has tags'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-4 flex-shrink-0">
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={() => handleToggleVisibility(item._id, item.visible)}
                        className={`p-2 rounded-lg transition-colors flex items-center ${
                          item.visible 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                        title={item.visible ? 'Hide' : 'Show'}
                      >
                        {item.visible ? (
                          <Eye className="w-5 h-5" />
                        ) : (
                          <EyeOff className="w-5 h-5" />
                        )}
                      </button>
                      <button
  onClick={() => handleTogglePinning(item._id)}
  className={`p-2 rounded-lg transition-colors flex items-center ${
    typeof item.pinned === 'object' && item.pinned?.isPinned 
      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
      : typeof item.pinned === 'boolean' && item.pinned
        ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
        : 'bg-secondary hover:bg-secondary/80'
  }`}
  title={(typeof item.pinned === 'object' && item.pinned?.isPinned) || 
         (typeof item.pinned === 'boolean' && item.pinned) 
        ? 'Unpin' : 'Pin'}
>
  <Pin className="w-5 h-5 text-foreground" />
</button>
                      <button
                        onClick={() => {
                          setEditingNews(item);
                          setShowForm(true);
                        }}
                        className="p-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                        title="Edit news"
                      >
                        <Pencil className="w-5 w-5 text-foreground" />
                      </button>
                      <button
                        onClick={() => handleDeleteNews(item._id)}
                        className="p-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition-colors"
                        title="Delete news"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
					  <button
  onClick={async () => {
    try {
      console.log('Adding tags to news:', item._id);
      const result = await newsService.addTagsToNews(item._id);
      console.log('Tags added successfully:', result);
      
      // Refresh the news list
      handleRefreshContent();
    } catch (error) {
      console.error('Failed to add tags:', error);
      setError('Failed to add tags: ' + error.message);
    }
  }}
  className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg transition-colors"
  title="Add Test Tags"
>
  <Tag className="w-5 h-5" />
</button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {showForm && (
        <NewsForm
          news={editingNews}
          onClose={() => {
            setShowForm(false);
            setEditingNews(null);
          }}
          onSubmit={editingNews ? handleUpdateNews : handleAddNews}
          onRefreshContent={handleRefreshContent}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default NewsManagement;