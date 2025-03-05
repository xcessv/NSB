const isValidCoordinates = (coordinates) => {
  if (!coordinates || typeof coordinates !== 'object') return false;
  
  const { lat, lng } = coordinates;
  
  // Check if lat and lng are numbers and within valid ranges
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  
  return true;
};

module.exports = {
  isValidCoordinates
};