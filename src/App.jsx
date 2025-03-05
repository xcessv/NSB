import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, User, Lock, Mail, Upload, Loader } from 'lucide-react';
import { NotificationProvider } from './components/notifications/NotificationProvider';
import Header from './components/Header';
import Navigation from './components/Navigation';
import { Card } from './components/ui/card';
import { reviewService, authService, refreshActivities } from './services/api';

// Screen components
import RecentsScreen from './components/screens/RecentsScreen';
import TopScreen from './components/screens/TopScreen';
import MapScreen from './components/MapScreen';
import NewsScreen from './components/screens/NewsScreen';
import AdminDashboard from './components/admin/AdminDashboard';

// Import the global eventBus instance
import { eventBus } from './utils/eventBus.js';

// Error boundary for main app content
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Card className="p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-red-500 mb-4">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">
              {this.state.error?.toString() || "An unexpected error occurred."}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-white rounded-lg"
              >
                Reload App
              </button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('recents');
  const [lastActiveScreen, setLastActiveScreen] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [screenTransitioning, setScreenTransitioning] = useState(false);
  
  // Reference to track navigation history
  const navigationHistoryRef = useRef([]);

  // Track which screens involve content that needs refreshing
  const activityScreens = ['recents', 'top', 'news'];
  
  // Force dark theme
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Enhanced fetchReviews with caching and persistence
  const fetchReviews = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      // Always get fresh data on page refresh
      const freshReload = sessionStorage.getItem('justReloaded') === 'true';
      if (freshReload) {
        sessionStorage.removeItem('justReloaded');
        forceRefresh = true;
        console.log('Page was just reloaded - forcing fresh data fetch');
      }
      
      // Call the API to get fresh data
      console.log('Fetching reviews data', forceRefresh ? '(forced refresh)' : '');
      const data = await reviewService.getReviews({ forceRefresh });
      
      if (data && data.reviews) {
        console.log(`Loaded ${data.reviews.length} reviews`);
        setReviews(data.reviews || []);
        return data.reviews;
      } else {
        console.error('Invalid review data structure:', data);
        throw new Error('Failed to load reviews: Invalid data format');
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError('Failed to load reviews. Please try again later.');
      setReviews([]);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Modified effect to prevent reload loops - Listen for storage changes only
  useEffect(() => {  
    // Listen for storage changes from other tabs
    const handleStorageChange = (e) => {
      if (e.key === 'cachedReviews' || e.key === 'cachedComments') {
        console.log('Cache updated in another tab, refreshing data');
        fetchReviews(true);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fetchReviews]);

  // Add tab visibility detection to refresh data when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activityScreens.includes(currentScreen)) {
        console.log('Tab became visible, refreshing data for', currentScreen, 'screen');
        
        // Call fetchReviews safely
        try {
          fetchReviews(false);
        } catch (err) {
          console.error('Error fetching reviews on visibility change:', err);
        }
        
        // Call refreshActivities safely
        try {
          const result = refreshActivities && typeof refreshActivities === 'function' 
            ? refreshActivities() 
            : null;
            
          if (result && typeof result.catch === 'function') {
            result.catch(err => console.error('Failed to refresh activities:', err));
          }
        } catch (err) {
          console.error('Error refreshing activities on visibility change:', err);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentScreen, fetchReviews]);

  // Setup global event bus on component mount with fixes for event bus methods
  useEffect(() => {
    // Make eventBus available globally
    if (!window.eventBus) {
      window.eventBus = eventBus;
      console.log('Global event bus initialized');
      
      // Add missing methods if needed
      if (typeof window.eventBus.off !== 'function') {
        // Define fallback methods based on what might be available
        if (typeof window.eventBus.removeListener === 'function') {
          window.eventBus.off = window.eventBus.removeListener;
        } else if (typeof window.eventBus.remove === 'function') {
          window.eventBus.off = window.eventBus.remove;
        } else {
          // Define a no-op function as fallback
          window.eventBus.off = function() {
            console.warn('EventBus: .off() method not implemented');
          };
        }
      }
    }
    
    // Add page load detection
    window.addEventListener('load', () => {
      console.log('Page fully loaded');
      sessionStorage.setItem('justReloaded', 'true');
    });
    
    // Set up screen change event handler
    const handleScreenEvent = ({ previousScreen, newScreen }) => {
      console.log(`Screen changed event: ${previousScreen} -> ${newScreen}`);
    };
    
    try {
      // Safely add event listener
      if (typeof window.eventBus.on === 'function') {
        window.eventBus.on('screen-changed', handleScreenEvent);
      } else if (typeof window.eventBus.addListener === 'function') {
        window.eventBus.addListener('screen-changed', handleScreenEvent);
      } else if (typeof window.eventBus.addEventListener === 'function') {
        window.eventBus.addEventListener('screen-changed', handleScreenEvent);
      }
    } catch (err) {
      console.warn('Failed to add event listener:', err);
    }
    
    return () => {
      try {
        // Safely remove event listener
        if (window.eventBus) {
          if (typeof window.eventBus.off === 'function') {
            window.eventBus.off('screen-changed', handleScreenEvent);
          } else if (typeof window.eventBus.removeListener === 'function') {
            window.eventBus.removeListener('screen-changed', handleScreenEvent);
          } else if (typeof window.eventBus.remove === 'function') {
            window.eventBus.remove('screen-changed', handleScreenEvent);
          }
        }
      } catch (err) {
        console.warn('Failed to remove event listener:', err);
      }
    };
  }, []);

  // Enhanced screen change handler with more reliable mobile behavior
const handleScreenChange = useCallback((screenId) => {
  // Skip if we're already on this screen or transitioning
  if (screenId === currentScreen || screenTransitioning) {
    console.log(`Screen change skipped: Already on ${screenId} or transitioning`);
    return;
  }
  
  console.log(`Changing screen from ${currentScreen} to ${screenId}`);
  
  try {
    // Track screen transition state
    setScreenTransitioning(true);
    
    // Save last screen if it's an activity screen
    if (activityScreens.includes(currentScreen)) {
      setLastActiveScreen(currentScreen);
    }
    
    // Update navigation history
    navigationHistoryRef.current = [...navigationHistoryRef.current, currentScreen].slice(-5);
    
    // Update the screen immediately
    setCurrentScreen(screenId);
    
    // Reset scroll position - use 0,0 for better mobile compatibility
    window.scrollTo(0, 0);
    
    // Emit screen change event only if eventBus exists and is properly initialized
    if (window.eventBus && typeof window.eventBus.emit === 'function') {
      try {
        window.eventBus.emit('screen-changed', { 
          previousScreen: currentScreen,
          newScreen: screenId,
          timestamp: Date.now()
        });
      } catch (eventErr) {
        console.warn('Non-critical: Failed to emit screen change event:', eventErr);
      }
    }
    
    // Use requestAnimationFrame instead of setTimeout for better cross-platform behavior
    // This ensures we're working with the browser's natural rendering cycle
    requestAnimationFrame(() => {
      try {
        // If navigating to an activity screen, refresh data
        if (activityScreens.includes(screenId)) {
          console.log(`Refreshing data for ${screenId} screen`);
          
          // Use a simple approach to fetch reviews - avoid complex promise chains
          fetchReviews(false).catch(err => {
            console.error('Error fetching reviews, continuing anyway:', err);
          });
          
          // Simplified refreshActivities call
          if (refreshActivities && typeof refreshActivities === 'function') {
            refreshActivities().catch(err => {
              console.error('Error refreshing activities, continuing anyway:', err);
            });
          }
        }
      } catch (dataErr) {
        console.error('Error refreshing data, but navigation will continue:', dataErr);
      } finally {
        // Always complete the transition, even if data fetching fails
        setScreenTransitioning(false);
      }
    });
  } catch (err) {
    // Catch-all error handler to ensure we don't get stuck
    console.error('Critical error during screen change:', err);
    setScreenTransitioning(false);
    setCurrentScreen(screenId); // Force screen change even if something failed
  }
}, [currentScreen, lastActiveScreen, fetchReviews, screenTransitioning, activityScreens]);

  // Authentication check on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthChecking(true);
        const user = authService.getCurrentUser();
        
        if (user) {
          const isValid = await authService.validateSession();
          if (isValid) {
            const updatedUser = authService.getCurrentUser();
            setCurrentUser({ ...updatedUser, timestamp: Date.now() });
          } else {
            authService.logout();
            setCurrentUser(null);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        authService.logout();
        setCurrentUser(null);
      } finally {
        setAuthChecking(false);
      }
    };

    checkAuth();
    fetchReviews().catch(err => {
      console.error('Initial review fetch error:', err);
    });
  }, [fetchReviews]);

  const handleLogin = async (credentials) => {
    try {
      setError(null);
      console.log('Login attempt with:', credentials);
      const user = await authService.login(credentials);
      
      if (user) {
        console.log('Login successful, user data:', user);
        const userWithTimestamp = { 
          ...user, 
          timestamp: Date.now(),
          profileImageKey: Date.now() // Add this
        };
        console.log('Setting current user with:', userWithTimestamp);
        setCurrentUser(userWithTimestamp);
        setShowLogin(false);
        
        try {
          await fetchReviews(true); // Force refresh after login
        } catch (err) {
          console.error('Error refreshing reviews after login:', err);
        }
      }
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Invalid username/email or password');
      return { success: false, error: error.message };
    }
  };

  const handleRegister = async (formData) => {
    try {
      setError(null);
      const user = await authService.register(formData);
      setCurrentUser({ ...user, timestamp: Date.now() });
      setShowRegister(false);
      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'Registration failed. Please try again.');
      return { success: false, error: error.message };
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setCurrentScreen('recents');
    // Clear caches on logout
    localStorage.removeItem('cachedReviews');
    localStorage.removeItem('cachedComments');
  };
  
  // Login Modal Component
  const LoginModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <Card className="w-full max-w-md bg-card p-6 relative">
        <button 
          onClick={() => setShowLogin(false)}
          className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold mb-4 text-foreground">Log In</h2>
        
        <form onSubmit={async (e) => {
          e.preventDefault();
          const identifier = e.target.identifier.value.trim();
          const password = e.target.password.value;
          
          if (!identifier || !password) {
            setError('Please fill in all fields');
            return;
          }
          
          await handleLogin({ identifier, password });
        }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email or Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="identifier"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                  placeholder="Enter your email or username"
                />
                <User className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                  placeholder="Enter your password"
                />
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 flex items-center">
                <X className="h-5 w-5 mr-2" />
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogin(false)}
                className="px-4 py-2 text-foreground hover:bg-secondary rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Log In
              </button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );

  // Register Modal Component
  const RegisterModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <Card className="w-full max-w-md bg-card p-6 relative">
        <button 
          onClick={() => setShowRegister(false)}
          className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold mb-4 text-foreground">Create Account</h2>
        
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData();
          formData.append('email', e.target.email.value);
          formData.append('username', e.target.username.value);
          formData.append('password', e.target.password.value);
          formData.append('displayName', e.target.displayName.value);
          if (e.target.profileImage.files[0]) {
            formData.append('profileImage', e.target.profileImage.files[0]);
          }
          handleRegister(formData);
        }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Display Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="displayName"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                  placeholder="How should we display your name?"
                />
                <User className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="username"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                  placeholder="Choose a unique username"
                />
                <User className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                  placeholder="Enter your email"
                />
                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                  placeholder="Choose a secure password"
                />
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Profile Image
              </label>
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 border-2 border-dashed border-border rounded-full flex items-center justify-center bg-secondary">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
                <label className="flex items-center px-4 py-2 bg-secondary text-foreground rounded-lg cursor-pointer hover:bg-secondary/90 transition-colors">
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Image
                  <input
                    type="file"
                    name="profileImage"
                    accept="image/*"
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 flex items-center">
                <X className="h-5 w-5 mr-2" />
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRegister(false)}
                className="px-4 py-2 text-foreground hover:bg-secondary rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Create Account
              </button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );

  // Enhanced renderScreen function with transition effects and error handling
  const renderScreen = () => {
    // Add key prop to force remounting when screen changes
    const key = `screen-${currentScreen}`;

    if (loading && !screenTransitioning) {
      return (
        <Card className="p-6" key={`loading-${key}`}>
          <div className="flex items-center justify-center">
            <Loader className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-foreground">Loading content...</span>
          </div>
        </Card>
      );
    }

    if (error && !screenTransitioning) {
      return (
        <Card className="p-6" key={`error-${key}`}>
          <div className="text-center">
            <p className="text-red-500">{error}</p>
            <button
              onClick={() => fetchReviews(true)}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </Card>
      );
    }

    try {
      // Render specific screen component based on current selection with key to force fresh mount
      switch (currentScreen) {
        case 'recents':
          return (
            <RecentsScreen 
              key={key}
              reviews={reviews} 
              currentUser={currentUser} 
              onReviewAdded={fetchReviews}
            />
          );
        case 'top':
          return <TopScreen key={key} reviews={reviews} currentUser={currentUser} />;
        case 'map':
          return <MapScreen key={key} reviews={reviews} />;
        case 'news':
          return <NewsScreen key={key} currentUser={currentUser} />;
        case 'admin':
          return currentUser?.role === 'admin' ? (
            <AdminDashboard key={key} currentUser={currentUser} />
          ) : (
            <Card className="p-6 text-center text-red-500" key={key}>
              Access denied. Admin privileges required.
            </Card>
          );
        default:
          return <RecentsScreen key={key} reviews={reviews} currentUser={currentUser} />;
      }
    } catch (renderError) {
      console.error('Error rendering screen:', renderError);
      return (
        <Card className="p-6" key={`render-error-${key}`}>
          <div className="text-center">
            <p className="text-red-500">Error loading screen: {renderError.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Reload App
            </button>
          </div>
        </Card>
      );
    }
  };

  // Main app render
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <div className="min-h-screen bg-background">
          <Header
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            onLogin={() => setShowLogin(true)}
            onRegister={() => setShowRegister(true)}
            onLogout={handleLogout}
          />

          <main className="max-w-2xl mx-auto px-4 pb-24">
            <div className={`transition-opacity duration-150 ${screenTransitioning ? 'opacity-80' : 'opacity-100'}`}>
              {renderScreen()}
            </div>
          </main>

          <Navigation
            currentScreen={currentScreen}
            onScreenChange={handleScreenChange}
            currentUser={currentUser}
          />

          {showLogin && <LoginModal />}
          {showRegister && <RegisterModal />}
        </div>
      </NotificationProvider>
    </ErrorBoundary>
  );
};

export default App;