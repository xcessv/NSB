import React from 'react';
import L from 'leaflet';
import { Star } from 'lucide-react';

export const createMarkerCluster = (reviews) => {
  // Group reviews by establishment
  const establishments = {};
  reviews.forEach(review => {
    const key = `${review.beefery}-${review.location}`;
    if (!establishments[key]) {
      establishments[key] = {
        beefery: review.beefery,
        location: review.location,
        coordinates: review.coordinates,
        reviews: [],
        averageRating: 0,
        totalReviews: 0
      };
    }
    establishments[key].reviews.push(review);
  });

  // Calculate averages
  Object.values(establishments).forEach(est => {
    est.averageRating = est.reviews.reduce((acc, r) => acc + r.rating, 0) / est.reviews.length;
    est.totalReviews = est.reviews.length;
  });

  return establishments;
};

export const createMarkerIcon = (rating) => {
  const color = rating >= 8 ? '#22c55e' : 
                rating >= 6 ? '#3b82f6' : 
                rating >= 4 ? '#f59e0b' : '#ef4444';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      ">
        ${rating.toFixed(1)}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
};

export const ReviewPopup = ({ establishment }) => (
  <div className="min-w-[250px]">
    <h3 className="text-lg font-bold mb-2">{establishment.beefery}</h3>
    <p className="text-sm text-muted-foreground mb-3">{establishment.location}</p>
    
    <div className="flex items-center space-x-2 mb-4">
      <div className="text-2xl font-bold text-primary">
        {establishment.averageRating.toFixed(1)}
      </div>
      <Star className="w-6 h-6 text-yellow-400 fill-current" />
      <span className="text-sm text-slate-500">
        ({establishment.totalReviews} reviews)
      </span>
    </div>

    <div className="space-y-3">
      {establishment.reviews.slice(0, 3).map((review, i) => (
        <div key={i} className="border-t pt-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{review.userDisplayName}</span>
            <div className="flex items-center">
              <span className="font-bold mr-1">{review.rating.toFixed(1)}</span>
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{review.introComments}</p>
        </div>
      ))}
    </div>
  </div>
);

export default { createMarkerCluster, createMarkerIcon, ReviewPopup };