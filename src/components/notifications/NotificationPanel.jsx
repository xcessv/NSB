// components/notification/NotificationPanel.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  X,
  ThumbsUp,
  MessageCircle,
  User,
  Star,
  Check,
  Loader,
  ChevronDown,
  Trash2,
  Bell
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useNotifications } from './NotificationProvider';
import ProfileImage from '../user/ProfileImage';

const NotificationPanel = ({ currentUser, onClose }) => {
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const panelRef = useRef(null);
  
  const { 
    notifications, 
    loading, 
    unreadCount, 
    fetchNotifications, 
    markAsRead, 
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  useEffect(() => {
    // Add click outside listener
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const loadMoreNotifications = async () => {
    if (loadingMore) return;
    
    try {
      setLoadingMore(true);
      await fetchNotifications(page + 1, 10);
      setPage(prev => prev + 1);
      
      // Check if there are more notifications to load
      if (notifications.length < (page + 1) * 10) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more notifications:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification._id);
    }

    // Navigate to the relevant content
    if (notification.target.type === 'review') {
      window.location.href = `/reviews/${notification.target.id}`;
    } else if (notification.target.type === 'comment') {
      window.location.href = `/reviews/${notification.target.id}#comment-${notification.target.id}`;
    }
    
    onClose();
  };

  const handleDeleteNotification = async (e, notificationId) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'review_like':
        return <ThumbsUp className="h-5 w-5 text-primary" />;
      case 'comment_like':
        return <ThumbsUp className="h-5 w-5 text-primary" />;
      case 'review_comment':
      case 'comment_reply':
        return <MessageCircle className="h-5 w-5 text-primary" />;
      case 'new_user':
        return <User className="h-5 w-5 text-primary" />;
      case 'news_like':
        return <ThumbsUp className="h-5 w-5 text-primary" />;
      default:
        return <Bell className="h-5 w-5 text-primary" />;
    }
  };

  const getNotificationContent = (notification) => {
    const { type, sender, target } = notification;
    
    switch (type) {
      case 'review_like':
        return (
          <>
            <span className="font-semibold">{sender.displayName}</span>
            {' liked your review of '}
            <span className="font-semibold">{target.beefery}</span>
          </>
        );
      case 'comment_like':
        return (
          <>
            <span className="font-semibold">{sender.displayName}</span>
            {' liked your comment on '}
            <span className="font-semibold">{target.beefery}</span>
            {' review'}
          </>
        );
      case 'review_comment':
        return (
          <>
            <span className="font-semibold">{sender.displayName}</span>
            {' commented on your review of '}
            <span className="font-semibold">{target.beefery}</span>
          </>
        );
      case 'comment_reply':
        return (
          <>
            <span className="font-semibold">{sender.displayName}</span>
            {' replied to your comment on '}
            <span className="font-semibold">{target.beefery}</span>
            {' review'}
          </>
        );
      case 'news_like':
        return (
          <>
            <span className="font-semibold">{sender.displayName}</span>
            {' liked your news post'}
            {target.title && <>: <span className="font-semibold">{target.title}</span></>}
          </>
        );
      case 'poll_vote':
        return (
          <>
            <span className="font-semibold">{sender.displayName}</span>
            {' voted on your poll'}
            {target.title && <>: <span className="font-semibold">{target.title}</span></>}
          </>
        );
      default:
        return (
          <>
            <span className="font-semibold">{sender.displayName}</span>
            {' interacted with your content'}
          </>
        );
    }
  };

  const formatDate = (date) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diffMinutes = Math.floor((now - notifDate) / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return notifDate.toLocaleDateString();
    }
  };

  return (
    <Card 
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-96 max-h-[80vh] bg-card shadow-xl z-50 overflow-hidden"
    >
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="p-2 text-xs text-primary hover:underline transition-colors"
            >
              Mark all as read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[calc(80vh-64px)]">
        {loading && !notifications.length ? (
          <div className="flex items-center justify-center p-8">
            <Loader className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No notifications yet
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification._id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                  !notification.read ? 'bg-purple-50' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {notification.sender?.profileImage ? (
                      <img
                        src={notification.sender.profileImage}
                        alt={notification.sender.displayName}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/images/default-avatar.png';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {getNotificationIcon(notification.type)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="text-sm text-foreground">
                        {getNotificationContent(notification)}
                      </div>
                    </div>
                    {notification.target.content && (
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                        {notification.target.content}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm text-slate-500 mt-1">
                      <span>{formatDate(notification.date)}</span>
                      <div className="flex items-center space-x-2">
                        {!notification.read && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            New
                          </span>
                        )}
                        <button
                          onClick={(e) => handleDeleteNotification(e, notification._id)}
                          className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                        >
                          <Trash2 className="h-4 w-4 text-slate-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={loadMoreNotifications}
                disabled={loadingMore}
                className="w-full p-4 text-center text-primary hover:bg-purple-50 transition-colors"
              >
                {loadingMore ? (
                  <Loader className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  <div className="flex items-center justify-center">
                    <span>Load more</span>
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </div>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default NotificationPanel;