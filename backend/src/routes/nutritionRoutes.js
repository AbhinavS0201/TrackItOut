// backend/src/routes/nutritionRoutes.js
const express = require('express');
const router = express.Router();
const nutritionController = require('../controllers/nutritionController');
const auth = require('../middleware/auth');

router.use(auth);

// Foods & Custom Library
router.get('/foods', (req, res) => nutritionController.searchFoods(req, res));
router.get('/foods/:id', (req, res) => nutritionController.getFoodById(req, res));
router.post('/foods', (req, res) => nutritionController.createCustomFood(req, res));
router.put('/foods/:id', (req, res) => nutritionController.updateFoodProduct(req, res));

// Meal & Hydration Logging
router.post('/meals', (req, res) => nutritionController.logMeal(req, res));
router.post('/water', (req, res) => nutritionController.logWater(req, res));

// Overview & Targets
router.get('/overview', (req, res) => nutritionController.getDailyOverview(req, res));
router.put('/targets', (req, res) => nutritionController.updateTargets(req, res));

module.exports = router;
