import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Loader } from 'lucide-react';
import { geocodeAddress, getAddressSuggestions } from '../services/geocoding';

/**
 * Enhanced LocationPicker component for selecting and entering locations
 * Features:
 * - Improved address suggestions handling
 * - Manual address entry with direct geocoding
 * - Better handling of POIs and existing locations
 * - Clear error feedback
 */
const LocationPicker = ({ 
  onLocationSelect, 
  initialValue = '',
  existingLocations = [],
  pois = [] 
}) => {
  const [address, setAddress] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const searchTimeout = useRef(null);
  const containerRef = useRef(null);

  // Initialize address with initial value
  useEffect(() => {
    if (initialValue && !address) {
      setAddress(initialValue);
    }
  }, [initialValue]);

  // Handle outside clicks to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle address input changes and fetch suggestions
  const handleAddressChange = (e) => {
    const value = e.target.value;
    setAddress(value);
    setError('');

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // Don't show suggestions for very short queries
    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);

    // Use timeout to debounce API calls
    searchTimeout.current = setTimeout(async () => {
      try {
        const combinedResults = [];
        
        // First check for matches in POIs
        if (Array.isArray(pois) && pois.length > 0) {
          const poiMatches = pois.filter(poi => 
            poi.name.toLowerCase().includes(value.toLowerCase()) || 
            (poi.location && poi.location.toLowerCase().includes(value.toLowerCase()))
          ).map(poi => ({
            display_name: poi.location || poi.name,
            source_name: poi.name,
            lat: poi.coordinates?.lat,
            lng: poi.coordinates?.lng,
            source: 'poi'
          }));
          
          combinedResults.push(...poiMatches);
        }
        
        // Then check existing locations
        if (Array.isArray(existingLocations) && existingLocations.length > 0) {
          const existingMatches = existingLocations.filter(loc => 
            loc.location?.toLowerCase().includes(value.toLowerCase()) ||
            loc.name?.toLowerCase().includes(value.toLowerCase())
          ).map(loc => ({
            display_name: loc.location || loc.name,
            source_name: loc.name,
            lat: loc.coordinates?.lat,
            lng: loc.coordinates?.lng,
            source: 'existing'
          }));
          
          combinedResults.push(...existingMatches);
        }
        
        // Finally fetch from geocoding service if needed
        if (combinedResults.length < 5) {
          try {
            const externalResults = await getAddressSuggestions(value);
            if (Array.isArray(externalResults)) {
              combinedResults.push(...externalResults);
            }
          } catch (geocodeError) {
            console.warn('Failed to get address suggestions:', geocodeError);
            // Continue with local results
          }
        }
        
        // Remove duplicates based on coordinates
        const uniqueResults = combinedResults.filter((item, index, self) => 
          index === self.findIndex(t => 
            t.lat === item.lat && t.lng === item.lng
          )
        );
        
        setSuggestions(uniqueResults.slice(0, 10)); // Limit to 10 results
        setShowSuggestions(uniqueResults.length > 0);
      } catch (error) {
        console.error('Error getting suggestions:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  // Handle selection of a suggestion
  const handleSuggestionSelect = (suggestion) => {
    setAddress(suggestion.display_name);
    setShowSuggestions(false);
    
    // Call the parent callback with the selected location data
    onLocationSelect({
      location: suggestion.display_name,
      coordinates: {
        lat: parseFloat(suggestion.lat),
        lng: parseFloat(suggestion.lng)
      },
      source: suggestion.source,
      sourceName: suggestion.source_name
    });
  };

  // Handle manual address entry
  const handleManualAddressSubmit = async () => {
    if (!manualAddress.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Get coordinates for the address
      const result = await geocodeAddress(manualAddress);
      
      if (result && result.lat && result.lng) {
        // Update the address field
        setAddress(manualAddress);
        
        // Call the parent callback with location data
        onLocationSelect({
          location: manualAddress,
          coordinates: {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lng)
          },
          source: 'manual'
        });
        
        // Clear the manual address field
        setManualAddress('');
      } else {
        setError('Could not find this address. Please try a different format or address.');
      }
    } catch (error) {
      console.error('Manual address geocoding error:', error);
      setError('Error finding location. Please check the address and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle clearing the address
  const handleClearAddress = () => {
    setAddress('');
    onLocationSelect({
      location: '',
      coordinates: { lat: 0, lng: 0 }
    });
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Main address input field */}
      <div className="relative">
        <input
          type="text"
          value={address}
          onChange={handleAddressChange}
          placeholder="Search for a location..."
          className="w-full p-3 pl-10 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          onFocus={() => address.length >= 2 && setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (suggestions.length > 0) {
                handleSuggestionSelect(suggestions[0]);
              } else if (address.trim()) {
                // If no suggestions but address is entered, try to geocode it
                setManualAddress(address);
                handleManualAddressSubmit();
              }
            }
          }}
        />
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        
        {/* Clear button */}
        {address && (
          <button
            type="button"
            onClick={handleClearAddress}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Address suggestions dropdown */}
      {showSuggestions && (
        <div className="absolute z-10 mt-1 w-full max-w-lg bg-card rounded-lg shadow-lg border border-border max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center">
              <Loader className="h-5 w-5 animate-spin mx-auto mb-2" />
              <span className="text-sm text-muted-foreground">Finding locations...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <ul className="py-1">
              {suggestions.map((suggestion, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="w-full px-4 py-2 text-left hover:bg-secondary transition-colors flex items-center"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{suggestion.display_name}</div>
                      {suggestion.source_name && suggestion.source_name !== suggestion.display_name && (
                        <div className="text-xs text-muted-foreground">{suggestion.source_name}</div>
                      )}
                    </div>
                    <div>
                      {suggestion.source === 'poi' ? (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">POI</span>
                      ) : suggestion.source === 'existing' ? (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Saved</span>
                      ) : (
                        <span className="text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded-full">Map</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              <p className="text-sm">No locations found</p>
              <p className="text-xs mt-1">Try the manual address entry below</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}

      {/* Manual address entry section */}
      <div className="mt-3">
        <div className="text-xs text-muted-foreground mb-1">Or enter address manually:</div>
        <div className="flex space-x-2">
          <input
            type="text"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            placeholder="Enter full address..."
            className="flex-1 p-2 text-sm border border-border rounded-lg"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleManualAddressSubmit();
              }
            }}
          />
          <button
            type="button"
            onClick={handleManualAddressSubmit}
            disabled={loading || !manualAddress.trim()}
            className="px-3 py-1 text-sm bg-secondary hover:bg-border transition-colors rounded-lg disabled:opacity-50"
          >
            {loading ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              'Lookup'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;