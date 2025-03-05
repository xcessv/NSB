// Create a new file called UserDataUtils.js in your utils folder

import config from '../config';

// Global user cache to reduce duplicate requests
window.userCache = window.userCache || {};

/**
 * Fetches user data for an array of user IDs
 * @param {string[]} userIds - Array of user IDs to fetch
 * @returns {Promise<Object>} - Map of user IDs to user data
 */
export const fetchUserData = async (userIds) => {
  if (!userIds || !userIds.length) return {};
  
  // Check cache first
  const userMap = {};
  const idsToFetch = [];
  
  // Filter out IDs already in cache
  userIds.forEach(id => {
    if (window.userCache[id]) {
      userMap[id] = window.userCache[id];
    } else {
      idsToFetch.push(id);
    }
  });
  
  // If all users are in cache, return immediately
  if (idsToFetch.length === 0) return userMap;
  
  // Otherwise fetch missing users
  try {
    const token = localStorage.getItem('token');
    if (!token) return userMap;
    
    console.log('Fetching user data for:', idsToFetch);
    
    // Try different API endpoints since we're not sure which one works
    
    // First try the batch endpoint
    try {
      const batchResponse = await fetch(`${config.API_URL}/users/batch?ids=${idsToFetch.join(',')}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (batchResponse.ok) {
        const data = await batchResponse.json();
        if (data && data.users && Array.isArray(data.users)) {
          data.users.forEach(user => {
            if (user && user._id) {
              userMap[user._id] = user;
              window.userCache[user._id] = user; // Update cache
            }
          });
          return userMap;
        }
      }
    } catch (batchError) {
      console.warn('Batch user fetch failed, trying alternative method', batchError);
    }
    
    // If batch fails, try the simple users endpoint with ids parameter
    try {
      const usersResponse = await fetch(`${config.API_URL}/users?ids=${idsToFetch.join(',')}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (usersResponse.ok) {
        const data = await usersResponse.json();
        if (data && data.users && Array.isArray(data.users)) {
          data.users.forEach(user => {
            if (user && user._id) {
              userMap[user._id] = user;
              window.userCache[user._id] = user; // Update cache
            }
          });
          return userMap;
        }
      }
    } catch (usersError) {
      console.warn('Users endpoint fetch failed, trying individual fetches', usersError);
    }
    
    // If all else fails, fetch users one by one
    const individualPromises = idsToFetch.map(async (userId) => {
      try {
        const response = await fetch(`${config.API_URL}/users/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const userData = await response.json();
          if (userData && userData._id) {
            userMap[userData._id] = userData;
            window.userCache[userData._id] = userData; // Update cache
          }
        }
      } catch (error) {
        console.error(`Error fetching user ${userId}:`, error);
      }
    });
    
    await Promise.all(individualPromises);
    return userMap;
    
  } catch (error) {
    console.error('Error fetching user data:', error);
    return userMap; // Return whatever we have
  }
};

/**
 * Enhances a list of items with user data
 * @param {Array} items - Array of items containing user IDs
 * @param {Function} getUserId - Function to extract user ID from an item
 * @param {Function} updateItem - Function to update an item with user data
 * @returns {Promise<Array>} - Enhanced array with user data
 */
export const enhanceWithUserData = async (items, getUserId, updateItem) => {
  if (!items || !items.length) return items;
  
  // Get unique user IDs from the items
  const userIds = [...new Set(items.map(getUserId).filter(Boolean))];
  
  // Fetch user data
  const userMap = await fetchUserData(userIds);
  
  // Update items with user data
  return items.map(item => {
    const userId = getUserId(item);
    if (userId && userMap[userId]) {
      return updateItem(item, userMap[userId]);
    }
    return item;
  });
};

// Example usage:
// 
// // For likes/votes:
// const enhancedLikes = await enhanceWithUserData(
//   likes,
//   like => like._id || like.userId,
//   (like, userData) => ({
//     ...like,
//     displayName: userData.displayName || userData.username || 'Unknown User',
//     profileImage: userData.profileImage
//   })
// );
//
// // For comments:
// const enhancedComments = await enhanceWithUserData(
//   comments,
//   comment => comment.userId,
//   (comment, userData) => ({
//     ...comment,
//     userDisplayName: userData.displayName || userData.username || 'Unknown User',
//     userImage: userData.profileImage
//   })
// );
