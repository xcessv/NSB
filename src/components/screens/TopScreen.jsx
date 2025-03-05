import React, { useState, useEffect } from 'react';
import { Trophy, Star, MapPin, ArrowRight, Calendar, ChevronDown, Loader } from 'lucide-react';
import ReviewModal from '../review/ReviewModal';
import { Card } from '@/components/ui/card';
import { groupBy, meanBy, maxBy, orderBy } from 'lodash';
import { getMediaUrl, isVideo, isGif } from '../../utils/MediaUtils';
import { reviewService } from '../../services/api';

const TopScreen = ({ reviews = [], currentUser }) => {
  const [selectedReview, setSelectedReview] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: getDefaultStartDate(),
    endDate: new Date().toISOString().split('T')[0],
  });
  // Default to 'all-time' to show all reviews
  const [dateRangeOption, setDateRangeOption] = useState('all-time');
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [minReviews, setMinReviews] = useState(1);
  const [showMinReviewsDropdown, setShowMinReviewsDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localReviews, setLocalReviews] = useState([]);
  const [sortedBeeferies, setSortedBeeferies] = useState([]);

  // Calculate default start date (much earlier to ensure we capture all reviews)
  function getDefaultStartDate() {
    // Use 5 years ago instead of 1 year to ensure we capture all reviews
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);
    return date.toISOString().split('T')[0];
  }
  
  // Primary data fetching effect
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // First try to use props if available
        if (Array.isArray(reviews) && reviews.length > 0) {
          console.log('TopScreen: Using reviews from props:', reviews.length);
          setLocalReviews(reviews);
        } else {
          // Otherwise fetch using service with force refresh
          console.log('TopScreen: Fetching reviews via service');
          const response = await reviewService.getReviews({ forceRefresh: true });
          
          if (response && response.reviews && Array.isArray(response.reviews)) {
            console.log('TopScreen: Fetched', response.reviews.length, 'reviews via service');
            setLocalReviews(response.reviews);
            // Store timestamp to avoid unnecessary refreshes
            sessionStorage.setItem('topscreen-last-update', Date.now().toString());
          } else {
            throw new Error('No reviews available');
          }
        }
      } catch (err) {
        console.error('TopScreen: Error fetching reviews:', err);
        setError('Failed to load reviews data');
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
    
    // Set up event listeners for data updates
    const handleContentUpdate = () => fetchReviews();
    const handleReviewAdded = () => fetchReviews();
    const handleStorageChange = (e) => {
      // Only trigger for review-related storage changes
      if (e.key && (
        e.key === 'reviewCount' || 
        e.key === 'reviewTimestamp' || 
        e.key === 'lastAddedReview'
      )) {
        console.log('TopScreen: Detected review-related localStorage change:', e.key);
        fetchReviews();
      }
    };
    
    const handleWindowFocus = () => {
      const lastUpdate = parseInt(sessionStorage.getItem('topscreen-last-update') || '0');
      const now = Date.now();
      
      // Only refresh if it's been more than 30 seconds since last update
      if (now - lastUpdate > 30000) {
        console.log('TopScreen: Window focused, checking for updates');
        fetchReviews();
      }
    };
    
    // Setup polling interval (every 45 seconds)
    const pollInterval = setInterval(() => {
      const lastUpdate = parseInt(sessionStorage.getItem('topscreen-last-update') || '0');
      const now = Date.now();
      
      // Only refresh if it's been more than 30 seconds since last update
      if (now - lastUpdate > 30000) {
        console.log('TopScreen: Polling for updates');
        fetchReviews();
      }
    }, 45000);
    
    // Register all event listeners
    window.addEventListener('content-updated', handleContentUpdate);
    window.addEventListener('review-added', handleReviewAdded);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleWindowFocus);
    
    // Clean up function
    return () => {
      window.removeEventListener('content-updated', handleContentUpdate);
      window.removeEventListener('review-added', handleReviewAdded);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleWindowFocus);
      clearInterval(pollInterval);
    };
  }, [reviews]); // Only re-run if props.reviews changes
  
  // Process reviews into beefery stats when reviews or filters change
  useEffect(() => {
    // Don't return early even if localReviews is empty - this might be reset to empty array momentarily due to data refresh
    // We'll handle empty arrays in the try/catch block instead
    
    try {
      console.log('TopScreen: Processing', localReviews.length, 'reviews');
      
      // Check for data structures to debug issues
      if (localReviews.length > 0) {
        const firstReview = localReviews[0];
        console.log('TopScreen: First review properties:', Object.keys(firstReview));
        
        // Check for specifically the beefery property that might be capitalized differently
        const beeferyProps = Object.keys(firstReview).filter(key => 
          key.toLowerCase().includes('beef'));
        console.log('TopScreen: Beefery-related properties:', beeferyProps);
        
        if (beeferyProps.length > 0) {
          beeferyProps.forEach(prop => {
            console.log(`  ${prop} value:`, firstReview[prop]);
          });
        }
      }
      
      // Filter reviews by date range, with robust handling and explicit debugging
      const rawFilteredReviews = [];
      
      // First pass: just collect all reviews that match the date criteria with detailed logging
      localReviews.forEach((review, index) => {
        try {
          let included = false;
          let reason = '';
          
          // Handle missing dates
          if (!review.date) {
            included = true; // Always include reviews without dates
            reason = 'no date';
          } else {
            const reviewDate = new Date(review.date);
            
            // Check for invalid dates
            if (isNaN(reviewDate.getTime())) {
              included = true; // Include invalid dates too
              reason = 'invalid date';
            } else {
              const start = new Date(dateRange.startDate);
              const end = new Date(dateRange.endDate);
              end.setHours(23, 59, 59, 999); // Include the entire end day
              
              included = reviewDate >= start && reviewDate <= end;
              reason = included ? 'date in range' : `date outside range (${reviewDate.toISOString()})`;
            }
          }
          
          // Log the decision for each review
          console.log(`TopScreen: Review ${index} inclusion:`, included, reason);
          
          if (included) {
            rawFilteredReviews.push(review);
          }
        } catch (err) {
          console.error('TopScreen: Error checking review:', err, review);
          // Include on error
          rawFilteredReviews.push(review);
        }
      });
      
      // EMERGENCY OVERRIDE: If we filtered everything, include all reviews
      const filteredReviews = rawFilteredReviews.length > 0 ? rawFilteredReviews : localReviews;
      
      // Log the outcome
      console.log(`TopScreen: Date filtering results: ${filteredReviews.length}/${localReviews.length} reviews included`);
      
      if (filteredReviews.length === 0 && localReviews.length > 0) {
        console.warn('TopScreen: CRITICAL - All reviews were filtered out! Using emergency override.');
      }
      
      // Group reviews by beefery with case-insensitive key handling
      console.log('TopScreen: Processing groupBy on filtered reviews:', filteredReviews);
      
      // Inspect a sample review to help debugging
      if (filteredReviews.length > 0) {
        console.log('TopScreen: Sample review object:', JSON.stringify(filteredReviews[0]));
      }
      
      // Find the actual beefery property name (could be Beefery, beefery, etc.)
      const getBeeferyPropertyName = review => {
        console.log('TopScreen: Finding beefery property in review with keys:', Object.keys(review));
        
        // First, check for common beefery property names
        const commonNames = ['beefery', 'Beefery', 'BeeferyName', 'beeferyName', 'name'];
        for (const name of commonNames) {
          if (name in review && review[name]) {
            console.log(`TopScreen: Found beefery property "${name}" with value "${review[name]}"`);
            return name;
          }
        }
        
        // Next, try to find any property with "beef" in it
        const beefKeys = Object.keys(review).filter(key => 
          key.toLowerCase().includes('beef'));
        
        if (beefKeys.length > 0) {
          console.log(`TopScreen: Found beefery-like property "${beefKeys[0]}" with value "${review[beefKeys[0]]}"`);
          return beefKeys[0];
        }
        
        // If we still don't have it, look for properties that might contain the beefery name
        if ('title' in review) return 'title';
        if ('storeName' in review) return 'storeName';
        if ('restaurant' in review) return 'restaurant';
        if ('location' in review) return 'location';
        
        console.warn('TopScreen: Could not find beefery property! Using raw review:', review);
        return 'beefery'; // Fall back to default
      };
      
      // Manual grouping with fallbacks for missing properties
      let groupedReviews = {};
      
      if (filteredReviews.length > 0) {
        // Get the property name from the first review
        const beeferyProp = getBeeferyPropertyName(filteredReviews[0]);
        console.log('TopScreen: Using beefery property:', beeferyProp);
        
        // Group reviews, handling missing values gracefully
        filteredReviews.forEach(review => {
          let beeferyName = review[beeferyProp];
          
          // If we don't have a name, try alternate properties
          if (!beeferyName) {
            // Try to find ANY property that could work as a name
            for (const key of Object.keys(review)) {
              if (typeof review[key] === 'string' && review[key].length > 0) {
                beeferyName = review[key];
                console.log(`TopScreen: Using alternate property "${key}" with value "${beeferyName}" as beefery name`);
                break;
              }
            }
          }
          
          // Last resort - use "Unknown"
          beeferyName = beeferyName || 'Unknown Beefery';
          
          // Create the group if it doesn't exist
          if (!groupedReviews[beeferyName]) {
            groupedReviews[beeferyName] = [];
          }
          
          // Add to the group
          groupedReviews[beeferyName].push(review);
        });
      } else {
        console.log('TopScreen: No filtered reviews to group');
      }
      
      // Debug grouped reviews
      console.log('TopScreen: Grouped reviews:', Object.keys(groupedReviews).length, 'groups');
      Object.keys(groupedReviews).forEach(key => {
        console.log(`  Group "${key}": ${groupedReviews[key]?.length || 0} reviews`);
      });
      
      // Process each beefery group
      const beeferyStats = Object.entries(groupedReviews)
        .map(([beefery, beeferyReviews]) => {
          // Skip invalid data
          // Only skip if we don't have a valid beefery name
          if (!beefery) {
            return null;
          }
          
          // Allow empty beeferyReviews arrays to pass through for debugging
          if (!Array.isArray(beeferyReviews)) {
            console.warn('TopScreen: Non-array beeferyReviews for', beefery);
            beeferyReviews = [];
          }
          
          try {
            // Calculate average rating
            const avgRating = meanBy(beeferyReviews, review => {
              const rating = parseFloat(review.rating);
              return isNaN(rating) ? 0 : rating;
            });
            
            // Get review count
            const reviewCount = beeferyReviews.length;
            
            // Get latest review
            const latestReview = maxBy(beeferyReviews, 'date');
            
            // Process the media for the latest review
            let processedLatestReview = { ...latestReview };
            
            if (latestReview && latestReview.media) {
              try {
                // Handle both string and object formats for media
                if (typeof latestReview.media === 'string') {
                  processedLatestReview.media = {
                    original: latestReview.media,
                    type: isVideo(latestReview.media) ? 'video' : 'image',
                    url: latestReview.media,
                    processedUrl: getMediaUrl(latestReview.media, 'review')
                  };
                } else {
                  // Handle existing object format
                  const mediaUrl = getMediaUrl(latestReview.media, 'review');
                  processedLatestReview.media = {
                    ...latestReview.media,
                    processedUrl: mediaUrl
                  };
                }
              } catch (mediaErr) {
                console.error('TopScreen: Error processing review media:', mediaErr);
                processedLatestReview.media = { 
                  ...latestReview.media, 
                  processedUrl: null 
                };
              }
            }
            
            // Get location
            const location = processedLatestReview.location;
            
            return {
              beefery,
              avgRating,
              reviewCount,
              latestReview: processedLatestReview,
              location
            };
          } catch (err) {
            console.error('TopScreen: Error processing beefery stats for', beefery, err);
            return null;
          }
        })
        .filter(Boolean) // Remove any null entries
        .filter(beefery => beefery.reviewCount >= minReviews);
      
      // Filter beeferies with reviews after processing
      const beeferyStatsWithReviews = beeferyStats
        .filter(Boolean) // Remove any null entries
        .filter(beefery => beefery.reviewCount >= minReviews)
        .filter(beefery => beefery.beefery && beefery.beefery !== 'undefined' && beefery.beefery !== 'Unknown');
      
      // Log beefery stats before and after filtering
      console.log('TopScreen: Beefery stats before filtering:', beeferyStats.length);
      console.log('TopScreen: Beefery stats after filtering:', beeferyStatsWithReviews.length);
      
      // Display any that were filtered out for debugging
      if (beeferyStats.length !== beeferyStatsWithReviews.length) {
        console.log('TopScreen: Filtered out beeferies:', 
          beeferyStats.filter(b => !beeferyStatsWithReviews.includes(b))
        );
      }
      
      // Sort beeferies by average rating
      const sorted = orderBy(beeferyStatsWithReviews, ['avgRating'], ['desc']);
      setSortedBeeferies(sorted);
      
      console.log('TopScreen: Displaying', sorted.length, 'sorted beeferies');
    } catch (err) {
      console.error('TopScreen: Error calculating beefery stats:', err);
      setError('Error processing review data');
    }
  }, [localReviews, dateRange.startDate, dateRange.endDate, minReviews]);
  
  // Handle date range option selection
  const handleDateRangeOptionChange = (option) => {
    const endDate = new Date().toISOString().split('T')[0];
    let startDate;
    
    const today = new Date();
    
    switch (option) {
      case '3days':
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(today.getDate() - 3);
        startDate = threeDaysAgo.toISOString().split('T')[0];
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      case '3months':
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        startDate = threeMonthsAgo.toISOString().split('T')[0];
        break;
      case '6months':
        const sixMonthsAgo = new Date(today);
        sixMonthsAgo.setMonth(today.getMonth() - 6);
        startDate = sixMonthsAgo.toISOString().split('T')[0];
        break;
      case 'year':
        const yearAgo = new Date(today);
        yearAgo.setFullYear(today.getFullYear() - 1);
        startDate = yearAgo.toISOString().split('T')[0];
        break;
      case 'all-time':
      default:
        // Use the earliest review date or 10 years ago as a fallback
        if (localReviews && localReviews.length) {
          try {
            // Get all valid dates from reviews
            const validDates = localReviews
              .filter(review => review.date)
              .map(review => new Date(review.date));
            
            if (validDates.length > 0) {
              // Find the earliest date
              const earliestDate = new Date(Math.min(...validDates));
              startDate = earliestDate.toISOString().split('T')[0];
            } else {
              // If no valid dates, use 10 years ago
              const tenYearsAgo = new Date(today);
              tenYearsAgo.setFullYear(today.getFullYear() - 10);
              startDate = tenYearsAgo.toISOString().split('T')[0];
            }
          } catch (err) {
            console.error('Error determining earliest date:', err);
            // Default to 10 years ago on error
            const tenYearsAgo = new Date(today);
            tenYearsAgo.setFullYear(today.getFullYear() - 10);
            startDate = tenYearsAgo.toISOString().split('T')[0];
          }
        } else {
          // No reviews, use 10 years ago
          const tenYearsAgo = new Date(today);
          tenYearsAgo.setFullYear(today.getFullYear() - 10);
          startDate = tenYearsAgo.toISOString().split('T')[0];
        }
        break;
    }
    
    setDateRange({ startDate, endDate });
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
        return 'All Time';
    }
  };

  // Handle minimum reviews change
  const handleMinReviewsChange = (value) => {
    setMinReviews(value);
    setShowMinReviewsDropdown(false);
  };

  // Handle opening review modal
  const handleOpenReviewModal = (review) => {
    setSelectedReview(review);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.date-range-dropdown') && !e.target.closest('.date-picker-button')) {
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

  return (
    <div className="space-y-6">
      {/* Top Rated Banner with Date Selector */}
      <Card className="bg-gradient-to-r from-primary to-primary/80 text-white">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Trophy className="h-8 w-8" />
              <div>
                <h2 className="text-xl font-bold">Top Rated Beeferies</h2>
                <p className="text-sm opacity-90">The highest rated beef spots</p>
              </div>
            </div>
            <Star className="h-8 w-8" />
          </div>
          
          {/* Date Range Controls */}
          <div className="mt-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            {/* Date Range Dropdown */}
            <div className="relative">
              <button 
                className="bg-white/20 hover:bg-white/30 transition-colors py-2 px-4 rounded-lg flex items-center space-x-2 text-sm w-full md:w-auto date-picker-button"
                onClick={() => setShowRangeDropdown(!showRangeDropdown)}
              >
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
                        name="startDate"
                        value={dateRange.startDate}
                        onChange={handleDateChange}
                        className="w-full p-2 border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">End Date</label>
                      <input 
                        type="date" 
                        name="endDate"
                        value={dateRange.endDate}
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
            
            {/* Results Summary */}
            <div className="ml-auto text-sm bg-white/20 py-2 px-4 rounded-lg">
              <span>{sortedBeeferies.length} beeferies found</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card className="p-6 text-center">
          <div className="flex justify-center items-center py-8">
            <Loader className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground">Loading beeferies...</p>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="p-6 text-center text-red-500">
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </Card>
      )}

      {/* Beeferies List */}
      {!loading && !error && (
        <div className="space-y-4">
          {sortedBeeferies.length === 0 ? (
            <Card className="p-6 text-center text-slate-500">
              No beeferies found for the selected date range
            </Card>
          ) : (
            sortedBeeferies.map((beefery, index) => (
              <Card 
                key={`${beefery.beefery}-${index}`}
                className="hover:shadow-md transition-shadow"
              >
                <div className="p-6 relative">
                  {/* Ranking Badge (top 3) */}
                  {index < 3 && (
                    <div className="absolute -left-4 top-4 w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                  )}

                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      {/* Beefery Name */}
                      <h3 className="text-xl font-bold text-foreground">
                        {beefery.beefery || beefery.name || "Unknown Beefery"}
                      </h3>
                      
                      {/* Location */}
                      {beefery.location && (
                        <div className="flex items-center text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span className="text-sm">{beefery.location}</span>
                        </div>
                      )}
                      
                      {/* Stats */}
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div>
                          {beefery.reviewCount} {beefery.reviewCount === 1 ? 'review' : 'reviews'}
                        </div>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex flex-col items-end">
                      <div className="bg-primary text-white rounded-full px-3 py-1 flex items-center mb-2">
                        <span className="text-xl font-bold mr-1">
                          {typeof beefery.avgRating === 'number' 
                            ? beefery.avgRating.toFixed(1) 
                            : parseFloat(beefery.avgRating).toFixed(1)}
                        </span>
                        <Star className="h-5 w-5 fill-current" />
                      </div>
                    </div>
                  </div>

                  {/* Latest Review Button */}
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => handleOpenReviewModal(beefery.latestReview)}
                      className="flex items-center text-primary hover:text-primary/90 transition-colors text-sm font-medium"
                    >
                      Latest Review
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Review Modal */}
      {selectedReview && (
        <ReviewModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default TopScreen;