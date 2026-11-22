// backend/src/routes/fitnessRoutes.js
/**
 * Fitness & Workout Management API Routes
 * Base URL: /api/v1/fitness
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const FitnessController = require('../controllers/fitnessController');

// All fitness endpoints strictly require JWT authentication
router.use(authMiddleware);

// Dashboard Overview & Split Rotation
router.get('/overview', FitnessController.getOverview);
router.get('/rotation', FitnessController.getRotation);

// Exercise Library (Global catalog + Custom exercises)
router.get('/exercises', FitnessController.getExercises);
router.post('/exercises', FitnessController.createCustomExercise);

// Workout Templates (A/B/C/D split + Cardio protocols)
router.get('/templates', FitnessController.getTemplates);
router.get('/templates/:id', FitnessController.getTemplateDetails);

// Workout Sessions (CRUD, completion, rescheduling)
router.get('/sessions/:id', FitnessController.getSessionDetails);
router.post('/sessions', FitnessController.createSession);
router.put('/sessions/:id', FitnessController.updateSession);
router.delete('/sessions/:id', FitnessController.deleteSession);
router.post('/sessions/:id/complete', FitnessController.completeSession);
router.post('/sessions/:id/reschedule', FitnessController.rescheduleSession);

// Body Metrics & Weigh-Ins
router.get('/body-metrics', FitnessController.getBodyMetrics);
router.post('/body-metrics', FitnessController.logBodyMetric);

// NEAT Activity Logging
router.post('/neat', FitnessController.logNeat);

// Energy & Calorie Engine
router.get('/energy/calibration/trend', FitnessController.getTdeeCalibration);
router.get('/energy/:date', FitnessController.getDailyEnergy);

// Personal Records
router.get('/personal-records', FitnessController.getPersonalRecords);

module.exports = router;
