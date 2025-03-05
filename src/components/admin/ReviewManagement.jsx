import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Search, 
  Trash2, 
  AlertTriangle,
  ThumbsUp,
  MessageCircle,
  Filter,
  User,
  MapPin,
  Eye,
  Loader,
  Edit
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useNotifications } from '../notifications/NotificationProvider';
import ReviewModal from '../review/ReviewModal';
import ProfileImage from '../user/ProfileImage';
import config from '../../config';

const ReviewManagement = () => {
  const [reviews, setReviews] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 0
  });
  const [filterCriteria, setFilterCriteria] = useState({
    minRating: '',
    maxRating: '',
    reportStatus: 'all',
    sortBy: 'date',
    sortOrder: 'desc',
    page: 1,
    limit: 10
  });
  
  const { showNotification } = useNotifications();

  useEffect(() => {
    fetchReviews();
  }, [filterCriteria, searchTerm]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const queryParams = new URLSearchParams({
        search: searchTerm,
        ...filterCriteria,
        page: filterCriteria.page,
        limit: filterCriteria.limit
      });

      const response = await fetch(`${config.API_URL}/reviews?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch reviews: ${response.status}`);
      }

      const data = await response.json();
      setReviews(data.reviews || []);
      setPagination(data.pagination || { page: 1, total: 0, pages: 0 });
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      showNotification('error', 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`${config.API_URL}/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete review: ${response.status}`);
      }

      setReviews(prev => prev.filter(review => review._id !== reviewId));
      showNotification('success', 'Review deleted successfully');
    } catch (error) {
      console.error('Failed to delete review:', error);
      showNotification('error', 'Failed to delete review');
    }
  };

  const handleFeatureReview = async (reviewId, featured) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    // Get the current review to get its data
    const reviewItem = reviews.find(item => item._id === reviewId);
    if (!reviewItem) {
      throw new Error('Review not found');
    }
    
    // Create a more comprehensive payload similar to news pinning
    const payload = {
      featured: featured,
      // Also add pinned information for consistency with news
      pinned: {
        isPinned: featured, // Mirror the featured status to pinned
        label: 'Featured Review',
        pinnedAt: featured ? new Date() : null
      }
    };
    
    // Update the UI optimistically
    setReviews(prev =>
      prev.map(review =>
        review._id === reviewId ? { 
          ...review, 
          featured: featured,
          pinned: payload.pinned
        } : review
      )
    );
    
    // Fixed URL to match the route defined in reviewRoutes.js
    const response = await fetch(`${config.API_URL}/admin/reviews/${reviewId}/feature`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

    if (!response.ok) {
      throw new Error(`Failed to update review feature status: ${response.status}`);
    }

    // Process the response
    const updatedReview = await response.json();
    
    // Update reviews state with the server response
    setReviews(prev =>
      prev.map(review =>
        review._id === reviewId ? { 
          ...updatedReview,
          // Ensure the pinned property is set correctly
          pinned: {
            isPinned: updatedReview.featured,
            label: 'Featured Review',
            pinnedAt: updatedReview.featured ? new Date() : null
          }
        } : review
      )
    );
    
    // Dispatch a global event for other components to refresh
    const refreshEvent = new CustomEvent('content-updated', {
      detail: { 
        type: 'review-featured', 
        reviewId,
        featured
      }
    });
    window.dispatchEvent(refreshEvent);
    
    showNotification('success', `Review ${featured ? 'featured' : 'unfeatured'} successfully`);
  } catch (error) {
    console.error('Failed to update review feature status:', error);
    showNotification('error', 'Failed to update review feature status');
    
    // Revert the optimistic update on error
    setReviews(prev => [...prev]); // Trigger a re-render
  }
};

  const handleRatingFilter = (min, max) => {
    setFilterCriteria(prev => ({
      ...prev,
      minRating: min,
      maxRating: max,
      page: 1
    }));
  };

  const handleSortChange = (field) => {
    setFilterCriteria(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'desc' ? 'asc' : 'desc',
      page: 1
    }));
  };

  const handlePageChange = (newPage) => {
    setFilterCriteria(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const viewReview = (review) => {
    setSelectedReview(review);
    setShowReviewModal(true);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getMediaUrl = (media) => {
    if (!media || !media.original) return null;
    
    let path = media.original;
    if (path.startsWith('/api/')) {
      path = path.slice(4);
    }
    
    if (!path.startsWith('/uploads/')) {
      path = `/uploads/${path}`;
    }
    
    const baseUrl = config.API_URL.endsWith('/api/') 
      ? config.API_URL.slice(0, -5)
      : config.API_URL.endsWith('/api') 
        ? config.API_URL.slice(0, -4)
        : config.API_URL;

    return `${baseUrl}${path}`;
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Header */}
      <div className="flex flex-col space-y-4">
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search reviews by beefery or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <Filter className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Min Rating
                </label>
                <select
                  value={filterCriteria.minRating}
                  onChange={(e) => handleRatingFilter(e.target.value, filterCriteria.maxRating)}
                  className="w-full p-2 border border-border rounded-lg"
                >
                  <option value="">Any</option>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(rating => (
                    <option key={rating} value={rating}>{rating.toFixed(1)}+</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Max Rating
                </label>
                <select
                  value={filterCriteria.maxRating}
                  onChange={(e) => handleRatingFilter(filterCriteria.minRating, e.target.value)}
                  className="w-full p-2 border border-border rounded-lg"
                >
                  <option value="">Any</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rating => (
                    <option key={rating} value={rating}>{rating.toFixed(1)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Report Status
                </label>
                <select
                  value={filterCriteria.reportStatus}
                  onChange={(e) => setFilterCriteria(prev => ({ ...prev, reportStatus: e.target.value, page: 1 }))}
                  className="w-full p-2 border border-border rounded-lg"
                >
                  <option value="all">All Reviews</option>
                  <option value="reported">Reported Only</option>
                  <option value="unreported">Not Reported</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sort By
                </label>
                <select
                  value={filterCriteria.sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="w-full p-2 border border-border rounded-lg"
                >
                  <option value="date">Date</option>
                  <option value="rating">Rating</option>
                  <option value="likes">Likes</option>
                  <option value="comments">Comments</option>
                </select>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="p-6 flex justify-center items-center">
            <Loader className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2">Loading reviews...</span>
          </Card>
        ) : reviews.length === 0 ? (
          <Card>
            <div className="p-6 text-center text-slate-500">
              No reviews found
            </div>
          </Card>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Beefery</th>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Location</th>
                    <th className="px-4 py-3 text-center">Rating</th>
                    <th className="px-4 py-3 text-center">Likes</th>
                    <th className="px-4 py-3 text-center">Comments</th>
                    <th className="px-4 py-3 text-center">Date</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reviews.map(review => (
                    <tr key={review._id} className="hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-3 truncate max-w-[200px]">{review.beefery}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <ProfileImage
                            user={{
                              _id: review.userId,
                              displayName: review.userDisplayName,
                              profileImage: review.userImage
                            }}
                            size="sm"
                            className="mr-2"
                          />
                          <span>{review.userDisplayName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 truncate max-w-[200px]">{review.location}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center">
                          <span className="font-semibold mr-1">{review.rating.toFixed(1)}</span>
                          <Star className="w-4 h-4 text-yellow-500" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">{review.likes?.length || 0}</td>
                      <td className="px-4 py-3 text-center">{review.comments?.length || 0}</td>
                      <td className="px-4 py-3 text-center">{formatDate(review.date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => viewReview(review)}
                            className="p-1.5 bg-secondary hover:bg-border rounded-lg transition-colors text-foreground"
                            title="View Review"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleFeatureReview(review._id, !review.featured)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              review.featured
                                ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                                : 'bg-secondary hover:bg-border text-foreground'
                            }`}
                            title={review.featured ? 'Unfeature Review' : 'Feature Review'}
                          >
                            <Star className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteReview(review._id)}
                            className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                            title="Delete Review"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex justify-between items-center pt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * filterCriteria.limit) + 1} to {Math.min(pagination.page * filterCriteria.limit, pagination.total)} of {pagination.total} reviews
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border border-border rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {[...Array(pagination.pages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => handlePageChange(i + 1)}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        pagination.page === i + 1
                          ? 'bg-primary text-white'
                          : 'border border-border hover:bg-secondary'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="px-3 py-1 border border-border rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedReview && (
        <ReviewModal
          review={selectedReview}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedReview(null);
          }}
          currentUser={null}
          readOnly={true}
        />
      )}
    </div>
  );
};

export default ReviewManagement;