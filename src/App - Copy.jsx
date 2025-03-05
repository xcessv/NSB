import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from "./components/ui/card";
import { Star, MapPin, Search, Newspaper, ShoppingCart, Plus, X, User, ChevronUp } from 'lucide-react';
import { authService, reviewService } from './services/api';

// Modal Base Component
const Modal = ({ children, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
    <div className="bg-card rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
      {children}
    </div>
  </div>
);

// Login Form Component
const LoginForm = ({ onClose, onLogin }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await authService.login(formData);
      onLogin(user);
      onClose();
    } catch (error) {
      setError('Invalid credentials');
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Login</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        {error && <div className="mb-4 text-red-500">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg transition-colors mt-6"
          >
            Login
          </button>
        </form>
      </div>
    </Modal>
  );
};
// Register Form Component
const RegisterForm = ({ onClose, onRegister }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    displayName: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await authService.register(formData);
      onRegister(user);
      onClose();
    } catch (error) {
      setError('Registration failed. Username might already exist.');
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        {error && <div className="mb-4 text-red-500">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.displayName}
              onChange={(e) => setFormData({...formData, displayName: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg transition-colors mt-6"
          >
            Create Account
          </button>
        </form>
      </div>
    </Modal>
  );
};

// Review Form Component
const ReviewForm = ({ onClose, onSubmit, currentUser }) => {
  const [formData, setFormData] = useState({
    pizzeria: '',
    location: '',
    rating: '',
    review: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setError('Please login to submit a review');
      return;
    }

    try {
      const newReview = {
        ...formData,
        userId: currentUser.id,
        userDisplayName: currentUser.displayName,
        userRole: currentUser.role,
        imageUrl: "/api/placeholder/320/240"
      };
      
      const savedReview = await reviewService.addReview(newReview);
      onSubmit(savedReview);
      onClose();
    } catch (error) {
      setError('Failed to submit review. Please try again.');
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Add Review</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        {error && <div className="mb-4 text-red-500">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Form fields remain the same */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pizzeria Name</label>
            <input
              type="text"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.pizzeria}
              onChange={(e) => setFormData({...formData, pizzeria: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rating (0-10)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.rating}
              onChange={(e) => setFormData({...formData, rating: parseFloat(e.target.value)})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Review</label>
            <textarea
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="4"
              value={formData.review}
              onChange={(e) => setFormData({...formData, review: e.target.value})}
              required
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg transition-colors mt-6"
          >
            Submit Review
          </button>
        </form>
      </div>
    </Modal>
  );
};
// Review Card Component
const ReviewCard = ({ review }) => (
  <Card className="bg-card hover:shadow-lg transition-shadow duration-200">
    <CardHeader className="p-0 relative">
      <img
        src={review.imageUrl}
        alt={review.pizzeria}
        className="w-full h-56 object-cover rounded-t-lg"
      />
      <div className="absolute top-4 right-4 bg-card rounded-full px-3 py-1 flex items-center shadow-lg">
        <span className="text-2xl font-bold mr-1">{review.rating.toFixed(1)}</span>
        <Star className="h-5 w-5 text-yellow-400 fill-current" />
      </div>
    </CardHeader>
    <CardContent className="p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{review.pizzeria}</h2>
          <div className="flex items-center text-gray-600 mt-1">
            <MapPin className="h-4 w-4 mr-1" />
            <span>{review.location}</span>
          </div>
        </div>
        
        <p className="text-gray-700 leading-relaxed">{review.review}</p>
        
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center">
            <User className="h-4 w-4 mr-2 text-gray-500" />
            <span className="text-sm text-gray-600">
              {review.userDisplayName}
              {review.userRole !== 'user' && (
                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {review.userRole}
                </span>
              )}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {new Date(review.date).toLocaleDateString()}
          </span>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Header Component
const Header = ({ currentUser, onLogin, onRegister, onLogout }) => (
  <div className="bg-card sticky top-0 z-50 border-b shadow-sm">
    <div className="max-w-2xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-blue-600">One Bite</h1>
        <div className="flex items-center space-x-4">
          {currentUser ? (
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="font-medium text-gray-900">{currentUser.displayName}</div>
                <div className="text-sm text-gray-500">{currentUser.role}</div>
              </div>
              <button
                onClick={onLogout}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="space-x-2">
              <button
                onClick={onLogin}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
              >
                Login
              </button>
              <button
                onClick={onRegister}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                Register
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="relative">
        <input
          type="text"
          placeholder="Search pizzerias..."
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
      </div>
    </div>
  </div>
);

// Navigation Component
const Navigation = ({ currentScreen, onScreenChange }) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg z-50">
    <div className="max-w-2xl mx-auto px-4">
      <div className="flex justify-between py-3">
        {[
          { id: 'recents', icon: Star, label: 'Recents' },
          { id: 'map', icon: MapPin, label: 'Map' },
          { id: 'news', icon: Newspaper, label: 'News' },
          { id: 'shop', icon: ShoppingCart, label: 'Shop' }
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onScreenChange(id)}
            className={`flex flex-col items-center px-3 py-1 rounded-lg transition-colors ${
              currentScreen === id 
                ? 'text-blue-500' 
                : 'text-gray-600 hover:text-blue-400'
            }`}
          >
            <Icon className="h-6 w-6 mb-1" />
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>
    </div>
  </nav>
);
// Screen Components
const MapScreen = () => (
  <div className="h-96 flex items-center justify-center bg-gray-100 rounded-lg mt-6">
    <div className="text-center">
      <MapPin className="h-16 w-16 mx-auto mb-4 text-gray-400" />
      <h2 className="text-xl font-bold text-gray-900">Pizza Map</h2>
      <p className="text-gray-600">Find reviewed pizzerias near you</p>
    </div>
  </div>
);

const NewsScreen = () => (
  <div className="space-y-4 mt-6">
    <Card>
      <CardContent className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Latest Pizza News</h3>
        <p className="text-gray-700">Dave Portnoy announces nationwide pizza tour for 2025</p>
        <p className="text-sm text-gray-500 mt-2">January 8, 2025</p>
      </CardContent>
    </Card>
  </div>
);

const ShopScreen = () => (
  <div className="grid grid-cols-2 gap-4 mt-6">
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-4">
        <img 
          src="/api/placeholder/150/150" 
          alt="One Bite T-Shirt" 
          className="w-full aspect-square object-cover rounded-lg mb-4"
        />
        <h3 className="font-bold text-gray-900">One Bite T-Shirt</h3>
        <p className="text-blue-600 font-medium mt-1">$24.99</p>
        <button className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition-colors">
          Add to Cart
        </button>
      </CardContent>
    </Card>
  </div>
);

// Recent Reviews Screen
const RecentsScreen = ({ reviews, currentUser }) => {
  const [showForm, setShowForm] = useState(false);
  const [sortedReviews, setSortedReviews] = useState([]);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const sorted = [...reviews].sort((a, b) => new Date(b.date) - new Date(a.date));
    setSortedReviews(sorted);

    const handleScroll = () => {
      setShowScrollTop(window.pageYOffset > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [reviews]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddReview = async (newReview) => {
    try {
      const savedReview = await reviewService.addReview(newReview);
      window.dispatchEvent(new CustomEvent('reviewAdded', { detail: savedReview }));
    } catch (error) {
      console.error('Failed to add review:', error);
    }
  };

  return (
    <div className="pb-20">
      <div className="sticky top-28 z-40 bg-card/95 backdrop-blur-sm py-4 border-b">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-full transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Review
        </button>
      </div>

      <div className="space-y-6 mt-6">
        {sortedReviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 right-4 p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
      )}

      {showForm && (
        <ReviewForm
          onClose={() => setShowForm(false)}
          onSubmit={handleAddReview}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

// Main App Component
const PizzaReviewApp = () => {
  const [currentScreen, setCurrentScreen] = useState('recents');
  const [reviews, setReviews] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  // Load reviews from API
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const fetchedReviews = await reviewService.getReviews();
        setReviews(fetchedReviews);
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      }
    };

    fetchReviews();
  }, []);

  // Handle adding new reviews
  useEffect(() => {
    const handleReviewAdded = (event) => {
      const newReview = event.detail;
      setReviews(prevReviews => [...prevReviews, newReview]);
    };

    window.addEventListener('reviewAdded', handleReviewAdded);
    return () => window.removeEventListener('reviewAdded', handleReviewAdded);
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'recents':
        return <RecentsScreen reviews={reviews} currentUser={currentUser} />;
      case 'map':
        return <MapScreen />;
      case 'news':
        return <NewsScreen />;
      case 'shop':
        return <ShopScreen />;
      default:
        return <RecentsScreen reviews={reviews} currentUser={currentUser} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
      />

      {showLogin && (
        <LoginForm
          onClose={() => setShowLogin(false)}
          onLogin={(user) => setCurrentUser(user)}
        />
      )}

      {showRegister && (
        <RegisterForm
          onClose={() => setShowRegister(false)}
          onRegister={(user) => setCurrentUser(user)}
        />
      )}
    </div>
  );
};

export default PizzaReviewApp;