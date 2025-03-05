// This file creates a self-contained UserProfileModal with its own DOM manipulation
// Save this as ProfileModalService.js

import React from 'react';
import ReactDOM from 'react-dom';
import { Card } from '@/components/ui/card';
import { X, MapPin, Calendar, Star, FileText, ThumbsUp, MessageCircle } from 'lucide-react';
import config from '../../config';
import ProfileImage from './ProfileImage';

// Create a utility for managing modals
const ProfileModalService = {
  // Create or get the modal container
  getModalContainer() {
    let container = document.getElementById('profile-modal-container');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'profile-modal-container';
      
      // Apply styles directly to ensure it appears above everything
      Object.assign(container.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        zIndex: '9999',
        display: 'none', // Hidden by default
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      });
      
      document.body.appendChild(container);
    }
    
    return container;
  },
  
  // Open the modal with a user
  openModal(user) {
    if (!user) return;
    
    const container = this.getModalContainer();
    const modalRoot = document.createElement('div');
    modalRoot.style.width = '100%';
    modalRoot.style.maxWidth = '36rem'; // max-w-2xl equivalent
    container.innerHTML = '';
    container.appendChild(modalRoot);
    
    // Show the container
    container.style.display = 'flex';
    
    // Render the modal
    ReactDOM.render(
      <UserProfileModalContent 
        user={user} 
        onClose={() => {
          container.style.display = 'none';
          ReactDOM.unmountComponentAtNode(modalRoot);
        }} 
      />,
      modalRoot
    );
  },
  
  // Close any open modal
  closeModal() {
    const container = this.getModalContainer();
    container.style.display = 'none';
    container.innerHTML = '';
  }
};

// The actual modal content component
const UserProfileModalContent = ({ user: initialUser, onClose }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [user, setUser] = React.useState(initialUser);
  const [stats, setStats] = React.useState({
    reviews: [],
    reviewCount: 0,
    avgRating: 0,
    totalLikes: 0,
    totalComments: 0
  });

  React.useEffect(() => {
    const fetchUserProfile = async () => {
      if (!initialUser?._id) {
        setError('Invalid user data');
        setLoading(false);
        return;
      }

      // Extract ID correctly - handle both string and object cases
      let userId = initialUser._id;
      if (typeof userId === 'object' && userId !== null) {
        userId = userId.id || userId._id || userId.userId;
      }
      
      if (!userId || typeof userId !== 'string') {
        console.error('Invalid user ID:', userId);
        setError('Invalid user ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch(`${config.API_URL}/users/profile/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch user profile');
        
        const data = await response.json();
        setUser(data.user);
        
        // Calculate stats from reviews
        const reviewStats = {
          reviews: data.reviews,
          reviewCount: data.reviews.length,
          avgRating: data.reviews.reduce((acc, r) => acc + r.rating, 0) / data.reviews.length || 0,
          totalLikes: data.reviews.reduce((acc, r) => acc + (r.likes?.length || 0), 0),
          totalComments: data.reviews.reduce((acc, r) => acc + (r.comments?.length || 0), 0)
        };
        setStats(reviewStats);
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [initialUser]);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <Card className="w-full max-w-2xl bg-card max-h-[90vh] overflow-y-auto">
      <div className="p-6 relative">
        {/* Close button - positioned relative to the card content */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 hover:bg-secondary rounded-full transition-colors"
        >
          <X className="h-6 w-6 text-muted-foreground" />
        </button>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="text-center text-red-500 p-4">
            {error}
          </div>
        ) : (
          <>
            {/* User Header */}
            <div className="flex items-center space-x-4 mb-6">
              <div className="flex-shrink-0">
                <ProfileImage
                  user={user}
                  size="2xl"
                  className="w-24 h-24"
                  clickable={false}
                  showModal={false}
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{user.displayName}</h2>
                <p className="text-muted-foreground">@{user.username}</p>
                <div className="flex items-center mt-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-1" />
                  Joined {formatDate(user.joinDate)}
                </div>
                {user.role === 'admin' && (
                  <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-white">
                    Admin
                  </span>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-secondary p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-foreground">{stats.reviewCount}</div>
                <div className="text-sm text-muted-foreground">Reviews</div>
              </div>
              <div className="bg-secondary p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-foreground">
                  {stats.avgRating.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Avg Rating</div>
              </div>
              <div className="bg-secondary p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-foreground">{stats.totalLikes}</div>
                <div className="text-sm text-muted-foreground">Total Likes</div>
              </div>
              <div className="bg-secondary p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-foreground">{stats.totalComments}</div>
                <div className="text-sm text-muted-foreground">Total Comments</div>
              </div>
            </div>

            {/* Recent Reviews */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Recent Reviews</h3>
              <div className="space-y-4">
                {stats.reviews.length > 0 ? (
                  stats.reviews.map(review => (
                    <div
                      key={review._id}
                      className="border border-border rounded-lg p-4 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-foreground">{review.beefery}</h4>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 mr-1" />
                            {review.location}
                          </div>
                        </div>
                        <div className="flex items-center bg-primary text-white px-2 py-1 rounded-full">
                          <span className="font-bold mr-1">{review.rating.toFixed(1)}</span>
                          <Star className="h-4 w-4 fill-current" />
                        </div>
                      </div>
                      {review.introComments && (
                        <p className="text-muted-foreground text-sm line-clamp-2 mt-2">
                          {review.introComments}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          {review.likes?.length || 0}
                        </div>
                        <div className="flex items-center">
                          <MessageCircle className="h-4 w-4 mr-1" />
                          {review.comments?.length || 0}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {formatDate(review.date)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground p-4">
                    No reviews yet
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default ProfileModalService;