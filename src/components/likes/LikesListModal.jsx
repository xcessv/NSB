import React, { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { Card } from '@/components/ui/card';
import ProfileImage from '../user/ProfileImage';
import config from '../../config';

const LikesListModal = ({ likes = [], onClose, title = "Likes", isLoading = false }) => {
  const [displayLikes, setDisplayLikes] = useState(likes);
  
  // Initialize user cache if it doesn't exist
  useEffect(() => {
    window.userCache = window.userCache || {};
  }, []);
  
  // Effect to fetch user data if needed
  useEffect(() => {
    // Only run this effect if we have likes with IDs but not proper names
    const hasMissingNames = likes.some(like => 
      like.displayName && like.displayName.includes('...'));
    
    if (!hasMissingNames) {
      setDisplayLikes(likes);
      return;
    }
    
    const fetchUserData = async () => {
      try {
        // Get unique IDs of users that need fetching
        const userIdsToFetch = [];
        likes.forEach(like => {
          // Only fetch if the display name is an ID format (contains "...")
          if (like.displayName.includes('...') && !window.userCache[like._id]) {
            userIdsToFetch.push(like._id);
          }
        });
        
        if (userIdsToFetch.length === 0) return; // No users to fetch
        
        // Try multiple API endpoints to find what works
        const token = localStorage.getItem('token');
        if (!token) return;
        
        let userData = null;
        
        // Try batch endpoint first
        try {
          console.log('Trying batch endpoint for users:', userIdsToFetch);
          const batchResponse = await fetch(`${config.API_URL}/users/batch`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: userIdsToFetch })
          });
          
          if (batchResponse.ok) {
            userData = await batchResponse.json();
            console.log('Batch user fetch successful:', userData);
          }
        } catch (err) {
          console.log('Batch endpoint failed, trying query params');
        }
        
        // If batch failed, try query params
        if (!userData) {
          try {
            const queryResponse = await fetch(`${config.API_URL}/users?ids=${userIdsToFetch.join(',')}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (queryResponse.ok) {
              userData = await queryResponse.json();
              console.log('Query param user fetch successful:', userData);
            }
          } catch (err) {
            console.log('Query param endpoint failed, trying individual fetches');
          }
        }
        
        // If that failed too, try individual fetches
        if (!userData || !userData.users) {
          userData = { users: [] };
          
          // Fetch up to 5 users individually to avoid too many requests
          const maxFetches = Math.min(userIdsToFetch.length, 5);
          for (let i = 0; i < maxFetches; i++) {
            try {
              const individualResponse = await fetch(`${config.API_URL}/users/${userIdsToFetch[i]}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (individualResponse.ok) {
                const user = await individualResponse.json();
                if (user && user._id) {
                  userData.users.push(user);
                  // Cache this user
                  window.userCache[user._id] = user;
                }
              }
            } catch (err) {
              console.warn(`Failed to fetch user ${userIdsToFetch[i]}:`, err);
            }
          }
        }
        
        // Process the user data
        if (userData && Array.isArray(userData.users)) {
          // Create a map for quick lookup
          userData.users.forEach(user => {
            if (user && user._id) {
              window.userCache[user._id] = user;
            }
          });
          
          // Update likes with actual user data
          const updatedLikes = likes.map(like => {
            if (window.userCache[like._id]) {
              const userInfo = window.userCache[like._id];
              return {
                ...like,
                displayName: userInfo.displayName || userInfo.username || like.displayName,
                profileImage: userInfo.profileImage || like.profileImage
              };
            }
            return like;
          });
          
          setDisplayLikes(updatedLikes);
        } else {
          // If we couldn't get any user data, just use the original likes
          setDisplayLikes(likes);
        }
      } catch (error) {
        console.error('Error fetching user data for likes:', error);
        setDisplayLikes(likes); // Fallback to original
      }
    };
    
    fetchUserData();
  }, [likes]);
  
  // Format date for timestamps if present
  const formatDate = (timestamp) => {
    if (!timestamp) return null;
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return null;
      
      return date.toLocaleString();
    } catch (err) {
      return null;
    }
  };
  
  // Safety check
  if (!Array.isArray(likes) || likes.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <Card className="w-full max-w-md bg-card p-6 relative max-h-[80vh] flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-full transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Header */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {displayLikes.length} {displayLikes.length === 1 ? 'person' : 'people'}
          </p>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-grow">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {displayLikes.map((user) => (
                <div key={user._id} className="flex items-center space-x-3 p-2 hover:bg-secondary/50 rounded-lg">
                  <ProfileImage
                    user={{
                      _id: typeof user._id === 'string' ? user._id : 
                           (typeof user._id === 'object' ? 
                            (user._id.id || user._id._id || user._id.userId || '') : ''),
                      displayName: user.displayName || 'Unknown User',
                      profileImage: user.profileImage
                    }}
                    size="lg"
                  />
                  <div>
                    <p className="font-semibold text-foreground">{user.displayName}</p>
                    {user.username && (
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                    )}
                    {user.timestamp && formatDate(user.timestamp) && (
                      <p className="text-xs text-muted-foreground">{formatDate(user.timestamp)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LikesListModal;