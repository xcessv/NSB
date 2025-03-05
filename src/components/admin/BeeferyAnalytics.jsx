import React, { useState, useEffect } from 'react';
import { 
  ArrowDown,
  ArrowUp, 
  Calendar, 
  Download, 
  Loader, 
  Search,
  Star,
  BarChart2,
  AlertTriangle,
  X,
  Filter,
  SortAsc,
  SortDesc,
  ChevronDown,
  Trophy,
  User
} from 'lucide-react';
import { Card } from '../ui/card';
import ProfileImage from '../user/ProfileImage';
import config from '../../config';
import { reviewService } from '../../services/api';

const BeeferyAnalytics = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [beeferies, setBeeferies] = useState([]);
  const [filteredBeeferies, setFilteredBeeferies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('reviewCount');
  const [sortDirection, setSortDirection] = useState('desc');
  const [dateRange, setDateRange] = useState({
    start: getDefaultStartDate(),
    end: new Date().toISOString().split('T')[0]
  });
  const [expandedBeefery, setExpandedBeefery] = useState(null);
  const [dateRangeOption, setDateRangeOption] = useState('year');
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [minReviews, setMinReviews] = useState(1);
  const [showMinReviewsDropdown, setShowMinReviewsDropdown] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState(null);
  
  // Calculate default start date (1 year ago)
  function getDefaultStartDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return date.toISOString().split('T')[0];
  }
  
  // Fetch beeferies data
  useEffect(() => {
    fetchBeeferyData();
  }, [dateRange]);
  
  // Filter beeferies based on search term, min reviews, etc.
  useEffect(() => {
    filterBeeferies();
  }, [searchTerm, beeferies, sortField, sortDirection, minReviews]);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.date-range-dropdown') && !e.target.closest('.date-range-button')) {
        setShowRangeDropdown(false);
      }
      if (!e.target.closest('.date-picker') && !e.target.closest('.toggle-date-picker')) {
        setShowDatePicker(false);
      }
      if (!e.target.closest('.min-reviews-dropdown') && !e.target.closest('.min-reviews-button')) {
        setShowMinReviewsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Setup enhanced content update listeners
  useEffect(() => {
    console.log('BeeferyAnalytics: Setting up enhanced content update listeners');
    
    const handleContentUpdate = async (event) => {
      console.log('BeeferyAnalytics: Content update detected', event.detail);
      
      // Refresh the beefery data
      try {
        await fetchBeeferyData();
        console.log('BeeferyAnalytics: Data refreshed after content update');
      } catch (err) {
        console.error('BeeferyAnalytics: Error refreshing after content update:', err);
      }
    };
    
    const handleReviewAdded = async () => {
      console.log('BeeferyAnalytics: Direct review-added event detected');
      
      try {
        await fetchBeeferyData();
        console.log('BeeferyAnalytics: Data refreshed after review-added event');
      } catch (error) {
        console.error('BeeferyAnalytics: Error refreshing after review-added event:', error);
      }
    };
    
    const handleStorageChange = async (e) => {
      // Only trigger for review-related storage changes
      if (e.key && (
        e.key === 'reviewCount' || 
        e.key === 'reviewTimestamp' || 
        e.key === 'lastAddedReview'
      )) {
        console.log('BeeferyAnalytics: Detected review-related localStorage change:', e.key);
        
        // Force refresh
        try {
          await fetchBeeferyData();
          console.log('BeeferyAnalytics: Data refreshed after storage event');
        } catch (error) {
          console.error('BeeferyAnalytics: Error refreshing after storage event:', error);
        }
      }
    };
    
    // Register all event listeners
    window.addEventListener('content-updated', handleContentUpdate);
    window.addEventListener('review-added', handleReviewAdded);
    window.addEventListener('storage', handleStorageChange);
    
    // Clean up on unmount
    return () => {
      console.log('BeeferyAnalytics: Removing event listeners');
      window.removeEventListener('content-updated', handleContentUpdate);
      window.removeEventListener('review-added', handleReviewAdded);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  // Add window focus handler
  useEffect(() => {
    const handleWindowFocus = async () => {
      console.log('BeeferyAnalytics: Window focused, checking for updates');
      
      // Check if any new reviews were added while window was not focused
      try {
        const lastReviewTimestamp = parseInt(localStorage.getItem('reviewTimestamp') || '0');
        const lastCheck = parseInt(sessionStorage.getItem('beeferyanalytics-last-check') || '0');
        
        if (lastReviewTimestamp > lastCheck) {
          console.log('BeeferyAnalytics: New reviews detected since last check, refreshing');
          
          // Update last check time
          sessionStorage.setItem('beeferyanalytics-last-check', Date.now().toString());
          
          // Force refresh
          await fetchBeeferyData();
        }
      } catch (error) {
        console.warn('Error checking for updates on focus:', error);
      }
    };
    
    // Register focus event
    window.addEventListener('focus', handleWindowFocus);
    
    // Initialize last check time
    sessionStorage.setItem('beeferyanalytics-last-check', Date.now().toString());
    
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);
  
  // Add polling mechanism
  useEffect(() => {
    // Set up a polling interval to refresh data every 45 seconds
    const intervalId = setInterval(() => {
      console.log('BeeferyAnalytics: Polling for updates');
      
      // Get the last update time to avoid unnecessary refreshes
      const lastUpdate = parseInt(sessionStorage.getItem('beeferyanalytics-last-update') || '0');
      const now = Date.now();
      
      // Only refresh if it's been more than 30 seconds since last update
      if (now - lastUpdate > 30000) {
        fetchBeeferyData()
          .then(() => {
            console.log('BeeferyAnalytics: Poll refresh complete');
            sessionStorage.setItem('beeferyanalytics-last-update', now.toString());
          })
          .catch(err => console.error('BeeferyAnalytics: Poll refresh error:', err));
      }
    }, 45000); // Check every 45 seconds
    
    return () => clearInterval(intervalId);
  }, []);
  
  const fetchBeeferyData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      console.log('BeeferyAnalytics: Fetching fresh data...');
      
      // Skip the direct API call attempt since we know it fails with 404
      // and go straight to the reviewService fallback
      try {
        // Get data directly from reviewService with force refresh
        const response = await reviewService.getReviews({
          forceRefresh: true,
          filters: {
            startDate: dateRange.start,
            endDate: dateRange.end
          }
        });
        
        console.log('BeeferyAnalytics: reviewService returned data:', 
                   response?.reviews?.length || 0, 'reviews');
        
        if (response && response.reviews && Array.isArray(response.reviews)) {
          // Process reviews into beefery analytics format
          const beeferyMap = {};
          
          response.reviews.forEach(review => {
            if (!review.beefery) return;
            
            const key = review.beefery;
            
            if (!beeferyMap[key]) {
              beeferyMap[key] = {
                name: review.beefery,
                location: review.location || '',
                reviewCount: 0,
                totalRating: 0,
                avgRating: 0,
                lastReviewed: null,
                ratingDistribution: {},
                recentReviewers: []
              };
            }
            
            // Update beefery stats
            beeferyMap[key].reviewCount++;
            beeferyMap[key].totalRating += review.rating || 0;
            
            // Track rating distribution
            const ratingKey = Math.floor(review.rating || 0);
            beeferyMap[key].ratingDistribution[ratingKey] = 
              (beeferyMap[key].ratingDistribution[ratingKey] || 0) + 1;
            
            // Track last reviewed date
            const reviewDate = new Date(review.date || review.createdAt);
            if (!beeferyMap[key].lastReviewed || reviewDate > new Date(beeferyMap[key].lastReviewed)) {
              beeferyMap[key].lastReviewed = reviewDate.toISOString();
            }
            
            // Add to recent reviewers if we have user info
            if (review.user) {
              beeferyMap[key].recentReviewers.push({
                _id: review.user._id,
                displayName: review.user.displayName,
                profileImage: review.user.profileImage,
                reviewDate: review.date || review.createdAt,
                rating: review.rating
              });
            }
          });
          
          // Calculate average ratings and format data
          const beeferyList = Object.entries(beeferyMap).map(([name, data]) => {
            return {
              ...data,
              avgRating: data.reviewCount > 0 ? data.totalRating / data.reviewCount : 0,
              // Limit recent reviewers to most recent 10
              recentReviewers: data.recentReviewers
                .sort((a, b) => new Date(b.reviewDate) - new Date(a.reviewDate))
                .slice(0, 10)
            };
          });
          
          console.log('BeeferyAnalytics: Processed', beeferyList.length, 'beeferies from reviews');
          
          setBeeferies(beeferyList);
          setLoading(false);
          
          // Update last update timestamp
          sessionStorage.setItem('beeferyanalytics-last-update', Date.now().toString());
          
          return beeferyList;
        } else {
          throw new Error('No review data available from service');
        }
      } catch (error) {
        console.error('BeeferyAnalytics: Failed to get data:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error fetching beefery data:', error);
      setError(error.message || 'Failed to load beeferies');
      setLoading(false);
      return [];
    }
  };
  
  const filterBeeferies = () => {
    let filtered = [...beeferies];
    
    // Apply search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(beefery => 
        beefery.name.toLowerCase().includes(lowerSearch) ||
        beefery.location?.toLowerCase().includes(lowerSearch)
      );
    }
    
    // Apply minimum reviews filter
    filtered = filtered.filter(beefery => (beefery.reviewCount || 0) >= minReviews);
    
    // Apply sorting
    filtered.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortField) {
        case 'name':
          valueA = a.name?.toLowerCase() || '';
          valueB = b.name?.toLowerCase() || '';
          break;
        case 'reviewCount':
          valueA = a.reviewCount || 0;
          valueB = b.reviewCount || 0;
          break;
        case 'avgRating':
          valueA = a.avgRating || 0;
          valueB = b.avgRating || 0;
          break;
        case 'lastReviewed':
          valueA = a.lastReviewed ? new Date(a.lastReviewed) : new Date(0);
          valueB = b.lastReviewed ? new Date(b.lastReviewed) : new Date(0);
          break;
        default:
          valueA = a[sortField] || 0;
          valueB = b[sortField] || 0;
      }
      
      if (sortDirection === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });
    
    setFilteredBeeferies(filtered);
  };
  
  const toggleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  // Handle date range option selection
  const handleDateRangeOptionChange = (option) => {
    const end = new Date().toISOString().split('T')[0];
    let start;
    
    const today = new Date();
    
    switch (option) {
      case '3days':
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(today.getDate() - 3);
        start = threeDaysAgo.toISOString().split('T')[0];
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        start = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        start = monthAgo.toISOString().split('T')[0];
        break;
      case '3months':
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        start = threeMonthsAgo.toISOString().split('T')[0];
        break;
      case '6months':
        const sixMonthsAgo = new Date(today);
        sixMonthsAgo.setMonth(today.getMonth() - 6);
        start = sixMonthsAgo.toISOString().split('T')[0];
        break;
      case 'year':
        const yearAgo = new Date(today);
        yearAgo.setFullYear(today.getFullYear() - 1);
        start = yearAgo.toISOString().split('T')[0];
        break;
      case 'all-time':
      default:
        // Use 3 years ago as a fallback for all-time
        const threeYearsAgo = new Date(today);
        threeYearsAgo.setFullYear(today.getFullYear() - 3);
        start = threeYearsAgo.toISOString().split('T')[0];
        break;
    }
    
    setDateRange({ start, end });
    setDateRangeOption(option);
    setShowRangeDropdown(false);
  };
  
  // Handle individual date changes
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
    setDateRangeOption('custom');
  };
  
  // Get human-readable date range text
  const getDateRangeText = () => {
    switch (dateRangeOption) {
      case '3days':
        return 'Last 3 Days';
      case 'week':
        return 'Last Week';
      case 'month':
        return 'Last Month';
      case '3months':
        return 'Last 3 Months';
      case '6months':
        return 'Last 6 Months';
      case 'year':
        return 'Last Year';
      case 'all-time':
        return 'All Time';
      case 'custom':
        return 'Custom Range';
      default:
        return 'Last Year';
    }
  };
  
  // Handle minimum reviews change
  const handleMinReviewsChange = (value) => {
    setMinReviews(value);
    setShowMinReviewsDropdown(false);
  };
  
  const exportToCsv = () => {
    const headers = ['Name', 'Location', 'Review Count', 'Average Rating', 'Last Reviewed'];
    const rows = filteredBeeferies.map(beefery => [
      beefery.name,
      beefery.location || '',
      beefery.reviewCount,
      beefery.avgRating?.toFixed(2) || 'N/A',
      beefery.lastReviewed ? new Date(beefery.lastReviewed).toLocaleDateString() : 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `beefery-analytics-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    
    return sortDirection === 'asc' 
      ? <SortAsc className="h-4 w-4 ml-1" /> 
      : <SortDesc className="h-4 w-4 ml-1" />;
  };
  
  // Reviewer Profile Modal
  const ReviewerProfileModal = ({ reviewer, onClose }) => {
    if (!reviewer) return null;

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
          <div className="mb-6 flex items-center space-x-4">
            <ProfileImage
              user={{
                _id: reviewer._id,
                displayName: reviewer.displayName,
                profileImage: reviewer.profileImage
              }}
              size="xl"
            />
            <div>
              <h2 className="text-xl font-bold text-foreground">{reviewer.displayName}</h2>
              {reviewer.username && (
                <p className="text-sm text-muted-foreground">@{reviewer.username}</p>
              )}
            </div>
          </div>

          {/* Reviewer Details */}
          <div className="space-y-4 mb-6">
            {reviewer.bio && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Bio</h3>
                <p className="text-foreground">{reviewer.bio}</p>
              </div>
            )}
            
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Stats</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/10 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Reviews</p>
                  <p className="text-lg font-bold">{reviewer.reviewCount || '0'}</p>
                </div>
                <div className="bg-secondary/10 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Avg. Rating</p>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-500 mr-1" />
                    <span className="text-lg font-bold">{reviewer.avgRating?.toFixed(1) || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {reviewer.joinedDate && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Member Since</h3>
                <p className="text-foreground">{new Date(reviewer.joinedDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="mt-auto pt-4 border-t border-border">
            <button
              className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary/90"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <Card className="p-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-6 -mx-6 -mt-6 mb-6 rounded-t-lg">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-3">
            <Trophy className="h-6 w-6" />
            <div>
              <h3 className="text-xl font-bold">Beefery Analytics</h3>
              <p className="text-sm opacity-90">Track performance and reviews</p>
            </div>
          </div>
          <div className="flex items-center">
            <button
              onClick={() => fetchBeeferyData()}
              className="mr-2 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center"
              disabled={loading}
            >
              {loading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Loader className="h-4 w-4 mr-1" />
                  Refresh
                </>
              )}
            </button>
            <button
              onClick={exportToCsv}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center"
              disabled={loading || filteredBeeferies.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export to CSV
            </button>
          </div>
        </div>
        
        {/* Advanced Filter Controls */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
          {/* Date Range Dropdown */}
          <div className="relative">
            <button 
              className="bg-white/20 hover:bg-white/30 transition-colors py-2 px-4 rounded-lg flex items-center space-x-2 text-sm w-full md:w-auto date-range-button"
              onClick={() => setShowRangeDropdown(!showRangeDropdown)}
            >
              <Calendar className="h-4 w-4 mr-1" />
              <span>{getDateRangeText()}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            
            {showRangeDropdown && (
              <div className="absolute z-10 mt-1 w-48 bg-white shadow-lg rounded-lg text-slate-800 date-range-dropdown">
                <div className="py-1">
                  <button onClick={() => handleDateRangeOptionChange('3days')} className="block px-4 py-2 text-sm w-full text-left hover:bg-secondary">Last 3 Days</button>
                  <button onClick={() => handleDateRangeOptionChange('week')} className="block px-4 py-2 text-sm w-full text-left hover:bg-secondary">Last Week</button>
                  <button onClick={() => handleDateRangeOptionChange('month')} className="block px-4 py-2 text-sm w-full text-left hover:bg-secondary">Last Month</button>
                  <button onClick={() => handleDateRangeOptionChange('3months')} className="block px-4 py-2 text-sm w-full text-left hover:bg-secondary">Last 3 Months</button>
                  <button onClick={() => handleDateRangeOptionChange('6months')} className="block px-4 py-2 text-sm w-full text-left hover:bg-secondary">Last 6 Months</button>
                  <button onClick={() => handleDateRangeOptionChange('year')} className="block px-4 py-2 text-sm w-full text-left hover:bg-secondary">Last Year</button>
                  <button onClick={() => handleDateRangeOptionChange('all-time')} className="block px-4 py-2 text-sm w-full text-left hover:bg-secondary">All Time</button>
                </div>
              </div>
            )}
          </div>
          
          {/* Custom Date Range Picker */}
          <div className="flex items-center">
            <button 
              className="bg-white/20 hover:bg-white/30 transition-colors py-2 px-4 rounded-lg flex items-center space-x-2 text-sm toggle-date-picker"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <Calendar className="h-4 w-4 mr-1" />
              <span>Custom Range</span>
            </button>
            
            {showDatePicker && (
              <div className="absolute z-10 mt-32 bg-white shadow-lg rounded-lg p-4 text-slate-800 date-picker">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Date</label>
                    <input 
                      type="date" 
                      name="start"
                      value={dateRange.start}
                      onChange={handleDateChange}
                      className="w-full p-2 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End Date</label>
                    <input 
                      type="date" 
                      name="end"
                      value={dateRange.end}
                      onChange={handleDateChange}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full p-2 border border-slate-300 rounded-md"
                    />
                  </div>
                  <button 
                    className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                    onClick={() => setShowDatePicker(false)}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Minimum Reviews Filter */}
          <div className="relative">
            <button 
              className="bg-white/20 hover:bg-white/30 transition-colors py-2 px-4 rounded-lg flex items-center space-x-2 text-sm min-reviews-button"
              onClick={() => setShowMinReviewsDropdown(!showMinReviewsDropdown)}
            >
              <span>Min Reviews: {minReviews}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            
            {showMinReviewsDropdown && (
              <div className="absolute z-10 mt-1 w-48 bg-white shadow-lg rounded-lg text-slate-800 min-reviews-dropdown">
                <div className="py-1">
                  {[1, 2, 3, 5, 10, 15, 20].map(value => (
                    <button 
                      key={value}
                      onClick={() => handleMinReviewsChange(value)} 
                      className="block px-4 py-2 text-sm w-full text-left hover:bg-secondary"
                    >
                      {value} {value === 1 ? 'Review' : 'Reviews'}
                    </button>
                  ))}
                  <div className="px-4 py-2 flex items-center">
                    <input
                      type="number"
                      min="1"
                      value={minReviews}
                      onChange={(e) => setMinReviews(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 p-1 border border-slate-300 rounded mr-2"
                    />
                    <button 
                      onClick={() => setShowMinReviewsDropdown(false)}
                      className="bg-primary text-white text-xs px-2 py-1 rounded"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Results Count */}
          <div className="ml-auto text-sm bg-white/20 py-2 px-4 rounded-lg">
            <span>{filteredBeeferies.length} beeferies found</span>
          </div>
        </div>
      </div>
      
      {/* Main content area */}
      <div className="space-y-6">
        {/* Search Bar */}
        <div className="flex justify-center mb-8">
          <div className="relative max-w-md w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search beeferies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 pl-10 pr-10 border border-border rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Stats summary */}
        <div className="bg-secondary/10 p-4 rounded-lg mb-8">
          <div className="text-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col items-center">
              <span className="text-muted-foreground">Total Beeferies</span>
              <span className="font-bold text-lg text-foreground">{beeferies.length}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-muted-foreground">Total Reviews</span>
              <span className="font-bold text-lg text-foreground">
                {beeferies.reduce((sum, b) => sum + (b.reviewCount || 0), 0)}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-muted-foreground">Average Rating</span>
              <span className="font-bold text-lg text-foreground flex items-center">
                <Star className="h-4 w-4 text-yellow-500 mr-1" />
                {(beeferies.reduce((sum, b) => sum + ((b.avgRating || 0) * (b.reviewCount || 0)), 0) / 
                  Math.max(1, beeferies.reduce((sum, b) => sum + (b.reviewCount || 0), 0))).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center">
            <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => fetchBeeferyData()}
              className="ml-auto text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-lg transition-colors flex items-center"
            >
              <Loader className="h-4 w-4 mr-1" />
              Refresh Data
            </button>
          </div>
        )}
        
        {/* Beeferies table */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredBeeferies.length === 0 ? (
          <div className="text-center py-12 bg-secondary/5 rounded-lg">
            <BarChart2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium text-foreground">No beeferies found.</p>
            {searchTerm && (
              <p className="text-sm mt-2 text-muted-foreground">
                Try adjusting your search or filters.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse">
              <thead className="bg-secondary/20">
                <tr>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground border-b">
                    <button 
                      onClick={() => toggleSort('name')}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Name {getSortIcon('name')}
                    </button>
                  </th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground border-b">
                    <button 
                      onClick={() => toggleSort('location')}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Location {getSortIcon('location')}
                    </button>
                  </th>
                  <th className="p-4 text-right text-sm font-medium text-muted-foreground border-b">
                    <button 
                      onClick={() => toggleSort('reviewCount')}
                      className="flex items-center justify-end hover:text-foreground transition-colors ml-auto"
                    >
                      Reviews {getSortIcon('reviewCount')}
                    </button>
                  </th>
                  <th className="p-4 text-right text-sm font-medium text-muted-foreground border-b">
                    <button 
                      onClick={() => toggleSort('avgRating')}
                      className="flex items-center justify-end hover:text-foreground transition-colors ml-auto"
                    >
                      Avg. Rating {getSortIcon('avgRating')}
                    </button>
                  </th>
                  <th className="p-4 text-right text-sm font-medium text-muted-foreground border-b">
                    <button 
                      onClick={() => toggleSort('lastReviewed')}
                      className="flex items-center justify-end hover:text-foreground transition-colors ml-auto"
                    >
                      Last Reviewed {getSortIcon('lastReviewed')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBeeferies.map((beefery, index) => (
                  <React.Fragment key={index}>
                    <tr 
                      className={`hover:bg-secondary/10 transition-colors cursor-pointer ${
                        expandedBeefery === index ? 'bg-secondary/10' : ''
                      }`}
                      onClick={() => setExpandedBeefery(expandedBeefery === index ? null : index)}
                    >
                      <td className="p-4 border-b">
                        <div className="font-medium text-foreground">{beefery.name}</div>
                      </td>
                      <td className="p-4 border-b text-muted-foreground">
                        {beefery.location || 'Unknown location'}
                      </td>
                      <td className="p-4 border-b text-muted-foreground text-right">
                        {beefery.reviewCount || 0}
                      </td>
                      <td className="p-4 border-b text-right">
                        <div className="flex items-center justify-end">
                          <Star className="h-4 w-4 text-yellow-500 mr-1" />
                          <span className="font-medium text-foreground">
                            {beefery.avgRating?.toFixed(1) || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 border-b text-muted-foreground text-right">
                        {beefery.lastReviewed 
                          ? new Date(beefery.lastReviewed).toLocaleDateString()
                          : 'N/A'
                        }
                      </td>
                    </tr>
                    
                    {/* Expanded detail row */}
                    {expandedBeefery === index && (
                      <tr>
                        <td colSpan="5" className="p-0 border-b">
                          <div className="p-6 bg-secondary/5">
                            <h4 className="font-medium text-foreground mb-4">Review Breakdown</h4>
                            
                            {/* Rating distribution */}
                            <div className="space-y-3 mb-6">
                              {beefery.ratingDistribution && Object.entries(beefery.ratingDistribution)
                                .sort(([a], [b]) => Number(b) - Number(a))
                                .map(([rating, count]) => {
                                  const percentage = beefery.reviewCount > 0 
                                    ? Math.round((count / beefery.reviewCount) * 100) 
                                    : 0;
                                  
                                  return (
                                    <div key={rating} className="flex items-center">
                                      <div className="w-16 text-sm text-muted-foreground flex items-center">
                                        <Star className="h-3 w-3 text-yellow-500 mr-1" />
                                        {Number(rating).toFixed(1)}
                                      </div>
                                      <div className="flex-grow mx-3 h-3 bg-secondary/20 rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-primary rounded-full"
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
                                      <div className="w-20 text-right text-sm text-muted-foreground">
                                        {count} ({percentage}%)
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                            
                            {/* Recent reviewers - Scrollable List */}
                            {beefery.recentReviewers && beefery.recentReviewers.length > 0 && (
                              <div>
                                <h5 className="text-sm font-medium text-foreground mb-3 flex justify-between">
                                  <span>Recent Reviewers</span>
                                  <span className="text-xs text-muted-foreground">{beefery.recentReviewers.length} {beefery.recentReviewers.length === 1 ? 'person' : 'people'}</span>
                                </h5>
                                <div className="max-h-60 overflow-y-auto border border-border rounded-lg">
                                  {beefery.recentReviewers.map((reviewer, i) => (
                                    <div 
                                      key={i}
                                      onClick={() => setSelectedReviewer(reviewer)}
                                      className="flex items-center space-x-3 p-3 hover:bg-secondary/50 rounded-lg cursor-pointer border-b border-border last:border-b-0"
                                    >
                                      <div className="flex-shrink-0">
                                        <ProfileImage
                                          user={{
                                            _id: reviewer._id,
                                            displayName: reviewer.displayName,
                                            profileImage: reviewer.profileImage
                                          }}
                                          size="md"
                                        />
                                      </div>
                                      <div>
                                        <p className="font-semibold text-foreground">{reviewer.displayName}</p>
                                        {reviewer.reviewDate && (
                                          <p className="text-xs text-muted-foreground">
                                            {new Date(reviewer.reviewDate).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                      <div className="ml-auto flex items-center">
                                        <Star className="h-4 w-4 text-yellow-500 mr-1" />
                                        <span className="text-sm font-medium">{reviewer.rating?.toFixed(1) || 'N/A'}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Reviewer Profile Modal */}
      {selectedReviewer && (
        <ReviewerProfileModal
          reviewer={selectedReviewer}
          onClose={() => setSelectedReviewer(null)}
        />
      )}
    </Card>
  );
};

export default BeeferyAnalytics;