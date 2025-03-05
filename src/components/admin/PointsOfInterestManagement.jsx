import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save, Loader } from 'lucide-react';
import { Card } from '@/components/ui/card';
import LocationPicker from '../LocationPicker';
import config from '../../config';

const PointsOfInterestManagement = ({ currentUser }) => {
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPoi, setEditingPoi] = useState(null);

  useEffect(() => {
    fetchPois();
  }, []);

  const fetchPois = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.API_URL}/admin/pois`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPois(data.pois || []);
      } else {
        console.log('POI endpoint not yet available');
        setPois([]);
      }
    } catch (error) {
      console.error('Error fetching POIs:', error);
      setPois([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.API_URL}/admin/pois`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to add POI');
      const newPoi = await response.json();
      setPois([...pois, newPoi]);
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding POI:', error);
      setError(error.message);
    }
  };

  const handleEdit = async (id, formData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.API_URL}/admin/pois/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to update POI');
      const updatedPoi = await response.json();
      setPois(pois.map(poi => poi._id === id ? updatedPoi : poi));
      setEditingPoi(null);
    } catch (error) {
      console.error('Error updating POI:', error);
      setError(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this POI?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.API_URL}/admin/pois/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete POI');
      setPois(pois.filter(poi => poi._id !== id));
    } catch (error) {
      console.error('Error deleting POI:', error);
      setError(error.message);
    }
  };

  const PoiForm = ({ onSubmit, initialData = null, onCancel }) => {
    const [formData, setFormData] = useState({
      name: initialData?.name || '',
      location: initialData?.location || '',
      coordinates: initialData?.coordinates || { lat: 0, lng: 0 },
      notes: initialData?.notes || ''
    });

    return (
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formData);
      }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Beefery Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-3 border border-border rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Location
          </label>
          <LocationPicker
            onLocationSelect={({ location, coordinates }) => {
              setFormData({ ...formData, location, coordinates });
            }}
            initialValue={formData.location}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full p-3 border border-border rounded-lg"
            rows={3}
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-muted-foreground hover:bg-secondary rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            {initialData ? 'Save Changes' : 'Add POI'}
          </button>
        </div>
      </form>
    );
  };

  if (!currentUser?.role === 'admin') {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          You don't have permission to manage Points of Interest.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-foreground">
            Points of Interest
          </h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add New POI
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg">
            {error}
          </div>
        )}

        {showAddForm && (
          <div className="mb-6 border-b pb-6">
            <h3 className="text-lg font-semibold mb-4">Add New POI</h3>
            <PoiForm
              onSubmit={handleAdd}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}

        {loading ? (
          <div className="text-center py-4">
            <Loader className="h-6 w-6 animate-spin mx-auto text-primary" />
          </div>
        ) : pois.length === 0 ? (
          <p className="text-center text-muted-foreground">
            No points of interest added yet.
          </p>
        ) : (
          <div className="space-y-4">
            {pois.map(poi => (
              <div
                key={poi._id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                {editingPoi === poi._id ? (
                  <PoiForm
                    initialData={poi}
                    onSubmit={(formData) => handleEdit(poi._id, formData)}
                    onCancel={() => setEditingPoi(null)}
                  />
                ) : (
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{poi.name}</h3>
                        <p className="text-muted-foreground">{poi.location}</p>
                        {poi.notes && (
                          <p className="text-sm text-slate-500 mt-2">{poi.notes}</p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingPoi(poi._id)}
                          className="p-2 hover:bg-secondary rounded-lg"
                        >
                          <Edit2 className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(poi._id)}
                          className="p-2 hover:bg-secondary rounded-lg"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default PointsOfInterestManagement;