import React, { useState, useEffect } from 'react';
import { NotificationProvider } from './components/notifications/NotificationProvider';
import Header from './components/Header';
import Navigation from './components/Navigation';
import { Card } from './components/ui/card';
import { reviewService, authService } from './services/api';
import { Loader } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Screen components
import RecentsScreen from './components/screens/RecentsScreen';
import TopScreen from './components/screens/TopScreen';
import MapScreen from './components/MapScreen';
import NewsScreen from './components/screens/NewsScreen';
import AdminDashboard from './components/admin/AdminDashboard';

const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('recents');
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reviewService.getReviews();
      setReviews(data.reviews || []);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError('Failed to load reviews. Please try again later.');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthChecking(true);
        const user = authService.getCurrentUser();
        if (user) {
          const isValid = await authService.validateSession();
          if (isValid) {
            setCurrentUser(user);
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
    fetchReviews();
  }, []);

  const handleLogin = async (credentials) => {
    try {
      setError(null);
      const user = await authService.login(credentials);
      if (user) {
        setCurrentUser(user);
        setShowLogin(false);
        await fetchReviews();
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed. Please try again.');
      throw error;
    }
  };

  const handleRegister = async (formData) => {
    try {
      setError(null);
      const user = await authService.register(formData);
      setCurrentUser(user);
      setShowRegister(false);
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'Registration failed. Please try again.');
      throw error;
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setCurrentScreen('recents');
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    if (loading) {
      return (
        <Card className="p-6">
          <div className="flex items-center justify-center">
            <Loader className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading content...</span>
          </div>
        </Card>
      );
    }

    if (error) {
      return (
        <Card className="p-6">
          <div className="text-center">
            <p className="text-red-500">{error}</p>
            <button
              onClick={fetchReviews}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </Card>
      );
    }

    switch (currentScreen) {
      case 'recents':
        return (
          <RecentsScreen 
            reviews={reviews} 
            currentUser={currentUser} 
            onReviewAdded={fetchReviews}
          />
        );
      case 'top':
        return <TopScreen reviews={reviews} currentUser={currentUser} />;
      case 'map':
        return <MapScreen reviews={reviews} />;
      case 'news':
        return <NewsScreen currentUser={currentUser} />;
      case 'admin':
        return currentUser?.role === 'admin' ? (
          <AdminDashboard currentUser={currentUser} />
        ) : (
          <Card className="p-6 text-center text-red-500">
            Access denied. Admin privileges required.
          </Card>
        );
      default:
        return <RecentsScreen reviews={reviews} currentUser={currentUser} />;
    }
  };

  return (
    <NotificationProvider>
      <div className="min-h-screen bg-slate-50">
        <Header
          currentUser={currentUser}
          onLogin={() => setShowLogin(true)}
          onRegister={() => setShowRegister(true)}
          onLogout={handleLogout}
        />

        <main className="max-w-2xl mx-auto px-4 pb-24">
          {renderScreen()}
        </main>

        <Navigation
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
          currentUser={currentUser}
        />
      </div>
    </NotificationProvider>
  );
};

export default App;