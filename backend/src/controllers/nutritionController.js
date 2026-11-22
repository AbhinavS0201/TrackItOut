// backend/src/controllers/nutritionController.js
const nutritionService = require('../services/nutritionService');

class NutritionController {
  async searchFoods(req, res) {
    try {
      const { q } = req.query;
      const userId = req.userId || req.user?.id;
      const foods = await nutritionService.searchFoods(userId, q || '');
      res.json(foods);
    } catch (err) {
      console.error('Error searching foods:', err);
      res.status(500).json({ error: 'Failed to search foods' });
    }
  }

  async getFoodById(req, res) {
    try {
      const userId = req.userId || req.user?.id;
      const food = await nutritionService.getFoodById(userId, req.params.id);
      if (!food) {
        return res.status(404).json({ error: 'Food product not found' });
      }
      res.json(food);
    } catch (err) {
      console.error('Error getting food:', err);
      res.status(500).json({ error: 'Failed to retrieve food product' });
    }
  }

  async createCustomFood(req, res) {
    try {
      const userId = req.userId || req.user?.id;
      const food = await nutritionService.createCustomFood(userId, req.body);
      res.status(201).json(food);
    } catch (err) {
      console.error('Error creating food:', err);
      res.status(400).json({ error: err.message || 'Failed to create food product' });
    }
  }

  async updateFoodProduct(req, res) {
    try {
      const userId = req.userId || req.user?.id;
      const food = await nutritionService.updateFoodProduct(userId, req.params.id, req.body);
      res.json(food);
    } catch (err) {
      console.error('Error updating food:', err);
      res.status(400).json({ error: err.message || 'Failed to update food product' });
    }
  }

  async logMeal(req, res) {
    try {
      const userId = req.userId || req.user?.id;
      const { date, meal_type, items, water_ml, notes } = req.body;
      if (!date || !meal_type) {
        return res.status(400).json({ error: 'Date and meal_type are required' });
      }
      const result = await nutritionService.logMeal(userId, date, meal_type, items || [], water_ml || 0, notes || '');
      res.status(201).json(result);
    } catch (err) {
      console.error('Error logging meal:', err);
      res.status(400).json({ error: err.message || 'Failed to log meal' });
    }
  }

  async logWater(req, res) {
    try {
      const userId = req.userId || req.user?.id;
      const { date, water_ml } = req.body;
      if (!date || !water_ml) {
        return res.status(400).json({ error: 'Date and water_ml are required' });
      }
      const result = await nutritionService.logWater(userId, date, water_ml);
      res.status(201).json(result);
    } catch (err) {
      console.error('Error logging water:', err);
      res.status(400).json({ error: err.message || 'Failed to log water' });
    }
  }

  async getDailyOverview(req, res) {
    try {
      const userId = req.userId || req.user?.id;
      const date = req.query.date || new Date().toISOString().slice(0, 10);
      const overview = await nutritionService.getDailyOverview(userId, date);
      res.json(overview);
    } catch (err) {
      console.error('Error getting daily overview:', err);
      res.status(500).json({ error: 'Failed to retrieve daily nutrition overview' });
    }
  }

  async updateTargets(req, res) {
    try {
      const userId = req.userId || req.user?.id;
      const targets = await nutritionService.updateTargets(userId, req.body);
      res.json(targets);
    } catch (err) {
      console.error('Error updating targets:', err);
      res.status(400).json({ error: 'Failed to update nutrition targets' });
    }
  }
}

module.exports = new NutritionController();
