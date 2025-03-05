// components/notification/NotificationProvider.jsx
import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import config from '../../config';

// Create context
const NotificationContext = createContext();

// Notification reducer
const notificationReducer = (state, action) => {
  switch (action.type) {
    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload,
        loading: false
      };
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unreadCount: state.unreadCount + 1
      };
    case 'MARK_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(notif =>
          notif._id === action.payload ? { ...notif, read: true } : notif
        ),
        unreadCount: state.unreadCount > 0 ? state.unreadCount - 1 : 0
      };
    case 'MARK_ALL_READ':
      return {
        ...state,
        notifications: state.notifications.map(notif => ({ ...notif, read: true })),
        unreadCount: 0
      };
    case 'SET_UNREAD_COUNT':
      return {
        ...state,
        unreadCount: action.payload
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    default:
      return state;
  }
};

// Initial state
const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: true,
  error: null
};

// WebSocket setup with reconnection logic
const setupWebSocket = (token, dispatch) => {
  // Get the base URL for WebSocket
  const wsBaseUrl = config.API_URL.replace(/^http/, 'ws').replace(/\/api\/?$/, '');
  const wsUrl = `${wsBaseUrl}/ws/notifications`;
  
  console.log('Connecting to WebSocket:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connection established');
    // Authenticate the WebSocket connection
    ws.send(JSON.stringify({ type: 'authenticate', token }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      console.log('WebSocket message received:', data);
      
      if (data.type === 'notification') {
        dispatch({ type: 'ADD_NOTIFICATION', payload: data.notification });
        
        // Show browser notification if supported and page is not visible
        if ('Notification' in window && document.visibilityState !== 'visible') {
          if (Notification.permission === 'granted') {
            new Notification('North Shore Beefs', {
              body: data.message || 'You have a new notification',
              icon: '/logo192.png'
            });
          }
        }
      } else if (data.type === 'unread_count') {
        dispatch({ type: 'SET_UNREAD_COUNT', payload: data.count });
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);
    // Attempt to reconnect after 5 seconds
    setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      setupWebSocket(token, dispatch);
    }, 5000);
  };

  return ws;
};

// Request browser notification permission
const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

// Provider component
export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const [wsConnection, setWsConnection] = useState(null);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Initialize WebSocket and fetch notifications
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Set up WebSocket connection
    const ws = setupWebSocket(token, dispatch);
    setWsConnection(ws);

    // Fetch initial notifications and unread count
    fetchNotifications();
    fetchUnreadCount();

    // Clean up on unmount
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Fetch notifications when currentUser changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetchNotifications();
    fetchUnreadCount();
  }, []);

  // Handle visibility change to refresh data when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchNotifications = async (page = 1, limit = 20) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(
        `${config.API_URL}/notifications?page=${page}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      dispatch({ type: 'SET_NOTIFICATIONS', payload: data.notifications });
      dispatch({ type: 'SET_UNREAD_COUNT', payload: data.unreadCount });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${config.API_URL}/notifications/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }

      const data = await response.json();
      dispatch({ type: 'SET_UNREAD_COUNT', payload: data.count });
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(
        `${config.API_URL}/notifications/${notificationId}/read`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      dispatch({ type: 'MARK_AS_READ', payload: notificationId });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(
        `${config.API_URL}/notifications/mark-all-read`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      dispatch({ type: 'MARK_ALL_READ' });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(
        `${config.API_URL}/notifications/${notificationId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      // Update the notifications state
      dispatch({
        type: 'SET_NOTIFICATIONS',
        payload: state.notifications.filter(n => n._id !== notificationId)
      });
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Register device token for push notifications
  const registerDeviceToken = async (token, platform) => {
    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${config.API_URL}/notifications/register-device`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, platform })
      });

      if (!response.ok) {
        throw new Error('Failed to register device token');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to register device token:', error);
      throw error;
    }
  };

  // Toast notification helper
  const showNotification = (type, message) => {
    // If available in your app, replace with actual toast implementation
    if (window.toast) {
      window.toast({ title: message, type });
    } else {
      alert(message);
    }
  };

  const value = {
    ...state,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    registerDeviceToken,
    showNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use notifications
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationProvider;