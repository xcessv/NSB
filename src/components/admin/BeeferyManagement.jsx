import React, { useState, useEffect } from 'react';
import { 
  Edit2, 
  Trash2, 
  MapPin, 
  Search, 
  Plus, 
  Save, 
  X, 
  Loader,
  Star,
  AlertTriangle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import LocationPicker from '../LocationPicker';
import config from '../../config';
import { reviewService } from '../../services/api';

const BeeferyManagement = ({ currentUser }) => {
  const [beeferies, setBeeferies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBeefery, setEditingBeefery] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredBeeferies, setFilteredBeeferies] = useState([]);

  useEffect(() => {
    fetchBeeferies();
  }, []);

  useEffect(() => {
    // Filter beeferies based on search term
    if (beeferies.length > 0) {
      const filtered = beeferies.filter(
        (beefery) => 
          beefery.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (beefery.location && beefery.location.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredBeeferies(filtered);
    }
  }, [beeferies, searchTerm]);

  const fetchBeeferies = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First try to get data from the dedicated beefery endpoint
      const token = localStorage.getItem('token');
      
      try {
        const response = await fetch(`${config.API_URL}/admin/beeferies`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.beeferies && Array.isArray(data.beeferies)) {
            setBeeferies(data.beeferies);
            setFilteredBeeferies(data.beeferies);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.log('Dedicated beefery endpoint not available, falling back to review data');
      }
      
      // If dedicated endpoint fails, fallback to getting data from reviews
      const response = await reviewService.getReviews();
      
      if (response && response.reviews && Array.isArray(response.reviews)) {
        // Group reviews by beefery
        const beeferyMap = {};
        
        response.reviews.forEach(review => {
          const key = `${review.beefery}-${review.location || ''}`;
          
          if (!beeferyMap[key]) {
            beeferyMap[key] = {
              name: review.beefery,
              location: review.location || '',
              coordinates: review.coordinates || null,
              reviews: [],
              reviewCount: 0,
              avgRating: 0,
              _id: key // Using beefery-location as ID until we have proper IDs
            };
          }
          
          beeferyMap[key].reviews.push(review);
          beeferyMap[key].reviewCount = beeferyMap[key].reviews.length;
          beeferyMap[key].avgRating = beeferyMap[key].reviews.reduce((sum, r) => sum + r.rating, 0) / beeferyMap[key].reviewCount;
        });
        
        const beeferyList = Object.values(beeferyMap);
        setBeeferies(beeferyList);
        setFilteredBeeferies(beeferyList);
      } else {
        throw new Error('No beefery data available');
      }
    } catch (error) {
      console.error('Error fetching beeferies:', error);
      setError('Failed to load beeferies. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.API_URL}/admin/beeferies`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to add beefery' }));
        throw new Error(errorData.message || 'Failed to add beefery');
      }

      const newBeefery = await response.json();
      setBeeferies([...beeferies, newBeefery]);
      setShowAddForm(false);
      
      // Show success message
      alert('Beefery added successfully');
    } catch (error) {
      console.error('Error adding beefery:', error);
      setError(error.message);
    }
  };

  const handleEdit = async (id, formData) => {
    try {
      // Check if we have a proper API endpoint for editing
      if (id.includes('-')) {
        // This is a synthetic ID, we need to create the beefery instead
        return handleAdd(formData);
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.API_URL}/admin/beeferies/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to update beefery' }));
        throw new Error(errorData.message || 'Failed to update beefery');
      }

      const updatedBeefery = await response.json();
      setBeeferies(beeferies.map(beefery => beefery._id === id ? updatedBeefery : beefery));
      setEditingBeefery(null);
      
      // Show success message
      alert('Beefery updated successfully');
    } catch (error) {
      console.error('Error updating beefery:', error);
      setError(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this beefery? This will not delete associated reviews.')) return;

    try {
      // Check if we have a proper ID
      if (id.includes('-')) {
        // This is a synthetic ID from our grouping, we can't actually delete it
        alert('Cannot delete this beefery as it has associated reviews. Delete the reviews first.');
        return;
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.API_URL}/admin/beeferies/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete beefery' }));
        throw new Error(errorData.message || 'Failed to delete beefery');
      }

      setBeeferies(beeferies.filter(beefery => beefery._id !== id));
      
      // Show success message
      alert('Beefery deleted successfully');
    } catch (error) {
      console.error('Error deleting beefery:', error);
      setError(error.message);
    }
  };

  const BeeferyForm = ({ onSubmit, initialData = null, onCancel }) => {
    const [formData, setFormData] = useState({
      name: initialData?.name || '',
      location: initialData?.location || '',
      coordinates: initialData?.coordinates || { lat: 0, lng: 0 },
      notes: initialData?.notes || '',
      isPermanent: initialData?.isPermanent || false
    });

    const handleLocationSelect = (locationData) => {
      setFormData(prev => ({
        ...prev,
        location: locationData.location || prev.location,
        coordinates: locationData.coordinates || prev.coordinates
      }));
    };

    return (
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formData);
      }} className="space-y-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">
              Beefery Name
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-3 border border-border rounded-lg"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="location" className="block text-sm font-medium text-slate-700">
              Location
            </label>
            <LocationPicker
              onLocationSelect={handleLocationSelect}
              initialValue={formData.location}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
              Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-3 border border-border rounded-lg min-h-[100px]"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isPermanent"
              checked={formData.isPermanent}
              onChange={(e) => setFormData({ ...formData, isPermanent: e.target.checked })}
              className="mr-2 h-4 w-4"
            />
            <label htmlFor="isPermanent" className="text-sm font-medium text-slate-700">
              Permanent Location (Not a Pop-up)
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            {initialData ? 'Save Changes' : 'Add Beefery'}
          </button>
        </div>
      </form>
    );
  };

  if (!currentUser?.role === 'admin') {
    return (
      <Card className="p-6 shadow-sm">
        <div className="flex items-center justify-center text-muted-foreground">
          <AlertTriangle className="mr-2 h-5 w-5" />
          <p>You don't have permission to manage Beeferies.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <div className="p-6 border-b border-border">
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl font-bold text-foreground text-center">
              Beefery Management
            </h2>
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                type="text"
                placeholder="Search beeferies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 p-2 border border-border rounded-lg w-full"
              />
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center justify-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Beefery
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span className="flex-grow">{error}</span>
              <button 
                onClick={() => setError(null)}
                className="p-1 hover:bg-red-100 rounded-full"
              >
                <X className="h-4 w-4 text-red-700" />
              </button>
            </div>
          )}

          {showAddForm && (
            <div className="mb-6">
              <div className="bg-slate-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Add New Beefery</h3>
                <BeeferyForm
                  onSubmit={handleAdd}
                  onCancel={() => setShowAddForm(false)}
                />
              </div>
              <div className="my-6 border-t border-border"></div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredBeeferies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="mb-2">
                {searchTerm ? 
                  <Search className="h-10 w-10 mx-auto text-muted-foreground/50" /> : 
                  <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground/50" />
                }
              </div>
              <p className="text-lg">
                {searchTerm ? 'No beeferies match your search.' : 'No beeferies added yet.'}
              </p>
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="mt-2 px-4 py-1 text-sm border border-border rounded-md hover:bg-secondary"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredBeeferies.map(beefery => (
                <div
                  key={beefery._id}
                  className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white"
                >
                  {editingBeefery === beefery._id ? (
                    <div className="p-6">
                      <BeeferyForm
                        initialData={beefery}
                        onSubmit={(formData) => handleEdit(beefery._id, formData)}
                        onCancel={() => setEditingBeefery(null)}
                      />
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2 flex-grow">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-lg">{beefery.name}</h3>
                            {beefery.avgRating && (
                              <div className="flex items-center text-yellow-500">
                                <Star className="h-4 w-4 fill-current" />
                                <span className="ml-1 font-medium">{beefery.avgRating.toFixed(1)}</span>
                              </div>
                            )}
                            {beefery.isPermanent && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700">
                                Permanent
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center text-muted-foreground">
                            <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                            <span className="text-sm">{beefery.location || "No location specified"}</span>
                          </div>
                          
                          {beefery.reviewCount > 0 && (
                            <p className="text-sm text-muted-foreground">
                              {beefery.reviewCount} {beefery.reviewCount === 1 ? 'review' : 'reviews'}
                            </p>
                          )}
                          
                          {beefery.notes && (
                            <div className="mt-3 text-sm text-muted-foreground bg-slate-50 p-3 rounded-md">
                              {beefery.notes}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex md:flex-col space-x-2 md:space-x-0 md:space-y-2 self-end md:self-start">
                          <button
                            onClick={() => setEditingBeefery(beefery._id)}
                            className="px-3 py-1 border border-border rounded-md hover:bg-secondary flex items-center"
                          >
                            <Edit2 className="h-4 w-4 mr-1 text-muted-foreground" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(beefery._id)}
                            className="px-3 py-1 border border-red-200 rounded-md text-red-500 hover:bg-red-50 flex items-center"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default BeeferyManagement;