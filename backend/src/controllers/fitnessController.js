// backend/src/controllers/fitnessController.js
/**
 * Fitness & Workout Management Controller
 * Handles incoming HTTP requests, validates request payloads,
 * extracts authenticated req.userId, and returns structured API responses.
 */

const FitnessService = require('../services/fitnessService');

class FitnessController {
  // GET /api/v1/fitness/overview?date=YYYY-MM-DD
  static async getOverview(req, res) {
    try {
      const data = await FitnessService.getOverview(req.userId, req.query.date);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('Error fetching fitness overview:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /api/v1/fitness/rotation
  static async getRotation(req, res) {
    try {
      const data = await FitnessService.getRotationState(req.userId);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('Error fetching rotation state:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /api/v1/fitness/exercises
  static async getExercises(req, res) {
    try {
      const data = await FitnessService.getExercises(req.userId, {
        q: req.query.q,
        muscle: req.query.muscle,
        type: req.query.type,
        equipment: req.query.equipment
      });
      return res.json({ success: true, count: data.length, data });
    } catch (error) {
      console.error('Error fetching exercises:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /api/v1/fitness/exercises
  static async createCustomExercise(req, res) {
    try {
      const result = await FitnessService.createCustomExercise(req.userId, req.body);
      return res.status(201).json({ success: true, message: 'Custom exercise created successfully', data: result });
    } catch (error) {
      console.error('Error creating custom exercise:', error);
      const statusCode = error.message.includes('already exists') ? 409 : 400;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  // GET /api/v1/fitness/templates
  static async getTemplates(req, res) {
    try {
      const data = await FitnessService.getWorkoutTemplates(req.userId);
      return res.json({ success: true, count: data.length, data });
    } catch (error) {
      console.error('Error fetching templates:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /api/v1/fitness/templates/:id
  static async getTemplateDetails(req, res) {
    try {
      const data = await FitnessService.getWorkoutTemplateDetails(req.userId, req.params.id);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('Error fetching template details:', error);
      const statusCode = error.message.includes('AUTH_FORBIDDEN') ? 403 : 404;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  // GET /api/v1/fitness/sessions/:id
  static async getSessionDetails(req, res) {
    try {
      const data = await FitnessService.getWorkoutSessionById(req.userId, req.params.id);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('Error fetching workout session:', error);
      const statusCode = error.message.includes('AUTH_FORBIDDEN') ? 403 : 404;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  // POST /api/v1/fitness/sessions
  static async createSession(req, res) {
    try {
      const result = await FitnessService.createWorkoutSession(req.userId, req.body);
      return res.status(201).json({ success: true, message: 'Workout session created successfully', data: result });
    } catch (error) {
      console.error('Error creating workout session:', error);
      const statusCode = error.message.includes('AUTH_FORBIDDEN') ? 403 : 400;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  // PUT /api/v1/fitness/sessions/:id
  static async updateSession(req, res) {
    try {
      const result = await FitnessService.updateWorkoutSession(req.userId, req.params.id, req.body);
      return res.json({ success: true, message: 'Workout session updated successfully', data: result });
    } catch (error) {
      console.error('Error updating workout session:', error);
      const statusCode = error.message.includes('AUTH_FORBIDDEN') ? 403 : 400;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  // DELETE /api/v1/fitness/sessions/:id
  static async deleteSession(req, res) {
    try {
      const result = await FitnessService.deleteWorkoutSession(req.userId, req.params.id);
      return res.json({ success: true, message: 'Workout session deleted successfully', data: result });
    } catch (error) {
      console.error('Error deleting workout session:', error);
      const statusCode = error.message.includes('AUTH_FORBIDDEN') ? 403 : 400;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  // POST /api/v1/fitness/sessions/:id/complete
  static async completeSession(req, res) {
    try {
      const result = await FitnessService.completeWorkoutSession(req.userId, req.params.id, req.body);
      return res.json({ success: true, message: 'Workout session completed successfully', data: result });
    } catch (error) {
      console.error('Error completing workout session:', error);
      const statusCode = error.message.includes('AUTH_FORBIDDEN') ? 403 : 400;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  // POST /api/v1/fitness/sessions/:id/reschedule
  static async rescheduleSession(req, res) {
    try {
      const { newDate } = req.body;
      const result = await FitnessService.rescheduleWorkoutSession(req.userId, req.params.id, newDate);
      return res.json({ success: true, message: 'Workout session rescheduled successfully', data: result });
    } catch (error) {
      console.error('Error rescheduling workout session:', error);
      const statusCode = error.message.includes('AUTH_FORBIDDEN') ? 403 : 400;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  // POST /api/v1/fitness/body-metrics
  static async logBodyMetric(req, res) {
    try {
      const result = await FitnessService.logBodyMetric(req.userId, req.body);
      return res.status(201).json({ success: true, message: 'Body metric recorded successfully', data: result });
    } catch (error) {
      console.error('Error logging body metric:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // GET /api/v1/fitness/body-metrics?days=30
  static async getBodyMetrics(req, res) {
    try {
      const data = await FitnessService.getBodyMetrics(req.userId, req.query.days);
      return res.json({ success: true, count: data.length, data });
    } catch (error) {
      console.error('Error fetching body metrics:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /api/v1/fitness/neat
  static async logNeat(req, res) {
    try {
      const result = await FitnessService.logNeatActivity(req.userId, req.body);
      return res.status(201).json({ success: true, message: 'NEAT activity recorded successfully', data: result });
    } catch (error) {
      console.error('Error logging NEAT activity:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // GET /api/v1/fitness/energy/:date
  static async getDailyEnergy(req, res) {
    try {
      const data = await FitnessService.getDailyEnergy(req.userId, req.params.date);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('Error calculating daily energy:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /api/v1/fitness/energy/calibration/trend
  static async getTdeeCalibration(req, res) {
    try {
      const data = await FitnessService.getCalibratedTdee(req.userId, {
        windowDays: req.query.windowDays
      });
      return res.json({ success: true, data });
    } catch (error) {
      console.error('Error calculating TDEE calibration:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /api/v1/fitness/personal-records
  static async getPersonalRecords(req, res) {
    try {
      const data = await FitnessService.getPersonalRecords(req.userId, req.query.exerciseId);
      return res.json({ success: true, count: data.length, data });
    } catch (error) {
      console.error('Error fetching personal records:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = FitnessController;
