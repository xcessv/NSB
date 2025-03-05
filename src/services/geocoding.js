// Rate limiting helper
const rateLimiter = {
  lastCall: 0,
  minDelay: 1000, // Nominatim requires 1 second between requests
  
  async wait() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    
    if (timeSinceLastCall < this.minDelay) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minDelay - timeSinceLastCall)
      );
    }
    
    this.lastCall = Date.now();
  }
};

export const geocodeAddress = async (address) => {
  try {
    await rateLimiter.wait();
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` + 
      `format=json` +
      `&q=${encodeURIComponent(address)}` +
      `&countrycodes=us` +
      `&limit=1` +
      `&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'NorthShoreBeefs/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding request failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data && data[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: formatUSAddress(data[0]),
        raw: data[0]
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error(
      error.message === 'Failed to fetch' 
        ? 'Network error: Please check your internet connection'
        : 'Failed to geocode address'
    );
  }
};

export const getAddressSuggestions = async (query) => {
  try {
    if (!query || query.length < 3) return [];
    
    await rateLimiter.wait();
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `format=json` +
      `&q=${encodeURIComponent(query)}` +
      `&countrycodes=us` +
      `&addressdetails=1` +
      `&limit=5`,
      {
        headers: {
          'User-Agent': 'NorthShoreBeefs/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch suggestions: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return data
      .filter(item => item.address && item.address.country_code === 'us')
      .map(item => ({
        display_name: formatUSAddress(item),
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        address: item.address,
        type: item.type,
        importance: item.importance
      }))
      .sort((a, b) => b.importance - a.importance);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    if (error.message === 'Failed to fetch') {
      throw new Error('Network error: Please check your internet connection');
    }
    return [];
  }
};

// Enhanced US address formatter with better handling of address components
const formatUSAddress = (item) => {
  const address = item.address;
  const parts = [];

  // Add building name if it exists
  if (address.building) {
    parts.push(address.building);
  }

  // Add house number and road
  if (address.house_number && address.road) {
    parts.push(`${address.house_number} ${address.road}`);
  } else if (address.road) {
    parts.push(address.road);
  }

  // Add neighborhood/suburb if available
  if (address.suburb || address.neighbourhood) {
    parts.push(address.suburb || address.neighbourhood);
  }

  // Add city/town
  if (address.city || address.town || address.village) {
    parts.push(address.city || address.town || address.village);
  }

  // Add county if no city/town available
  if (!parts[parts.length - 1] && address.county) {
    parts.push(address.county);
  }

  // Add state
  if (address.state) {
    // Convert state code to full name if needed
    parts.push(address.state);
  }

  // Add ZIP code
  if (address.postcode) {
    // If last item is state, combine them
    if (parts.length > 0 && address.state === parts[parts.length - 1]) {
      parts[parts.length - 1] += ` ${address.postcode}`;
    } else {
      parts.push(address.postcode);
    }
  }

  return parts.join(', ');
};

// Helper function to validate coordinates
export const isValidCoordinate = (lat, lng) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};