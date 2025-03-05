// ReactNative/PushNotificationHandler.js
import React, { useEffect, useState } from 'react';
import { Platform, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '../config';

const PushNotificationHandler = ({ children, webViewRef, loggedInUser }) => {
  const [fcmToken, setFcmToken] = useState(null);
  const navigation = useNavigation();

  // Request push notification permissions
  const requestUserPermission = async () => {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  };

  // Register device token with API
  const registerDeviceToken = async (token) => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${API_URL}/notifications/register-device`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          token, 
          platform: Platform.OS === 'ios' ? 'ios' : 'android' 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to register device token');
      }

      const result = await response.json();
      console.log('Device token registered successfully:', result);
      
      // Save to AsyncStorage for future reference
      await AsyncStorage.setItem('pushToken', token);
      
      return result;
    } catch (error) {
      console.error('Failed to register device token:', error);
      return null;
    }
  };

  // Unregister device token when logging out
  const unregisterDeviceToken = async () => {
    try {
      const token = await AsyncStorage.getItem('pushToken');
      if (!token) return;

      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) return;

      const response = await fetch(`${API_URL}/notifications/unregister-device`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      if (response.ok) {
        await AsyncStorage.removeItem('pushToken');
        console.log('Device token unregistered successfully');
      }
    } catch (error) {
      console.error('Failed to unregister device token:', error);
    }
  };

  // Handle notification click
  const handleNotificationOpen = (notification) => {
    console.log('Notification opened:', notification);

    // For iOS, the notification data is in notification.data
    // For Android, it's directly in notification
    const data = Platform.OS === 'ios' ? notification.data : notification;
    
    // Navigate based on notification type
    if (data.notificationId) {
      if (data.targetType === 'review') {
        navigation.navigate('ReviewDetail', { reviewId: data.targetId });
      } else if (data.targetType === 'comment') {
        navigation.navigate('ReviewDetail', { 
          reviewId: data.reviewId, 
          commentId: data.targetId
        });
      } else if (data.type === 'news_like') {
        navigation.navigate('NewsDetail', { newsId: data.targetId });
      }
      
      // Also inform the WebView about the notification click
      if (webViewRef && webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'notification_clicked',
          notification: data
        }));
      }
    }
  };

  // Initialize push notifications
  useEffect(() => {
    const initPushNotifications = async () => {
      try {
        // Request permission
        const hasPermission = await requestUserPermission();
        if (!hasPermission) {
          console.log('Push notification permission denied');
          return;
        }

        // Configure local notifications
        PushNotification.configure({
          // (required) Called when a remote is received or opened, or local notification is opened
          onNotification: function (notification) {
            console.log('NOTIFICATION:', notification);
            
            // Handle notification click
            handleNotificationOpen(notification);
            
            // Required on iOS
            if (Platform.OS === 'ios') {
              notification.finish(PushNotificationIOS.FetchResult.NoData);
            }
          },
          
          // Should the initial notification be popped automatically
          popInitialNotification: true,
          
          requestPermissions: Platform.OS === 'ios',
        });

        // Get FCM token
        const token = await messaging().getToken();
        setFcmToken(token);
        console.log('FCM Token:', token);
        
        // Register with API if logged in
        if (loggedInUser) {
          await registerDeviceToken(token);
        }

        // Listen for token refresh
        const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
          setFcmToken(newToken);
          
          // Update token with API if logged in
          if (loggedInUser) {
            await registerDeviceToken(newToken);
          }
        });

        // Foreground message handler
        const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
          console.log('Foreground Message received:', remoteMessage);
          
          // Show local notification
          PushNotification.localNotification({
            channelId: 'default',
            title: remoteMessage.notification?.title || 'North Shore Beefs',
            message: remoteMessage.notification?.body || 'You have a new notification',
            userInfo: remoteMessage.data
          });
        });

        // Background/quit state handler
        messaging().setBackgroundMessageHandler(async (remoteMessage) => {
          console.log('Background Message received:', remoteMessage);
          // No need to do anything here, Android will automatically show the notification
        });

        // Check if app was opened from a notification
        messaging()
          .getInitialNotification()
          .then(remoteMessage => {
            if (remoteMessage) {
              console.log('App opened from notification:', remoteMessage);
              handleNotificationOpen(remoteMessage);
            }
          });

        return () => {
          // Clean up event listeners
          unsubscribeTokenRefresh();
          unsubscribeForeground();
        };
      } catch (error) {
        console.error('Error setting up push notifications:', error);
      }
    };

    initPushNotifications();
  }, [loggedInUser]);

  // Handle user logout - unregister token
  useEffect(() => {
    if (!loggedInUser && fcmToken) {
      unregisterDeviceToken();
    }
  }, [loggedInUser, fcmToken]);

  return <>{children}</>;
};

export default PushNotificationHandler;