const express = require('express');
const router = express.Router();
const poiController = require('../controllers/poiController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Public routes
router.get('/', poiController.getAllPois);
router.get('/:id', poiController.getPoi);

// Protected routes
router.post('/', authenticateToken, isAdmin, poiController.addPoi);
router.put('/:id', authenticateToken, isAdmin, poiController.updatePoi);
router.delete('/:id', authenticateToken, isAdmin, poiController.deletePoi);

module.exports = router;