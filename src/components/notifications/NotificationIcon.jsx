// components/notification/NotificationIcon.jsx
import React, { useState, useEffect } from 'react';
import { Bell, Loader } from 'lucide-react';
import NotificationPanel from './NotificationPanel';
import { useNotifications } from './NotificationProvider';

const NotificationIcon = ({ currentUser }) => {
  const { unreadCount, fetchUnreadCount, loading } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  // Fetch unread count when component mounts and currentUser changes
  useEffect(() => {
    if (currentUser?.id) {
      fetchUnreadCount();
      
      // Refresh the unread count periodically (every 30 seconds)
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser, fetchUnreadCount]);

  // Handle tab/visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentUser?.id) {
        fetchUnreadCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUser, fetchUnreadCount]);

  // Listen for new notification events from WebSocket
  useEffect(() => {
    const handleNotificationEvent = (event) => {
      if (event.detail && event.detail.type === 'new_notification') {
        fetchUnreadCount();
      }
    };

    window.addEventListener('notification', handleNotificationEvent);
    return () => window.removeEventListener('notification', handleNotificationEvent);
  }, [fetchUnreadCount]);

  const handleClick = () => {
    setShowNotifications(!showNotifications);
  };

  // Handle notification clicks in mobile apps via push notifications
  useEffect(() => {
    // Setup mobile app notification handler
    const setupMobileNotificationHandler = () => {
      // For Android (via React Native bridge)
      if (window.ReactNativeWebView) {
        // Listen for messages from React Native
        document.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'notification_clicked') {
              // Handle notification click (navigate to the right screen)
              handleNotificationClick(data.notification);
            }
          } catch (error) {
            console.error('Error parsing notification data:', error);
          }
        });
      }
      
      // For iOS WebView
      window.handleNotificationClick = (notificationData) => {
        try {
          const data = JSON.parse(notificationData);
          handleNotificationClick(data);
        } catch (error) {
          console.error('Error parsing iOS notification data:', error);
        }
      };
    };
    
    setupMobileNotificationHandler();
  }, []);

  // Function to handle notification clicks
  const handleNotificationClick = (notification) => {
    // Navigate to the appropriate content based on notification type
    if (notification.targetType === 'review') {
      window.location.href = `/reviews/${notification.targetId}`;
    } else if (notification.targetType === 'comment') {
      window.location.href = `/reviews/${notification.reviewId}#comment-${notification.targetId}`;
    } else if (notification.type === 'news_like') {
      window.location.href = `/news/${notification.targetId}`;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="p-2 rounded-full hover:bg-secondary transition-colors"
        aria-label={`Notifications ${unreadCount > 0 ? `${unreadCount} unread` : ''}`}
        disabled={loading}
      >
        {loading ? (
          <Loader className="h-6 w-6 text-muted-foreground animate-spin" />
        ) : (
          <>
            <Bell className="h-6 w-6 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 text-xs font-medium text-white bg-primary rounded-full px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {showNotifications && (
        <NotificationPanel 
          currentUser={currentUser}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
};

export default NotificationIcon;