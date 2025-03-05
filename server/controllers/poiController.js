const Poi = require('../models/Poi');
const { isValidCoordinates } = require('../utils/validation');

const poiController = {
  // Get all POIs
  getAllPois: async (req, res) => {
    try {
      const pois = await Poi.find()
        .populate('addedBy', 'displayName')
        .sort('-createdAt');
      
      res.json({ pois });
    } catch (error) {
      console.error('Error fetching POIs:', error);
      res.status(500).json({ message: 'Failed to fetch POIs' });
    }
  },

  // Add new POI
  addPoi: async (req, res) => {
    try {
      const { name, location, coordinates, notes } = req.body;

      // Validate coordinates
      if (!isValidCoordinates(coordinates)) {
        return res.status(400).json({ message: 'Invalid coordinates' });
      }

      const poi = new Poi({
        name,
        location,
        coordinates,
        notes,
        addedBy: req.user._id
      });

      await poi.save();
      await poi.populate('addedBy', 'displayName');

      res.status(201).json(poi);
    } catch (error) {
      console.error('Error adding POI:', error);
      res.status(500).json({ message: 'Failed to add POI' });
    }
  },

  // Update POI
  updatePoi: async (req, res) => {
    try {
      const { name, location, coordinates, notes } = req.body;
      const poiId = req.params.id;

      // Validate coordinates
      if (!isValidCoordinates(coordinates)) {
        return res.status(400).json({ message: 'Invalid coordinates' });
      }

      const poi = await Poi.findById(poiId);
      if (!poi) {
        return res.status(404).json({ message: 'POI not found' });
      }

      // Only admin or the user who added the POI can update it
      if (!req.user.isAdmin && poi.addedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to update this POI' });
      }

      poi.name = name;
      poi.location = location;
      poi.coordinates = coordinates;
      poi.notes = notes;

      await poi.save();
      await poi.populate('addedBy', 'displayName');

      res.json(poi);
    } catch (error) {
      console.error('Error updating POI:', error);
      res.status(500).json({ message: 'Failed to update POI' });
    }
  },

  // Delete POI
  deletePoi: async (req, res) => {
    try {
      const poiId = req.params.id;
      const poi = await Poi.findById(poiId);

      if (!poi) {
        return res.status(404).json({ message: 'POI not found' });
      }

      // Only admin or the user who added the POI can delete it
      if (!req.user.isAdmin && poi.addedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to delete this POI' });
      }

      await poi.remove();
      res.json({ message: 'POI deleted successfully' });
    } catch (error) {
      console.error('Error deleting POI:', error);
      res.status(500).json({ message: 'Failed to delete POI' });
    }
  },

  // Get single POI
  getPoi: async (req, res) => {
    try {
      const poi = await Poi.findById(req.params.id)
        .populate('addedBy', 'displayName');
      
      if (!poi) {
        return res.status(404).json({ message: 'POI not found' });
      }

      res.json(poi);
    } catch (error) {
      console.error('Error fetching POI:', error);
      res.status(500).json({ message: 'Failed to fetch POI' });
    }
  }
};

module.exports = poiController;