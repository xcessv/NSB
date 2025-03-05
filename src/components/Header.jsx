import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Menu, Upload, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import NotificationIcon from './notifications/NotificationIcon';
import AboutModal from './AboutModal';
import ContactModal from './ContactModal';
import config from '../config';
import { userService, authService } from '../services/api';
import ProfileImage from './user/ProfileImage';
import ChangePasswordModal from './user/ChangePasswordModal';

const Header = ({ currentUser, setCurrentUser, onLogin, onRegister, onLogout }) => {
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showAboutMenu, setShowAboutMenu] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [profileImageKey, setProfileImageKey] = useState(Date.now());
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const aboutMenuRef = useRef(null);
  const aboutButtonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAboutMenu && 
          aboutMenuRef.current && 
          !aboutMenuRef.current.contains(event.target) &&
          aboutButtonRef.current && 
          !aboutButtonRef.current.contains(event.target)) {
        setShowAboutMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showAboutMenu]);

  // Listen for user data updates
  useEffect(() => {
    const handleUserUpdate = () => {
      const updatedUser = authService.getCurrentUser();
      if (updatedUser) {
        setCurrentUser({ ...updatedUser, timestamp: Date.now() });
        setProfileImageKey(Date.now());
      }
    };

    window.addEventListener('userDataUpdated', handleUserUpdate);
    return () => window.removeEventListener('userDataUpdated', handleUserUpdate);
  }, [setCurrentUser]);

  const AboutMenu = () => (
  <div 
    ref={aboutMenuRef}
    className="absolute top-full right-0 mt-2 w-48 bg-card rounded-lg shadow-lg py-1 border border-border z-50"
  >
    <button 
      onClick={() => {
        setShowAboutModal(true);
        setShowAboutMenu(false);
      }}
      className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-[#333333]"
    >
      About Us
    </button>
    <button 
      onClick={() => {
        setShowContactModal(true);
        setShowAboutMenu(false);
      }}
      className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-[#333333]"
    >
      Contact
    </button>
    {currentUser && (
      <>
        <hr className="my-1 border-border" />
        <button
          onClick={() => {
            setShowProfileEdit(true);
            setShowAboutMenu(false);
          }}
          className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-[#333333]"
        >
          Edit Profile
        </button>
        <button
          onClick={() => {
            setShowChangePasswordModal(true);
            setShowAboutMenu(false);
          }}
          className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-[#333333]"
        >
          Change Password
        </button>
      </>
    )}
  </div>
);
      
  const ProfileEditModal = () => {
    const [formData, setFormData] = useState({
      displayName: currentUser?.displayName || '',
      email: currentUser?.email || '',
      bio: currentUser?.bio || '',
      profileImage: null
    });
    const [isUsingDefault, setIsUsingDefault] = useState(!currentUser?.profileImage);
    const [previewImage, setPreviewImage] = useState(userService.getProfileImage(currentUser));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      setError('');

      try {
        const submitData = new FormData();
        submitData.append('displayName', formData.displayName);
        submitData.append('email', formData.email);
        submitData.append('bio', formData.bio);
        
        if (formData.profileImage) {
          submitData.append('profileImage', formData.profileImage);
        }
        
        if (isUsingDefault && currentUser?.profileImage) {
          submitData.append('removeProfileImage', 'true');
        }

        console.log('Submitting form data:', {
          displayName: formData.displayName,
          email: formData.email,
          bio: formData.bio,
          hasProfileImage: !!formData.profileImage,
          isUsingDefault
        });

        const updatedUser = await userService.updateProfile(submitData);
        console.log('Received updated user:', updatedUser);
        
        // Update the current user in the app
        setCurrentUser({ ...updatedUser, timestamp: Date.now() });
        
        // Force a UI update
        window.dispatchEvent(new Event('userDataUpdated'));
        
        setShowProfileEdit(false);
      } catch (error) {
        console.error('Profile update error:', error);
        setError(error.message || 'Failed to update profile');
      } finally {
        setLoading(false);
      }
    };

    const handleImageChange = (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          alert('Image size must be less than 5MB');
          return;
        }
        setFormData(prev => ({ ...prev, profileImage: file }));
        setPreviewImage(URL.createObjectURL(file));
        setIsUsingDefault(false);
      }
    };

    const removeImage = () => {
      setFormData(prev => ({ ...prev, profileImage: null }));
      setPreviewImage('/images/default-avatar.png');
      setIsUsingDefault(true);
    };

const wsUrl = window.location.protocol === 'https:' 
  ? 'wss://' 
  : 'ws://' + window.location.host;
  
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-lg bg-card p-6 relative">
          <button 
            onClick={() => setShowProfileEdit(false)}
            className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-full"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-2xl font-bold mb-4 text-white">Edit Profile</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Profile Image {isUsingDefault && <span className="text-muted-foreground">(Default)</span>}
              </label>
              <div className="flex items-center space-x-4">
                <div className="relative group">
                  <img
                    src={previewImage}
                    alt="Profile Preview"
                    className="w-20 h-20 rounded-full object-cover"
                    onError={() => {
                      setPreviewImage('/images/default-avatar.png');
                      setIsUsingDefault(true);
                    }}
                  />
                  {!isUsingDefault && (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-1 -right-1 p-1 bg-card rounded-full border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="flex items-center px-4 py-2 bg-secondary text-white rounded-lg cursor-pointer hover:bg-secondary/90 transition-colors">
                    <Upload className="h-5 w-5 mr-2" />
                    Upload New Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  {!isUsingDefault && (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="w-full px-4 py-2 text-muted-foreground hover:bg-secondary rounded-lg text-sm"
                    >
                      Remove & Use Default
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                className="w-full p-2 bg-secondary border border-border rounded-lg text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full p-2 bg-secondary border border-border rounded-lg text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                rows={3}
                className="w-full p-2 bg-secondary border border-border rounded-lg text-white"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowProfileEdit(false)}
                className="px-4 py-2 text-white hover:bg-secondary rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {error && (
              <div className="text-red-500 text-sm mt-2">
                {error}
              </div>
            )}
          </form>
        </Card>
      </div>
    );
  };
  return (
    <header className="bg-black sticky top-0 z-40 border-b border-border">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/images/logo.png"
              alt="North Shore Beefs Logo"
              className="h-10 w-10 object-contain"
            />
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              North Shore Beefs
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {currentUser ? (
              <div className="flex items-center space-x-4">
                <NotificationIcon currentUser={currentUser} />
                
                <div className="flex items-center space-x-3">
                  <ProfileImage
  key={profileImageKey}
  user={currentUser}
  size="md"
  showModal={false}  // We don't want to show the modal in the header
  className="bg-secondary"
/>
                  <div className="hidden md:block text-right">
                    <div className="font-medium text-white">
                      {currentUser.displayName}
                    </div>
                    <div className="text-sm text-gray-400">
                      {currentUser.role === 'admin' ? 'Admin' : 'Member'}
                    </div>
                  </div>
                  <button
                    onClick={onLogout}
                    className="px-4 py-2 text-sm bg-[#333333] hover:bg-[#444444] text-white rounded-full transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={onLogin}
                  className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-full transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={onRegister}
                  className="px-4 py-2 text-sm bg-[#333333] hover:bg-[#444444] text-white rounded-full transition-colors"
                >
                  Register
                </button>
              </div>
            )}
            
            <div className="relative">
            <button
              ref={aboutButtonRef}
              onClick={() => setShowAboutMenu(!showAboutMenu)}
              className="p-2 hover:bg-[#333333] rounded-full"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
            {showAboutMenu && <AboutMenu />}
          </div>
          </div>
        </div>
      </div>

      {showProfileEdit && currentUser && <ProfileEditModal />}
      {showAboutModal && <AboutModal onClose={() => setShowAboutModal(false)} />}
      {showContactModal && <ContactModal onClose={() => setShowContactModal(false)} />}
	  {showChangePasswordModal && <ChangePasswordModal onClose={() => setShowChangePasswordModal(false)} />}
    </header>
  );
};

export default Header;