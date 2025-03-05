// utils/pushNotifications.js
import config from '../config';

/**
 * Register a device token for push notifications
 * @param {string} token - The device token from FCM or APNS
 * @param {string} platform - 'ios' or 'android'
 * @returns {Promise<Object>} Registration result
 */
export const registerDeviceToken = async (token, platform) => {
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

    const result = await response.json();
    console.log('Device token registered successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to register device token:', error);
    throw error;
  }
};

/**
 * Unregister a device token
 * @param {string} token - The device token
 * @returns {Promise<Object>} Unregistration result
 */
export const unregisterDeviceToken = async (token) => {
  try {
    const authToken = localStorage.getItem('token');
    if (!authToken) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(`${config.API_URL}/notifications/unregister-device`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      throw new Error('Failed to unregister device token');
    }

    const result = await response.json();
    console.log('Device token unregistered successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to unregister device token:', error);
    throw error;
  }
};

/**
 * Initialize Firebase Messaging for Web Push Notifications
 * @returns {Promise<string|null>} FCM token or null if not available
 */
export const initializeFirebaseMessaging = async () => {
  try {
    // Check if Firebase is available
    if (!window.firebase || !window.firebase.messaging) {
      console.warn('Firebase Messaging is not available');
      return null;
    }

    const messaging = window.firebase.messaging();
    
    // Request permission
    await Notification.requestPermission();
    
    // Get FCM token
    const token = await messaging.getToken();
    
    // Register token with our API
    if (token) {
      await registerDeviceToken(token, 'web');
    }
    
    // Handle token refresh
    messaging.onTokenRefresh(async () => {
      try {
        const refreshedToken = await messaging.getToken();
        console.log('Token refreshed');
        await registerDeviceToken(refreshedToken, 'web');
      } catch (err) {
        console.error('Unable to retrieve refreshed token', err);
      }
    });
    
    // Handle foreground messages
    messaging.onMessage((payload) => {
      console.log('Notification received:', payload);
      
      // Create notification event
      const event = new CustomEvent('notification', {
        detail: {
          type: 'new_notification',
          notification: payload.data
        }
      });
      
      window.dispatchEvent(event);
      
      // Show browser notification if supported
      if ('Notification' in window && document.visibilityState !== 'visible') {
        if (Notification.permission === 'granted') {
          new Notification(payload.notification.title, {
            body: payload.notification.body,
            icon: '/logo192.png'
          });
        }
      }
    });
    
    return token;
  } catch (error) {
    console.error('Error initializing Firebase Messaging:', error);
    return null;
  }
};

/**
 * Setup push notifications for React Native WebView - to be called from the WebView
 * @param {Object} options - Configuration options
 * @returns {Object} Interface for React Native to communicate with the WebView
 */
export const setupReactNativePushNotifications = (options = {}) => {
  const interface = {
    // Method to handle notification clicks from React Native
    handleNotificationClick: (notificationData) => {
      try {
        // Create and dispatch event for notification click
        const event = new CustomEvent('notification_click', {
          detail: JSON.parse(notificationData)
        });
        window.dispatchEvent(event);
        
        return { success: true };
      } catch (error) {
        console.error('Error handling notification click:', error);
        return { success: false, error: error.message };
      }
    },
    
    // Method to register device token sent from React Native
    registerDeviceToken: async (token, platform) => {
      try {
        const result = await registerDeviceToken(token, platform);
        return { success: true, result };
      } catch (error) {
        console.error('Error registering device token:', error);
        return { success: false, error: error.message };
      }
    },
    
    // Method to unregister device token when user logs out
    unregisterDeviceToken: async (token) => {
      try {
        const result = await unregisterDeviceToken(token);
        return { success: true, result };
      } catch (error) {
        console.error('Error unregistering device token:', error);
        return { success: false, error: error.message };
      }
    }
  };
  
  // Expose interface to window for React Native to access
  window.PushNotificationBridge = interface;
  
  return interface;
};

/**
 * Initialize push notifications based on platform
 * @returns {Promise<void>}
 */
export const initializePushNotifications = async () => {
  try {
    // Check if running in React Native WebView
    if (window.ReactNativeWebView) {
      console.log('Initializing push notifications for React Native WebView');
      setupReactNativePushNotifications();
      
      // Notify React Native that we're ready to handle push notifications
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PUSH_NOTIFICATIONS_READY'
      }));
    } 
    // Check if running in browser with Firebase support
    else if (window.firebase) {
      console.log('Initializing push notifications for web');
      await initializeFirebaseMessaging();
    }
    else {
      console.log('Push notifications not supported in this environment');
    }
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
};

export default {
  registerDeviceToken,
  unregisterDeviceToken,
  initializeFirebaseMessaging,
  setupReactNativePushNotifications,
  initializePushNotifications
};