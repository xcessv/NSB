import React from 'react';
import { X, Star, Navigation, Layers } from 'lucide-react';
import { Card } from '@/components/ui/card';

const MapPopupModal = ({ 
  data, 
  type, 
  onClose,
  onViewReview,
  onSelectEstablishment
}) => {
  if (!data) return null;

  const openDirections = (location) => {
    const encodedAddress = encodeURIComponent(location);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
  };

  // Render different content based on modal type
  const renderContent = () => {
    switch (type) {
      case 'establishment':
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold mb-1">{data.beefery}</h2>
              <p className="text-muted-foreground">
                {data.location}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="bg-primary text-white rounded-full px-3 py-1 flex items-center">
                <span className="text-xl font-bold mr-1">{data.avgRating.toFixed(1)}</span>
                <Star className="h-5 w-5 fill-current" />
              </div>
              <span className="text-muted-foreground">
                {data.reviewCount} {data.reviewCount === 1 ? 'review' : 'reviews'}
              </span>
            </div>

            <div className="pt-4 border-t border-border space-y-3">
              <button
                onClick={() => openDirections(data.location)}
                className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Navigation className="h-5 w-5 mr-2" />
                Get Directions
              </button>
              
              <button
                onClick={() => onViewReview(data.reviews[0])}
                className="w-full flex items-center justify-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Star className="h-5 w-5 mr-2" />
                View Latest Review
              </button>
            </div>
          </div>
        );

      case 'poi':
        return (
          <div className="space-y-5">
            <div>
              <div className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded text-sm inline-block mb-2">
                Point of Interest
              </div>
              <h2 className="text-2xl font-bold mb-1">{data.name}</h2>
              <p className="text-muted-foreground">
                {data.location}
              </p>
            </div>
            
            {data.notes && (
              <div className="bg-secondary p-4 rounded-lg">
                <p className="text-foreground whitespace-pre-line">{data.notes}</p>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <button
                onClick={() => openDirections(data.location)}
                className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Navigation className="h-5 w-5 mr-2" />
                Get Directions
              </button>
            </div>
          </div>
        );

      case 'cluster':
        const establishments = data;
        const totalReviews = establishments.reduce((sum, est) => sum + est.reviewCount, 0);
        const weightedRating = establishments.reduce((sum, est) => 
          sum + (est.avgRating * est.reviewCount), 0);
        const avgRating = totalReviews > 0 ? weightedRating / totalReviews : 0;

        return (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                <span className="flex items-center">
                  <Layers className="h-5 w-5 mr-2 text-primary" />
                  {establishments.length} {establishments.length === 1 ? 'Location' : 'Locations'} Nearby
                </span>
              </h2>
              {totalReviews > 0 && (
                <div className="bg-primary text-white rounded-full px-3 py-1 flex items-center">
                  <span className="text-xl font-bold mr-1">{avgRating.toFixed(1)}</span>
                  <Star className="h-5 w-5 fill-current" />
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border">
              <div className="space-y-4">
                {establishments.map((est, index) => (
                  <div 
                    key={est.id || index} 
                    className="p-3 hover:bg-secondary/50 rounded-lg transition-colors cursor-pointer"
                    onClick={() => onSelectEstablishment(est)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">{est.beefery}</h3>
                        <p className="text-sm text-muted-foreground">{est.location}</p>
                      </div>
                      <div className="flex flex-col items-end ml-4">
                        <div className="flex items-center">
                          <span className="text-lg font-bold text-primary mr-1">
                            {est.avgRating.toFixed(1)}
                          </span>
                          <Star className="h-5 w-5 text-yellow-400 fill-current" />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {est.reviewCount} {est.reviewCount === 1 ? 'review' : 'reviews'}
                        </span>
                      </div>
                    </div>
                    {index < establishments.length - 1 && <div className="border-b border-border mt-3"></div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return <p>Unknown modal type</p>;
    }
  };

  // Determine the modal width based on type
  const getModalWidth = () => {
    if (type === 'cluster') return 'max-w-lg';
    return 'max-w-md';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <Card className={`w-full ${getModalWidth()} bg-card p-6 relative ${type === 'cluster' ? 'max-h-[80vh] overflow-y-auto' : ''}`}>
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        {renderContent()}
      </Card>
    </div>
  );
};

export default MapPopupModal;