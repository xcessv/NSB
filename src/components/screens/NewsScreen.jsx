import React, { useState, useEffect } from 'react';
import { Newspaper, Calendar, User, ThumbsUp, Check, Loader } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { newsService, userService } from '../../services/api';
import config from '../../config';
import ProfileImage from '../user/ProfileImage';
import PollDisplay from '../news/PollDisplay';
import NewsItem from '../news/NewsItem'; // Import the NewsItem component
import { toast } from '../../utils/toast';

const NewsScreen = ({ currentUser }) => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likeLoading, setLikeLoading] = useState({});

  useEffect(() => {
    fetchNews();
    
    // Set up event listener for content updates
    const handleContentUpdate = (event) => {
      if (event.detail && event.detail.type === 'news-deleted') {
        // Handle deletion specifically
        setNews(prevNews => 
          Array.isArray(prevNews) 
            ? prevNews.filter(item => item._id !== event.detail.id)
            : []
        );
      } else {
        // For other updates, refresh all news
        fetchNews();
      }
    };
    
    // Add event listener
    window.addEventListener('content-updated', handleContentUpdate);
    
    // Clean up event listener on unmount
    return () => {
      window.removeEventListener('content-updated', handleContentUpdate);
    };
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await newsService.getNews();
      // Filter out non-visible news items for non-admin users
      const visibleNews = currentUser?.role === 'admin' 
        ? response.news 
        : response.news?.filter(item => item.visible);
      setNews(visibleNews || []);
    } catch (error) {
      console.error('Failed to fetch news:', error);
      setError('Failed to load news.');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (newsId) => {
    if (!currentUser) {
      toast({
        title: "Login Required",
        description: "You need to be logged in to like news.",
        type: "warning"
      });
      return;
    }
    
    if (likeLoading[newsId]) return;
    
    try {
      setLikeLoading(prev => ({ ...prev, [newsId]: true }));
      console.log('Liking news item:', newsId);
      await newsService.likeNews(newsId);
      
      // Update news item in the local state
      setNews(prevNews => prevNews.map(item => {
        if (item._id === newsId) {
          // Check if user already liked
          const userLiked = item.likes?.includes(currentUser._id);
          
          return {
            ...item,
            likes: userLiked
              ? item.likes.filter(id => id !== currentUser._id) // Remove like
              : [...(item.likes || []), currentUser._id]        // Add like
          };
        }
        return item;
      }));
      
      // Dispatch event for other components
      const event = new CustomEvent('content-updated', {
        detail: { type: 'news-like', newsId }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Like news error:', error);
      toast({
        title: "Error",
        description: "Failed to like news. Please try again.",
        type: "error"
      });
    } finally {
      setLikeLoading(prev => ({ ...prev, [newsId]: false }));
    }
  };

  const handleVotePoll = async (newsId, optionIndex) => {
    if (!currentUser) {
      toast({
        title: "Login Required",
        description: "You need to be logged in to vote in polls.",
        type: "warning"
      });
      return;
    }
    
    try {
      console.log(`Voting on poll ${newsId}, option ${optionIndex}`);
      await newsService.votePoll(newsId, optionIndex);
      
      // Refresh news to update poll results
      fetchNews();
      
      // Dispatch global event
      const event = new CustomEvent('content-updated', {
        detail: { type: 'poll-vote', newsId, optionIndex }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Poll vote error:', error);
      toast({
        title: "Error",
        description: "Failed to vote in poll. Please try again.",
        type: "error"
      });
    }
  };
  
  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* News Header */}
      <Card className="bg-gradient-to-r from-primary to-primary/80 text-white">
        <div className="p-6 flex items-center space-x-3">
          <Newspaper className="h-8 w-8" />
          <div>
            <h2 className="text-xl font-bold">Beef News</h2>
            <p className="text-sm opacity-90">Latest updates from the beef world</p>
          </div>
        </div>
      </Card>

      {/* News List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <div className="p-6 text-center flex items-center justify-center text-slate-500">
              <Loader className="w-5 h-5 animate-spin mr-2" />
              Loading news...
            </div>
          </Card>
        ) : error ? (
          <Card>
            <div className="p-6 text-center text-red-500">
              {error}
              <button
                onClick={fetchNews}
                className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          </Card>
        ) : news.length === 0 ? (
          <Card>
            <div className="p-6 text-center text-slate-500">
              No beef news available
            </div>
          </Card>
        ) : (
          // Use the NewsItem component to render each news item consistently
          news.map(item => (
            <NewsItem
              key={item._id}
              item={item}
              currentUser={currentUser}
              onLike={() => handleLike(item._id)}
              onVotePoll={(optionIndex) => handleVotePoll(item._id, optionIndex)}
              onRefreshContent={fetchNews}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default NewsScreen;