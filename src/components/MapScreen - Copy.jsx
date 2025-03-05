import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Card } from './ui/card';
import { Search, Loader, Navigation, X, MapPin, Store } from 'lucide-react';
import { geocodeAddress, getAddressSuggestions } from '../services/geocoding';
import ReviewModal from './review/ReviewModal';
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';
import 'leaflet.markercluster';
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import _ from 'lodash';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create marker icons
const createMarkerIcon = (rating) => {
  const colorClass = rating >= 8 ? 'bg-green-500' : 
                    rating >= 6 ? 'bg-yellow-500' : 
                    'bg-red-500';

  return L.divIcon({
    html: `
      <div class="marker-icon ${colorClass}">
        ${rating?.toFixed(1) || 'N/A'}
      </div>
    `,
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

const createPoiIcon = () => {
  return L.divIcon({
    html: `
      <div class="marker-icon bg-blue-500">
        POI
      </div>
    `,
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

// Map controller component
const MapController = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
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

// Marker cluster component
const MarkerClusterGroup = ({ children }) => {
  const map = useMap();
  const clusterGroupRef = useRef(null);

  useEffect(() => {
    clusterGroupRef.current = new L.MarkerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      spiderfyDistanceMultiplier: 2,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
      iconCreateFunction: function(cluster) {
        const markers = cluster.getAllChildMarkers();
        const ratings = markers.map(marker => marker.options.rating || 0);
        const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        
        return L.divIcon({
          html: `
            <div class="cluster-marker">
              <div class="cluster-marker-inner">
                ${avgRating.toFixed(1)}
              </div>
            </div>
          `,
          className: 'custom-cluster-marker',
          iconSize: L.point(40, 40)
        });
      }
    });

    // Add cluster click handler
    clusterGroupRef.current.on('clusterclick', (event) => {
      const cluster = event.layer;
      const markers = cluster.getAllChildMarkers();
      const bounds = cluster.getBounds();
      
      // If zoomed in enough, spiderfy. Otherwise, show popup
      if (map.getZoom() >= map.getMaxZoom()) {
        cluster.spiderfy();
      } else {
        // Calculate cluster stats
        const total = markers.length;
        const establishments = markers.map(marker => marker.options.establishmentData || {});
        const totalReviews = establishments.reduce((sum, est) => sum + (est.reviewCount || 0), 0);
        const weightedRating = establishments.reduce((sum, est) => 
          sum + ((est.avgRating || 0) * (est.reviewCount || 0)), 0);
        const avgRating = weightedRating / totalReviews;

        // Create and bind popup
        const popup = L.popup({
          maxWidth: 300,
          className: 'cluster-popup'
        })
          .setLatLng(cluster.getLatLng())
          .setContent(`
            <div class="p-2">
              <h3 class="font-bold text-lg mb-2">${total} Locations Nearby</h3>
              <div class="text-sm space-y-1">
                <div class="flex items-center">
                  <span class="font-medium">Total Reviews:</span>
                  <span class="ml-2">${totalReviews}</span>
                </div>
                <div class="flex items-center">
                  <span class="font-medium">Average Rating:</span>
                  <span class="ml-2 font-bold text-primary">${avgRating.toFixed(1)}</span>
                  <span class="text-yellow-500 ml-1">★</span>
                </div>
              </div>
              <div class="mt-3 text-xs text-gray-500">
                Click again to zoom in
              </div>
            </div>
          `);

        // Open popup and set up zoom on close
        popup.openOn(map);
        
        // Set up zoom when popup closes
        popup.on('remove', () => {
          map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: map.getZoom() + 1
          });
        });
      }
    });

    map.addLayer(clusterGroupRef.current);

    return () => {
      map.removeLayer(clusterGroupRef.current);
    };
  }, [map]);

  useEffect(() => {
    clusterGroupRef.current.clearLayers();
    
    React.Children.forEach(children, child => {
      if (child) {
        const { position, icon, popup, establishmentData, ...props } = child.props;
        const marker = L.marker(position, { 
          icon,
          rating: establishmentData?.avgRating,
          establishmentData
        });
        if (popup) {
          const popupComponent = popup;
          marker.bindPopup(() => {
            const div = document.createElement('div');
            div.innerHTML = React.isValidElement(popupComponent) 
              ? ReactDOMServer.renderToString(popupComponent)
              : popupComponent;
            return div;
          });
        }
        clusterGroupRef.current.addLayer(marker);
      }
    });
  }, [children]);

  return null;
};

const MapScreen = ({ reviews = [] }) => {
  const [center, setCenter] = useState([42.3601, -71.0589]); // Boston area
  const [zoom, setZoom] = useState(12);
  const [address, setAddress] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pois, setPois] = useState([]);
  const searchTimeout = useRef(null);
  const searchContainerRef = useRef(null);

  // Group reviews by establishment
  const establishments = useMemo(() => {
    const grouped = _.groupBy(reviews, review => `${review.beefery}-${review.location}`);
    
    return Object.entries(grouped).map(([key, establishmentReviews]) => {
      const firstReview = establishmentReviews[0];
      const avgRating = _.meanBy(establishmentReviews, 'rating');
      
      return {
        id: key,
        beefery: firstReview.beefery,
        location: firstReview.location,
        coordinates: firstReview.coordinates,
        reviews: _.orderBy(establishmentReviews, ['date'], ['desc']),
        avgRating,
        reviewCount: establishmentReviews.length
      };
    });
  }, [reviews]);

  // Fetch POIs and handle location on mount
  useEffect(() => {
    const fetchPois = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/pois', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      setPois(data.pois || []);
    } else if (response.status === 404) {
      // API endpoint not found, just set empty array
      console.log('POI endpoint not available yet');
      setPois([]);
    } else {
      const error = await response.text();
      throw new Error(error);
    }
  } catch (error) {
    console.error('Error fetching POIs:', error);
    setPois([]); // Set empty array on error
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

  const handleCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = [position.coords.latitude, position.coords.longitude];
          setCurrentLocation(newLocation);
          setCenter(newLocation);
          setZoom(13);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setError('Could not get your location. Please try searching for your address instead.');
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
        const results = await getAddressSuggestions(value);
        setSuggestions(results);
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

  const openDirections = (location) => {
    const encodedAddress = encodeURIComponent(location);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Search Section */}
      <div className="relative" ref={searchContainerRef}>
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
          </div>
          <button
            onClick={handleCurrentLocation}
            className="p-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            title="Use my location"
          >
            <Navigation className="h-5 w-5" />
          </button>
        </div>

        {/* Search Suggestions */}
        {showSuggestions && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card rounded-lg shadow-lg border border-border max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-slate-500">
                <Loader className="animate-spin h-5 w-5 mx-auto mb-2" />
                Loading suggestions...
              </div>
            ) : suggestions.length > 0 ? (
              <ul className="py-2">
                {suggestions.map((suggestion, index) => (
                  <li key={index}>
                    <button
                      className="w-full px-4 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                      onClick={() => handleSuggestionSelect(suggestion)}
                    >
                      {suggestion.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-slate-500">
                No suggestions found
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="mt-2 text-sm text-red-500">{error}</p>
        )}
      </div>

      {/* Map */}
      <div className="h-[70vh] rounded-lg overflow-hidden border border-border relative">
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <MapController center={center} zoom={zoom} />
          <LocationTracker onLocationUpdate={setCurrentLocation} />
          
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MarkerClusterGroup>
            {/* Establishment Markers */}
            {establishments.map((establishment) => (
              <Marker
                key={establishment.id}
                position={[establishment.coordinates.lat, establishment.coordinates.lng]}
                icon={createMarkerIcon(establishment.avgRating)}
                establishmentData={establishment}
              >
                <Popup>
                  <div className="min-w-[250px]">
                    <h3 className="font-bold text-lg mb-1">{establishment.beefery}</h3>
                    <p className="text-sm text-gray-600 mb-3">{establishment.location}</p>
                    
                    <div className="flex items-center mb-3">
                      <span className="font-bold text-lg mr-1 text-primary">
                        {establishment.avgRating.toFixed(1)}
                      </span>
                      <span className="text-yellow-500">★</span>
                      <span className="text-sm text-gray-500 ml-2">
                        ({establishment.reviewCount} reviews)
                      </span>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={() => openDirections(establishment.location)}
                        className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm flex items-center justify-center"
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        Get Directions
                      </button>
                      
                      <button
                        onClick={() => setSelectedReview(establishment.reviews[0])}
                        className="w-full px-3 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors text-sm"
                      >
                        View Latest Review
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* POI Markers */}
            {pois.map((poi) => (
              <Marker
                key={`poi-${poi._id}`}
                position={[poi.coordinates.lat, poi.coordinates.lng]}
                icon={createPoiIcon()}
              >
                <Popup>
                  <div className="min-w-[250px]">
                    <div className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-sm inline-block mb-2">
                      Point of Interest
                    </div>
                    <h3 className="font-bold text-lg mb-1">{poi.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{poi.location}</p>
                    
                    {poi.notes && (
                      <p className="text-sm text-gray-600 mb-3">{poi.notes}</p>
                    )}

                    <button
                      onClick={() => openDirections(poi.location)}
                      className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm flex items-center justify-center"
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      Get Directions
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {/* Current Location Marker */}
          {currentLocation && (
            <Marker
              position={currentLocation}
              icon={L.divIcon({
                className: 'current-location-marker',
                html: `
                  <div class="relative">
                    <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping"></div>
                    <div class="relative bg-blue-500 w-4 h-4 rounded-full border-2 border-white"></div>
                  </div>
                `,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
              })}
            >
              <Popup>
                <div className="text-center">
                  <strong>Your Location</strong>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Review Modal */}
      {selectedReview && (
        <ReviewModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
        />
      )}
    </div>
  );
};

export default MapScreen;