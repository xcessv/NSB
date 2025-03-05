import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { Card } from '@/components/ui/card';
import { Search, Loader, Navigation, X, Play, Star, MapPin, Layers, RefreshCw, Filter, Flame } from 'lucide-react';
import { geocodeAddress, getAddressSuggestions, isValidCoordinate } from '../services/geocoding';
import ReviewModal from './review/ReviewModal';
import MapPopupModal from './MapPopupModal';
import L from 'leaflet';
import 'leaflet.markercluster';
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import _ from 'lodash';
import config from '../config';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create marker icons
const createMarkerIcon = (rating) => {
  // Use colors that match the dark theme
  const color = rating >= 8 ? '#22c55e' :  // Green for high ratings
               rating >= 6 ? '#3b82f6' :   // Blue for good ratings
               rating >= 4 ? '#f59e0b' :   // Orange for medium ratings
               '#ef4444';                  // Red for low ratings

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="marker-icon" style="background-color: ${color}">
        ${rating.toFixed(1)}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// Updated: POI Icon now uses a star instead of initials
const createPoiIcon = () => {
  return L.divIcon({
    className: 'custom-poi-marker',
    html: `
      <div class="marker-icon" style="background-color: #3b82f6">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// Map controller component
const MapController = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2 && 
        isValidCoordinate(center[0], center[1])) {
      map.setView(center, zoom);
    }
  }, [map, center, zoom]);
  
  return null;
};

// Location tracker component
const LocationTracker = ({ onLocationUpdate }) => {
  const map = useMapEvents({
    locationfound: (e) => {
      onLocationUpdate([e.latlng.lat, e.latlng.lng]);
    }
  });

  return null;
};

// Main MapScreen Component
const MapScreen = ({ reviews = [], currentUser, onRefreshData }) => {
  const [center, setCenter] = useState([42.3601, -71.0589]); // Boston area
  const [zoom, setZoom] = useState(12);
  const [address, setAddress] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  
  // Rating filter
  const [ratingFilter, setRatingFilter] = useState(1.0);
  const [showRatingFilter, setShowRatingFilter] = useState(false);
  
  // Modal state
  const [selectedReview, setSelectedReview] = useState(null);
  const [modalType, setModalType] = useState(null); // 'establishment', 'poi', or 'cluster'
  const [modalData, setModalData] = useState(null);
  
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pois, setPois] = useState([]);
  const searchTimeout = useRef(null);
  const searchContainerRef = useRef(null);
  const mapRef = useRef(null);
  const needsRefresh = useRef(false);

  // Debug logging effect
  useEffect(() => {
    console.log('Debug - Reviews:', reviews?.length);
  }, [reviews]);

  // Add review update listeners for map refresh
  useEffect(() => {
    console.log('Setting up review update listeners in MapScreen');
    
    // Create event handler for content-updated events
    const handleContentUpdate = (event) => {
      console.log('MapScreen received content update event:', event.detail);
      
      if (event.detail && event.detail.type === 'review-added') {
        console.log('New review added, refreshing map data');
        needsRefresh.current = true;
        
        // If reviews are passed as props and there's a refresh callback
        if (typeof onRefreshData === 'function') {
          onRefreshData();
        }
      }
    };
    
    // Handler for dedicated review-added events
    const handleReviewAdded = () => {
      console.log('MapScreen: Direct review-added event detected');
      needsRefresh.current = true;
      
      if (typeof onRefreshData === 'function') {
        onRefreshData();
      }
    };
    
    // Handler for localStorage changes
    const handleStorageChange = (e) => {
      // Only trigger for review-related storage changes
      if (e.key && (
        e.key === 'reviewCount' || 
        e.key === 'reviewTimestamp' || 
        e.key === 'lastAddedReview'
      )) {
        console.log('MapScreen: Detected review-related localStorage change:', e.key);
        needsRefresh.current = true;
        
        // If the parent has a review refresh method:
        if (typeof onRefreshData === 'function') {
          onRefreshData();
        }
      }
    };
    
    // Register all event listeners
    window.addEventListener('content-updated', handleContentUpdate);
    window.addEventListener('review-added', handleReviewAdded);
    window.addEventListener('storage', handleStorageChange);
    
    // Also check for review updates when window gets focus
    const handleWindowFocus = () => {
      console.log('MapScreen: Window focused, checking for updates');
      
      try {
        const lastReviewTimestamp = parseInt(localStorage.getItem('reviewTimestamp') || '0');
        const lastCheck = parseInt(sessionStorage.getItem('mapscreen-last-check') || '0');
        
        if (lastReviewTimestamp > lastCheck) {
          console.log('MapScreen: New reviews detected since last check, refreshing');
          needsRefresh.current = true;
          
          // Update last check time
          sessionStorage.setItem('mapscreen-last-check', Date.now().toString());
          
          // Refresh map data
          if (typeof onRefreshData === 'function') {
            onRefreshData();
          }
        }
      } catch (error) {
        console.warn('Error checking for updates on focus:', error);
      }
    };
    
    window.addEventListener('focus', handleWindowFocus);
    
    // Initialize last check time
    sessionStorage.setItem('mapscreen-last-check', Date.now().toString());
    
    // Clean up on unmount
    return () => {
      console.log('MapScreen: Removing event listeners');
      window.removeEventListener('content-updated', handleContentUpdate);
      window.removeEventListener('review-added', handleReviewAdded);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleWindowFocus);
      
      // Trigger refresh on unmount if needed
      if (needsRefresh.current && typeof onRefreshData === 'function') {
        onRefreshData();
      }
    };
  }, [onRefreshData]);

  // Fetch POIs and handle location on mount
  useEffect(() => {
    const fetchPois = async () => {
      try {
        const response = await fetch(`${config.API_URL}/admin/pois`, {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Fetched POIs:', data.pois?.length || 0);
          setPois(data.pois || []);
        } else {
          console.log('POI endpoint not yet available');
          setPois([]);
        }
      } catch (error) {
        console.error('Error fetching POIs:', error);
        setPois([]);
      }
    };

    fetchPois();
    handleCurrentLocation();
  }, []);

  // Handle click outside search suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Group reviews by establishment
  const establishments = useMemo(() => {
    console.log('Processing reviews:', reviews?.length || 0);
    
    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      console.log('No reviews available to process');
      return [];
    }

    // Log a few sample reviews to check coordinate format
    if (reviews.length > 0) {
      console.log('MapScreen: Sample review coordinates:');
      reviews.slice(0, 3).forEach((review, i) => {
        console.log(`Review ${i}:`, {
          id: review._id,
          beefery: review.beefery,
          location: review.location,
          coordinates: review.coordinates,
          rawLat: review.coordinates?.lat,
          rawLng: review.coordinates?.lng,
          parsedLat: parseFloat(review.coordinates?.lat),
          parsedLng: parseFloat(review.coordinates?.lng),
          isValid: isValidCoordinate(
            parseFloat(review.coordinates?.lat), 
            parseFloat(review.coordinates?.lng)
          )
        });
      });
    }

    const grouped = _.groupBy(reviews, review => {
      // Ensure coordinates are valid numbers
      const lat = parseFloat(review.coordinates?.lat);
      const lng = parseFloat(review.coordinates?.lng);
      
      if (isNaN(lat) || isNaN(lng) || !isValidCoordinate(lat, lng)) {
        console.warn('Review has invalid coordinates:', review._id, review.coordinates);
        return `ungrouped-${review._id}`;
      }

      return `${review.beefery}-${review.location}-${lat}-${lng}`;
    });

    console.log('Grouped reviews into', Object.keys(grouped).length, 'establishments');
    
    const processedEstablishments = Object.entries(grouped)
      .map(([key, establishmentReviews]) => {
        // Get the first review for this group/key
        const firstReview = establishmentReviews[0];
        if (!firstReview) return null;
        
        // Extract and validate coordinates
        const lat = parseFloat(firstReview.coordinates?.lat);
        const lng = parseFloat(firstReview.coordinates?.lng);
        
        if (isNaN(lat) || isNaN(lng) || !isValidCoordinate(lat, lng)) {
          console.warn('Skipping with invalid coordinates:', 
            firstReview.beefery, firstReview.coordinates);
          return null;
        }
        
        // Calculate average rating
        const avgRating = _.meanBy(establishmentReviews, 'rating');

        // Handle both grouped and ungrouped reviews
        return {
          id: key,
          beefery: firstReview.beefery,
          location: firstReview.location,
          coordinates: {
            lat: lat,
            lng: lng
          },
          reviews: _.orderBy(establishmentReviews, ['date'], ['desc']),
          avgRating,
          reviewCount: establishmentReviews.length,
          // Add a flag to identify if this is a new location (ungrouped)
          isNewLocation: key.startsWith('ungrouped-')
        };
      })
      .filter(Boolean);

    console.log('Final processed establishments:', processedEstablishments.length);
    processedEstablishments.forEach(est => {
      console.log(`- ${est.beefery}: [${est.coordinates.lat}, ${est.coordinates.lng}]${est.isNewLocation ? ' (NEW)' : ''}`);
    });
    
    return processedEstablishments;
  }, [reviews]);

  // Filter establishments based on rating
  const filteredEstablishments = useMemo(() => {
    return establishments.filter(est => est.avgRating >= ratingFilter);
  }, [establishments, ratingFilter]);

  // Create a lookup object for locations with reviews to avoid duplicate markers
  const reviewLocations = useMemo(() => {
    const locations = {};
    filteredEstablishments.forEach(est => {
      const key = `${est.coordinates.lat.toFixed(5)}-${est.coordinates.lng.toFixed(5)}`;
      locations[key] = true;
    });
    return locations;
  }, [filteredEstablishments]);

  // Filter POIs to exclude locations that already have reviews
  const filteredPois = useMemo(() => {
    return pois.filter(poi => {
      const lat = parseFloat(poi.coordinates?.lat);
      const lng = parseFloat(poi.coordinates?.lng);
      if (isNaN(lat) || isNaN(lng)) return false;
      
      const key = `${lat.toFixed(5)}-${lng.toFixed(5)}`;
      return !reviewLocations[key]; // Only include if no review exists at this location
    });
  }, [pois, reviewLocations]);

  const handleCurrentLocation = () => {
    if ("geolocation" in navigator) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          console.log('Got current location:', lat, lng);
          
          if (isValidCoordinate(lat, lng)) {
            const newLocation = [lat, lng];
            setCurrentLocation(newLocation);
            setCenter(newLocation);
            setZoom(13);
          } else {
            console.error('Invalid coordinates from geolocation');
            setError('Received invalid coordinates from your device.');
          }
          setLoading(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setError('Could not get your location. Please try searching for your address instead.');
          setLoading(false);
        },
        { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      setError('Location services are not available in your browser.');
    }
  };

  const handleAddressChange = async (e) => {
    const value = e.target.value;
    setAddress(value);
    setError('');

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    setShowSuggestions(true);

    searchTimeout.current = setTimeout(async () => {
      try {
        // First, search in existing reviews and POIs
        const matchingReviews = filteredEstablishments.filter(est => 
          est.beefery.toLowerCase().includes(value.toLowerCase()) || 
          (est.location && est.location.toLowerCase().includes(value.toLowerCase()))
        ).map(est => ({
          display_name: `${est.beefery} - ${est.location}`,
          lat: est.coordinates.lat,
          lng: est.coordinates.lng,
          source: 'review'
        }));
        
        const matchingPois = filteredPois.filter(poi => 
          poi.name.toLowerCase().includes(value.toLowerCase()) || 
          (poi.location && poi.location.toLowerCase().includes(value.toLowerCase()))
        ).map(poi => ({
          display_name: `${poi.name} - ${poi.location}`,
          lat: poi.coordinates.lat,
          lng: poi.coordinates.lng,
          source: 'poi'
        }));
        
        // Combine local results
        const localResults = [...matchingReviews, ...matchingPois];
        
        // Only fetch external suggestions if there are no local matches
        let externalResults = [];
        if (localResults.length < 3) {
          externalResults = await getAddressSuggestions(value);
        }
        
        // Combine results, prioritizing local ones
        const combinedResults = _.uniqBy([...localResults, ...externalResults], 
          item => `${item.lat}-${item.lng}`);
        
        setSuggestions(combinedResults);
      } catch (error) {
        console.error('Error getting suggestions:', error);
        setError('Failed to get address suggestions');
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSuggestionSelect = async (suggestion) => {
    setAddress(suggestion.display_name);
    setShowSuggestions(false);
    setCenter([parseFloat(suggestion.lat), parseFloat(suggestion.lng)]);
    setZoom(15);
  };

  // Modal handlers
  const handleModalClose = () => {
    setModalType(null);
    setModalData(null);
  };

  const handleMarkerClick = (type, data) => {
    console.log(`Marker clicked - Type: ${type}`, data);
    setModalType(type);
    setModalData(data);
  };

  const handleViewReview = (review) => {
    handleModalClose();
    setSelectedReview(review);
  };

  const handleClusterClick = (establishments) => {
    console.log(`Cluster clicked with ${establishments.length} establishments`);
    setModalType('cluster');
    setModalData(establishments);
  };

  const handleSelectEstablishment = (establishment) => {
    handleModalClose();
    setTimeout(() => {
      setModalType('establishment');
      setModalData(establishment);
    }, 50); // Small delay to prevent UI flicker
  };

  // Handle rating filter change
  const handleRatingFilterChange = (e) => {
    setRatingFilter(parseFloat(e.target.value));
  };

  // MarkerClusterGroup component
  const MarkerClusterGroup = ({ children, onClusterClick, onMarkerClick }) => {
    const map = useMap();
    const groupRef = useRef(null);
    
    // Initialize cluster group
    useEffect(() => {
      if (!map) return;
  
      console.log('Initializing cluster group');
      const clusterGroup = new L.MarkerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        spiderfyDistanceMultiplier: 2,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
        animate: true,
        disableClusteringAtZoom: 18
      });
  
      // Add cluster click handler
      clusterGroup.on('clusterclick', (event) => {
        const cluster = event.layer;
        const markers = cluster.getAllChildMarkers();
        
        if (map.getZoom() >= map.getMaxZoom()) {
          console.log('Max zoom reached, spiderfying');
          cluster.spiderfy();
        } else {
          console.log(`Cluster clicked with ${markers.length} markers`);
          const establishments = markers
            .map(marker => marker.options.establishmentData)
            .filter(Boolean);
  
          if (establishments.length > 0) {
            event.originalEvent.stopPropagation();
            onClusterClick(establishments);
          } else {
            map.flyTo(cluster.getLatLng(), map.getZoom() + 1);
          }
        }
      });
  
      map.addLayer(clusterGroup);
      groupRef.current = clusterGroup;
  
      return () => {
        console.log('Cleaning up cluster group');
        map.removeLayer(clusterGroup);
      };
    }, [map]);
  
    // Add markers to cluster group
    useEffect(() => {
      const group = groupRef.current;
      if (!group) return;
  
      console.log('Updating markers in cluster group');
      group.clearLayers();
  
      React.Children.forEach(children, child => {
        if (!child) return;
  
        const { position, icon, establishmentData, poiData } = child.props;
        
        // Skip markers with invalid positions
        if (!position || !Array.isArray(position) || position.length !== 2) {
          console.warn('Marker has invalid position format:', position);
          return;
        }
        
        const [lat, lng] = position;
        if (!isValidCoordinate(lat, lng)) {
          console.warn('Marker has invalid coordinates:', position);
          return;
        }
  
        try {
          console.log(`Adding marker at [${lat}, ${lng}]`);
          const marker = L.marker(position, {
            icon,
            rating: establishmentData?.avgRating,
            establishmentData,
            poiData
          });
  
          marker.on('click', (e) => {
            // Stop event propagation
            L.DomEvent.stopPropagation(e);
            
            if (establishmentData) {
              console.log('Establishment marker clicked:', establishmentData.beefery);
              onMarkerClick('establishment', establishmentData);
            } else if (poiData) {
              console.log('POI marker clicked:', poiData.name);
              onMarkerClick('poi', poiData);
            }
          });
  
          group.addLayer(marker);
        } catch (error) {
          console.error('Error creating marker:', error);
        }
      });
    }, [children, onMarkerClick]);
  
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Search Section */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="relative flex-1" ref={searchContainerRef}>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search for a location..."
                className="w-full pl-10 pr-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                value={address}
                onChange={handleAddressChange}
                onFocus={() => address.length >= 3 && setShowSuggestions(true)}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            </div>
            <button
              onClick={handleCurrentLocation}
              className="p-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              title="Use my location"
            >
              <Navigation className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                const newVisibility = !showRatingFilter;
                setShowRatingFilter(newVisibility);
                // Reset rating to 1.0 when closing the filter
                if (!newVisibility) {
                  setRatingFilter(1.0);
                }
              }}
              className={`p-3 ${showRatingFilter ? 'bg-primary text-white' : 'bg-secondary text-foreground'} rounded-lg hover:bg-primary/90 transition-colors`}
              title="Filter by rating"
            >
              <Filter className="h-5 w-5" />
            </button>
          </div>

          {/* Search Suggestions */}
          {showSuggestions && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card rounded-lg shadow-lg border border-border max-h-60 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Loader className="animate-spin h-5 w-5 mx-auto mb-2" />
                  Loading suggestions...
                </div>
              ) : suggestions.length > 0 ? (
                <ul className="py-2">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-secondary transition-colors flex items-center"
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                        {suggestion.source === 'review' ? (
                          <Star className="h-4 w-4 text-yellow-500 mr-2" />
                        ) : suggestion.source === 'poi' ? (
                          <Star className="h-4 w-4 text-blue-500 mr-2" />
                        ) : (
                          <MapPin className="h-4 w-4 text-muted-foreground mr-2" />
                        )}
                        {suggestion.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  No suggestions found
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          )}
        </div>
      </div>

      {/* Rating Filter */}
      {showRatingFilter && (
        <Card className="p-4 relative">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Minimum Rating: {ratingFilter.toFixed(1)}
              </label>
              <button
                onClick={() => setShowRatingFilter(false)}
                className="p-1 hover:bg-secondary rounded-full"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="relative pt-2">
              <input
                type="range"
                min="1"
                max="10"
                step="0.1"
                value={ratingFilter}
                onChange={handleRatingFilterChange}
                className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer"
              />
              <div className="absolute -top-1 flex items-center justify-center w-7 h-7" 
                style={{ 
                  left: `calc(${(ratingFilter - 1) / 9 * 100}% - 14px)`,
                  pointerEvents: 'none'
                }}
              >
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md">
                  <span className="text-white text-xs" role="img" aria-label="fire">🔥</span>
                </div>
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>1.0</span>
                <span>10.0</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Map */}
      <div className="h-[70vh] rounded-lg overflow-hidden border border-border relative">
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          ref={mapRef}
        >
          <MapController center={center} zoom={zoom} />
          <LocationTracker onLocationUpdate={setCurrentLocation} />
          
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MarkerClusterGroup 
            onClusterClick={handleClusterClick}
            onMarkerClick={handleMarkerClick}
          >
            {/* Establishments with reviews (filtered by rating) */}
            {filteredEstablishments.map((establishment) => {
              const lat = parseFloat(establishment.coordinates?.lat);
              const lng = parseFloat(establishment.coordinates?.lng);
              
              if (isNaN(lat) || isNaN(lng) || !isValidCoordinate(lat, lng)) {
                console.warn('Invalid establishment coordinates:', establishment);
                return null;
              }
              
              console.log(`Rendering marker for ${establishment.beefery} at [${lat}, ${lng}]`);
              return (
                <Marker
                  key={establishment.id}
                  position={[lat, lng]}
                  icon={createMarkerIcon(establishment.avgRating)}
                  establishmentData={establishment}
                />
              );
            })}

            {/* POI Markers - filtered to exclude locations where reviews exist */}
            {filteredPois.map((poi) => {
              const lat = parseFloat(poi.coordinates?.lat);
              const lng = parseFloat(poi.coordinates?.lng);
              
              if (isNaN(lat) || isNaN(lng) || !isValidCoordinate(lat, lng)) {
                console.warn('Invalid POI coordinates:', poi);
                return null;
              }
              
              console.log(`Rendering POI marker for ${poi.name} at [${lat}, ${lng}]`);
              return (
                <Marker
                  key={`poi-${poi._id}`}
                  position={[lat, lng]}
                  icon={createPoiIcon()}
                  poiData={poi}
                />
              );
            })}
          </MarkerClusterGroup>

          {/* Current Location Marker */}
          {currentLocation && Array.isArray(currentLocation) && 
           currentLocation.length === 2 && isValidCoordinate(currentLocation[0], currentLocation[1]) && (
            <Marker
              position={currentLocation}
              icon={L.divIcon({
                className: 'current-location-marker',
                html: `
                  <div class="relative">
                    <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>
                    <div class="relative bg-blue-500 w-4 h-4 rounded-full border-2 border-white"></div>
                  </div>
                `,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
              })}
            />
          )}
          
          {/* Map Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col space-y-2 z-[400]">
            <button 
              onClick={handleCurrentLocation}
              className="p-3 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-colors"
              title="Go to my location"
            >
              <Navigation className="h-5 w-5" />
            </button>
            <button 
              onClick={() => setZoom(zoom => Math.min(zoom + 1, 19))}
              className="p-3 bg-card text-foreground rounded-full shadow-lg hover:bg-secondary transition-colors"
              title="Zoom in"
            >
              <span className="text-lg font-bold">+</span>
            </button>
            <button 
              onClick={() => setZoom(zoom => Math.max(zoom - 1, 3))}
              className="p-3 bg-card text-foreground rounded-full shadow-lg hover:bg-secondary transition-colors"
              title="Zoom out"
            >
              <span className="text-lg font-bold">−</span>
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="p-3 bg-card text-foreground rounded-full shadow-lg hover:bg-secondary transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </MapContainer>
        
        {loading && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="bg-card p-4 rounded-lg flex items-center space-x-3">
              <Loader className="h-6 w-6 animate-spin text-primary" />
              <span className="text-foreground">Loading map data...</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
          <span>8.0-10.0</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
          <span>6.0-7.9</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-orange-500 mr-2"></div>
          <span>4.0-5.9</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
          <span>1.0-3.9</span>
        </div>
      </div>

      {/* Modals - These will be rendered outside the map container */}
      {selectedReview && (
        <ReviewModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
        />
      )}

      {modalType && modalData && (
        <MapPopupModal 
          type={modalType}
          data={modalData}
          onClose={handleModalClose}
          onViewReview={handleViewReview}
          onSelectEstablishment={handleSelectEstablishment}
        />
      )}
      
      {/* Footer message */}
     <p className="text-sm text-muted-foreground text-center mt-2">
       Tap on markers to view reviews. Use the filter to see beeferies by rating.
     </p>
    </div>
  );
};

export default MapScreen;