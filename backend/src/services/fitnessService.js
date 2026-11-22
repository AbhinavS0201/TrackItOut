// backend/src/services/fitnessService.js
/**
 * Fitness & Workout Management Service Layer
 * Enforces strict multi-tenant user isolation, transaction safety,
 * deterministic PR recalculation, and flexible A/B/C/D rotation scheduling.
 */

const pool = require('../config/db');
const {
  calculateEpley1RM,
  calculateSetVolume,
  calculateCardioPace,
  recalculateExercisePRs
} = require('./fitnessCalculator');

const {
  calculateRestingEnergy,
  calculateACSMWalkingStage,
  calculateTreadmillProtocol,
  calculateResistanceSessionEnergy,
  calculateNeatEnergy,
  calculateTEF,
  synthesizeTDEE,
  calibrateTDEETrend
} = require('./energyCalculator');

class FitnessService {
  /**
   * Get Fitness Overview Dashboard data for authenticated user
   */
  static async getOverview(userId, dateStr) {
    const targetDate = dateStr || new Date().toISOString().substring(0, 10);
    const conn = await pool.getConnection();

    try {
      // 1. Rotation State & Queued Split
      const [rotationRows] = await conn.query(`
        SELECT urs.*, wt.id as template_id, wt.name as template_name, wt.description as template_description
        FROM user_rotation_states urs
        LEFT JOIN workout_templates wt ON wt.user_id = urs.user_id AND wt.routine_code = urs.current_position
        WHERE urs.user_id = ?
      `, [userId]);

      const rotation = rotationRows.length > 0 ? rotationRows[0] : null;

      // 2. Today's Sessions (Planned or Completed)
      const [sessions] = await conn.query(`
        SELECT ws.*, wt.name as template_name
        FROM workout_sessions ws
        LEFT JOIN workout_templates wt ON ws.template_id = wt.id
        WHERE ws.user_id = ? AND (ws.planned_date = ? OR ws.actual_date = ?)
        ORDER BY ws.id ASC
      `, [userId, targetDate, targetDate]);

      // 3. Latest Body Weight
      const [weightRows] = await conn.query(`
        SELECT weight_kg, recorded_date
        FROM body_metrics
        WHERE user_id = ? AND recorded_date <= ?
        ORDER BY recorded_date DESC, id DESC
        LIMIT 1
      `, [userId, targetDate]);
      const latestWeight = weightRows.length > 0 ? parseFloat(weightRows[0].weight_kg) : null;

      // 4. Daily Energy Summary
      let energySummary = null;
      try {
        energySummary = await this.getDailyEnergy(userId, targetDate, conn);
      } catch (e) {
        console.warn('Energy summary calculation deferred:', e.message);
      }

      // 5. Recent PRs (Last 5)
      const [recentPRs] = await conn.query(`
        SELECT pr.*, e.name as exercise_name, e.primary_muscle, e.equipment
        FROM personal_records pr
        JOIN exercises e ON pr.exercise_id = e.id
        WHERE pr.user_id = ?
        ORDER BY pr.achieved_date DESC, pr.id DESC
        LIMIT 5
      `, [userId]);

      return {
        date: targetDate,
        rotation,
        sessions,
        latestWeightKg: latestWeight,
        energySummary,
        recentPRs
      };
    } finally {
      conn.release();
    }
  }

  /**
   * Get User Rotation State
   */
  static async getRotationState(userId) {
    const [rows] = await pool.query(`
      SELECT urs.*, wt.id as current_template_id, wt.name as current_template_name
      FROM user_rotation_states urs
      LEFT JOIN workout_templates wt ON wt.user_id = urs.user_id AND wt.routine_code = urs.current_position
      WHERE urs.user_id = ?
    `, [userId]);

    if (rows.length === 0) {
      return null;
    }
    return rows[0];
  }

  /**
   * Search / List Exercises (Global catalog + User custom exercises)
   */
  static async getExercises(userId, filters = {}) {
    const { q, muscle, type, equipment } = filters;
    let query = `
      SELECT
        e.*,
        alt.name as alternative_exercise_name
      FROM exercises e
      LEFT JOIN exercises alt ON e.default_alternative_id = alt.id
      WHERE (e.user_id IS NULL OR e.user_id = ?)
    `;
    const params = [userId];

    if (q) {
      query += ` AND e.name LIKE ?`;
      params.push(`%${q}%`);
    }
    if (muscle) {
      query += ` AND e.primary_muscle = ?`;
      params.push(muscle);
    }
    if (type) {
      query += ` AND e.exercise_type = ?`;
      params.push(type);
    }
    if (equipment) {
      query += ` AND e.equipment = ?`;
      params.push(equipment);
    }

    query += ` ORDER BY (e.user_id IS NOT NULL) DESC, e.primary_muscle, e.name`;

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Create Custom Exercise (User Owned)
   */
  static async createCustomExercise(userId, exerciseData) {
    const {
      name, exercise_type, movement_pattern, equipment,
      primary_muscle, secondary_muscles, instructions, default_alternative_id
    } = exerciseData;

    if (!name || !name.trim()) {
      throw new Error('Exercise name is required');
    }
    if (!exercise_type || !primary_muscle) {
      throw new Error('Exercise type and primary muscle group are required');
    }

    // Check duplicate name for this user (case-insensitive)
    const [existing] = await pool.query(`
      SELECT id FROM exercises
      WHERE (user_id IS NULL OR user_id = ?) AND LOWER(name) = LOWER(?)
    `, [userId, name.trim()]);

    if (existing.length > 0) {
      throw new Error(`An exercise with the name "${name.trim()}" already exists`);
    }

    // Assign appropriate default MET benchmark from 2024 Adult Compendium
    let defaultMet = 3.50;
    let metSource = '2024 Adult Compendium Code 02054 (Multiple resistance exercises, 8-15 reps: 3.5 MET)';

    if (movement_pattern === 'compound' && (equipment === 'barbell' || equipment === 'dumbbell')) {
      defaultMet = 6.00;
      metSource = '2024 Adult Compendium Code 02050 (Vigorous resistance training, powerlifting or bodybuilding: 6.0 MET)';
    }

    const [result] = await pool.query(`
      INSERT INTO exercises (
        user_id, name, exercise_type, movement_pattern, equipment,
        primary_muscle, secondary_muscles, default_met, met_source,
        instructions, is_custom, default_alternative_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `, [
      userId, name.trim(),
      exercise_type || 'strength',
      movement_pattern || 'isolation',
      equipment || 'dumbbell',
      primary_muscle,
      secondary_muscles || null,
      defaultMet,
      metSource,
      instructions || null,
      default_alternative_id || null
    ]);

    return { id: result.insertId, name: name.trim() };
  }

  /**
   * List Workout Templates available to User (User's custom + Global templates)
   */
  static async getWorkoutTemplates(userId) {
    const [rows] = await pool.query(`
      SELECT wt.*,
        (SELECT COUNT(*) FROM workout_template_exercises wte WHERE wte.template_id = wt.id) as exercise_count
      FROM workout_templates wt
      WHERE wt.user_id IS NULL OR wt.user_id = ?
      ORDER BY (wt.user_id IS NOT NULL) DESC, wt.routine_code, wt.id
    `, [userId]);
    return rows;
  }

  /**
   * Get Template Details with exercises/stages
   */
  static async getWorkoutTemplateDetails(userId, templateId) {
    const [[template]] = await pool.query(`
      SELECT * FROM workout_templates
      WHERE id = ? AND (user_id IS NULL OR user_id = ?)
    `, [templateId, userId]);

    if (!template) {
      throw new Error('AUTH_FORBIDDEN_OR_NOT_FOUND: Template not found or unauthorized');
    }

    const [exercises] = await pool.query(`
      SELECT
        wte.*,
        e.name as exercise_name,
        e.exercise_type,
        e.movement_pattern,
        e.equipment,
        e.primary_muscle,
        e.secondary_muscles,
        e.default_met,
        alt.name as alternative_exercise_name
      FROM workout_template_exercises wte
      JOIN exercises e ON wte.exercise_id = e.id
      LEFT JOIN exercises alt ON wte.alternative_exercise_id = alt.id
      WHERE wte.template_id = ?
      ORDER BY wte.exercise_order ASC
    `, [templateId]);

    return {
      ...template,
      exercises
    };
  }

  /**
   * Get Workout Session by ID (with sets)
   */
  static async getWorkoutSessionById(userId, sessionId) {
    const [[session]] = await pool.query(`
      SELECT ws.*, wt.name as template_name
      FROM workout_sessions ws
      LEFT JOIN workout_templates wt ON ws.template_id = wt.id
      WHERE ws.id = ? AND ws.user_id = ?
    `, [sessionId, userId]);

    if (!session) {
      throw new Error('AUTH_FORBIDDEN_OR_NOT_FOUND: Workout session not found or unauthorized');
    }

    const [sets] = await pool.query(`
      SELECT s.*, e.name as exercise_name, e.exercise_type, e.equipment, e.primary_muscle
      FROM workout_sets s
      JOIN exercises e ON s.exercise_id = e.id
      WHERE s.workout_session_id = ?
      ORDER BY s.set_order ASC
    `, [sessionId]);

    return { ...session, sets };
  }

  /**
   * Create Workout Session with Sets (Planned or Completed)
   */
  static async createWorkoutSession(userId, sessionData) {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      const {
        template_id, rotation_code, title, planned_date, actual_date,
        status = 'planned', is_partial = 0, advances_rotation = 1,
        duration_minutes, notes, rpe, sets = []
      } = sessionData;

      if (!title || !title.trim()) {
        throw new Error('Workout title is required');
      }
      if (!planned_date) {
        throw new Error('Planned date is required');
      }

      // If template_id provided, verify access
      if (template_id) {
        const [[tmpl]] = await conn.query(`
          SELECT id FROM workout_templates WHERE id = ? AND (user_id IS NULL OR user_id = ?)
        `, [template_id, userId]);
        if (!tmpl) {
          throw new Error('AUTH_FORBIDDEN_OR_NOT_FOUND: Template unauthorized or does not exist');
        }
      }

      // Create session
      const [sessResult] = await conn.query(`
        INSERT INTO workout_sessions (
          user_id, template_id, rotation_code, title, planned_date, actual_date,
          status, is_partial, advances_rotation, duration_minutes, notes, rpe
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId, template_id || null, rotation_code || null, title.trim(),
        planned_date, actual_date || (status === 'completed' ? planned_date : null),
        status, is_partial ? 1 : 0, advances_rotation ? 1 : 0,
        duration_minutes || null, notes || null, rpe || null
      ]);

      const sessionId = sessResult.insertId;
      const affectedExerciseIds = new Set();

      // Insert sets if provided
      if (Array.isArray(sets) && sets.length > 0) {
        await this._insertWorkoutSets(conn, userId, sessionId, sets, affectedExerciseIds);
      }

      // If completed, compute session aggregates and update PRs
      if (status === 'completed') {
        await this._finalizeCompletedSession(conn, userId, sessionId, affectedExerciseIds, advances_rotation, rotation_code);
      }

      await conn.commit();
      return { id: sessionId, title: title.trim(), status };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Update Workout Session
   */
  static async updateWorkoutSession(userId, sessionId, sessionData) {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      // 1. Verify ownership
      const [[session]] = await conn.query(`
        SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?
      `, [sessionId, userId]);

      if (!session) {
        throw new Error('AUTH_FORBIDDEN_OR_NOT_FOUND: Workout session not found or unauthorized');
      }

      const {
        title, planned_date, actual_date, status, is_partial,
        advances_rotation, duration_minutes, notes, rpe, sets
      } = sessionData;

      await conn.query(`
        UPDATE workout_sessions
        SET
          title = COALESCE(?, title),
          planned_date = COALESCE(?, planned_date),
          actual_date = COALESCE(?, actual_date),
          status = COALESCE(?, status),
          is_partial = COALESCE(?, is_partial),
          advances_rotation = COALESCE(?, advances_rotation),
          duration_minutes = COALESCE(?, duration_minutes),
          notes = COALESCE(?, notes),
          rpe = COALESCE(?, rpe),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `, [
        title || null, planned_date || null, actual_date || null, status || null,
        is_partial !== undefined ? (is_partial ? 1 : 0) : null,
        advances_rotation !== undefined ? (advances_rotation ? 1 : 0) : null,
        duration_minutes || null, notes || null, rpe || null,
        sessionId, userId
      ]);

      const affectedExerciseIds = new Set();

      // If sets are provided, replace them
      if (Array.isArray(sets)) {
        // Collect old exercise IDs to recalculate PRs
        const [oldSets] = await conn.query(`
          SELECT DISTINCT exercise_id FROM workout_sets WHERE workout_session_id = ?
        `, [sessionId]);
        oldSets.forEach(s => affectedExerciseIds.add(s.exercise_id));

        await conn.query('DELETE FROM workout_sets WHERE workout_session_id = ?', [sessionId]);
        await this._insertWorkoutSets(conn, userId, sessionId, sets, affectedExerciseIds);
      }

      const targetStatus = status || session.status;
      if (targetStatus === 'completed') {
        const advRot = advances_rotation !== undefined ? advances_rotation : session.advances_rotation;
        const rotCode = session.rotation_code;
        await this._finalizeCompletedSession(conn, userId, sessionId, affectedExerciseIds, advRot, rotCode);
      } else {
        // If changed to non-completed, recalculate PRs for previously affected exercises
        for (const exId of affectedExerciseIds) {
          await recalculateExercisePRs(conn, userId, exId);
        }
      }

      await conn.commit();
      return { id: sessionId, success: true };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Delete Workout Session (deterministic PR recalculation on delete)
   */
  static async deleteWorkoutSession(userId, sessionId) {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      const [[session]] = await conn.query(`
        SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?
      `, [sessionId, userId]);

      if (!session) {
        throw new Error('AUTH_FORBIDDEN_OR_NOT_FOUND: Workout session not found or unauthorized');
      }

      // Collect affected exercises
      const [sets] = await conn.query(`
        SELECT DISTINCT exercise_id FROM workout_sets WHERE workout_session_id = ?
      `, [sessionId]);
      const affectedExerciseIds = sets.map(s => s.exercise_id);

      // Delete session (cascade deletes sets and clears foreign keys)
      await conn.query('DELETE FROM workout_sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);

      // Recalculate PRs so stale PRs are never left behind
      for (const exId of affectedExerciseIds) {
        await recalculateExercisePRs(conn, userId, exId);
      }

      await conn.commit();
      return { success: true, deletedSessionId: sessionId };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Complete Workout Session & Advance Rotation (if eligible)
   */
  static async completeWorkoutSession(userId, sessionId, completionData = {}) {
    const { actual_date, duration_minutes, rpe, notes, sets } = completionData;
    return await this.updateWorkoutSession(userId, sessionId, {
      actual_date: actual_date || new Date().toISOString().substring(0, 10),
      duration_minutes,
      rpe,
      notes,
      status: 'completed',
      sets
    });
  }

  /**
   * Reschedule Workout Session to a new date
   */
  static async rescheduleWorkoutSession(userId, sessionId, newDate) {
    if (!newDate) throw new Error('New date is required for rescheduling');
    return await this.updateWorkoutSession(userId, sessionId, {
      planned_date: newDate
    });
  }

  /**
   * Log Body Metric (Weigh-in)
   */
  static async logBodyMetric(userId, metricData) {
    const { recorded_date, weight_kg, body_fat_pct, muscle_mass_kg, notes } = metricData;

    if (!recorded_date || !weight_kg) {
      throw new Error('Recorded date and weight (kg) are required');
    }

    const w = parseFloat(weight_kg);
    if (isNaN(w) || w <= 20 || w >= 300) {
      throw new Error('Weight must be a valid positive measurement (20-300 kg)');
    }

    await pool.query(`
      INSERT INTO body_metrics (user_id, recorded_date, weight_kg, body_fat_pct, muscle_mass_kg, notes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        weight_kg = VALUES(weight_kg),
        body_fat_pct = VALUES(body_fat_pct),
        muscle_mass_kg = VALUES(muscle_mass_kg),
        notes = VALUES(notes),
        updated_at = CURRENT_TIMESTAMP
    `, [
      userId, recorded_date, w,
      body_fat_pct ? parseFloat(body_fat_pct) : null,
      muscle_mass_kg ? parseFloat(muscle_mass_kg) : null,
      notes || null
    ]);

    return { recorded_date, weight_kg: w };
  }

  /**
   * Get Body Metrics History
   */
  static async getBodyMetrics(userId, days = 30) {
    const [rows] = await pool.query(`
      SELECT * FROM body_metrics
      WHERE user_id = ?
      ORDER BY recorded_date DESC
      LIMIT ?
    `, [userId, parseInt(days, 10) || 30]);
    return rows;
  }

  /**
   * Log NEAT Activity
   */
  static async logNeatActivity(userId, activityData) {
    const { activity_date, activity_type, activity_name, met_value, duration_minutes, notes } = activityData;

    if (!activity_date || !activity_name || !met_value || !duration_minutes) {
      throw new Error('Activity date, name, MET value, and duration are required');
    }

    // Fetch user latest weight
    const [wRows] = await pool.query(`
      SELECT weight_kg FROM body_metrics WHERE user_id = ? ORDER BY recorded_date DESC LIMIT 1
    `, [userId]);
    const weightKg = wRows.length > 0 ? parseFloat(wRows[0].weight_kg) : 75.0; // fallback default weight if not yet weighed

    const energy = calculateNeatEnergy(met_value, duration_minutes, weightKg);

    const [result] = await pool.query(`
      INSERT INTO neat_activity_logs (
        user_id, activity_date, activity_type, activity_name, met_value,
        duration_minutes, user_weight_kg, net_active_kcal, gross_kcal, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId, activity_date, activity_type || 'custom', activity_name,
      parseFloat(met_value), parseInt(duration_minutes, 10), weightKg,
      energy.netActiveKcal, energy.grossKcal, notes || null
    ]);

    return { id: result.insertId, ...energy };
  }

  /**
   * Calculate and Synthesize Daily Energy Log
   */
  static async getDailyEnergy(userId, dateStr, externalConn = null) {
    const conn = externalConn || await pool.getConnection();
    const shouldRelease = !externalConn;

    try {
      // 1. Fetch user biometrics
      const [[biometrics]] = await conn.query(`
        SELECT * FROM user_biometrics WHERE user_id = ?
      `, [userId]);

      // 2. Fetch latest body weight on or before date
      const [wRows] = await conn.query(`
        SELECT weight_kg FROM body_metrics
        WHERE user_id = ? AND recorded_date <= ?
        ORDER BY recorded_date DESC, id DESC LIMIT 1
      `, [userId, dateStr]);
      const currentWeight = wRows.length > 0 ? parseFloat(wRows[0].weight_kg) : null;

      // 3. Calculate Resting Energy Expenditure
      let reeKcal = 0;
      let bmrMethod = 'mifflin_st_jeor';
      let provenance = 'Estimated';

      if (currentWeight && biometrics) {
        const birthDate = biometrics.birth_date ? new Date(biometrics.birth_date) : null;
        let ageYears = 30; // default if birth_date missing
        if (birthDate) {
          const diffMs = new Date(dateStr) - birthDate;
          ageYears = Math.floor(diffMs / (365.25 * 86400000));
        }

        const reeRes = calculateRestingEnergy({
          weightKg: currentWeight,
          heightCm: biometrics.height_cm,
          ageYears,
          biologicalSex: biometrics.biologicalSex || biometrics.biological_sex,
          isMeasuredRmr: biometrics.is_measured_rmr,
          measuredRmrKcal: biometrics.measured_rmr_kcal
        });

        reeKcal = reeRes.reeKcal || 0;
        bmrMethod = reeRes.method;
        provenance = reeRes.description;
      }

      // 4. Calculate Net Active Resistance Gym Energy on date
      const [gymSessions] = await conn.query(`
        SELECT duration_minutes, session_avg_met, session_net_active_kcal
        FROM workout_sessions
        WHERE user_id = ? AND actual_date = ? AND status = 'completed'
      `, [userId, dateStr]);

      let gymActiveKcal = 0;
      for (const sess of gymSessions) {
        gymActiveKcal += parseFloat(sess.session_net_active_kcal) || 0;
      }

      // 5. Calculate Net Active Walking / Cardio Energy on date
      const [cardioSets] = await conn.query(`
        SELECT s.net_active_kcal
        FROM workout_sets s
        JOIN workout_sessions ws ON s.workout_session_id = ws.id
        WHERE ws.user_id = ? AND ws.actual_date = ? AND ws.status = 'completed'
          AND s.net_active_kcal IS NOT NULL
      `, [userId, dateStr]);

      let walkingActiveKcal = 0;
      for (const cSet of cardioSets) {
        walkingActiveKcal += parseFloat(cSet.net_active_kcal) || 0;
      }

      // 6. Calculate Net Active NEAT Energy on date
      const [neatLogs] = await conn.query(`
        SELECT net_active_kcal FROM neat_activity_logs
        WHERE user_id = ? AND activity_date = ?
      `, [userId, dateStr]);

      let neatActiveKcal = 0;
      for (const nl of neatLogs) {
        neatActiveKcal += parseFloat(nl.net_active_kcal) || 0;
      }

      // 7. Calculate TEF from logged nutrition in Phase 4 meal tables
      const [meals] = await conn.query(`
        SELECT
          SUM(mfi.protein) as total_protein,
          SUM(mfi.carbohydrates) as total_carbs,
          SUM(mfi.fats) as total_fat,
          SUM(mfi.calories) as total_kcal
        FROM meal_food_items mfi
        JOIN nutrition_logs nl ON mfi.meal_log_id = nl.id
        WHERE nl.user_id = ? AND nl.date = ?
      `, [userId, dateStr]);

      const macros = meals[0] || {};
      const hasMealData = macros.total_kcal !== null && macros.total_kcal !== undefined;
      const tefResult = calculateTEF({
        proteinGrams: hasMealData ? macros.total_protein : null,
        carbsGrams: hasMealData ? macros.total_carbs : null,
        fatGrams: hasMealData ? macros.total_fat : null
      });

      const totalConsumedKcal = parseFloat(macros.total_kcal) || 0;

      // 8. Synthesize TDEE
      const totalEstimatedTdee = synthesizeTDEE({
        reeKcal,
        walkingActiveKcal,
        gymActiveKcal,
        neatActiveKcal,
        tefKcal: tefResult.tefEstimatedKcal
      });

      const energyBalance = totalConsumedKcal - totalEstimatedTdee;

      // Upsert into daily_energy_logs
      if (currentWeight) {
        await conn.query(`
          INSERT INTO daily_energy_logs (
            user_id, log_date, user_weight_kg, bmr_estimated_kcal, bmr_method,
            walking_active_kcal, gym_active_kcal, neat_active_kcal,
            tef_estimated_kcal, tef_min_kcal, tef_max_kcal, tef_is_complete,
            total_estimated_tdee_kcal, total_consumed_kcal, energy_balance_kcal,
            calculation_provenance, confidence_interval_pct
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 8.00)
          ON DUPLICATE KEY UPDATE
            user_weight_kg = VALUES(user_weight_kg),
            bmr_estimated_kcal = VALUES(bmr_estimated_kcal),
            bmr_method = VALUES(bmr_method),
            walking_active_kcal = VALUES(walking_active_kcal),
            gym_active_kcal = VALUES(gym_active_kcal),
            neat_active_kcal = VALUES(neat_active_kcal),
            tef_estimated_kcal = VALUES(tef_estimated_kcal),
            tef_min_kcal = VALUES(tef_min_kcal),
            tef_max_kcal = VALUES(tef_max_kcal),
            tef_is_complete = VALUES(tef_is_complete),
            total_estimated_tdee_kcal = VALUES(total_estimated_tdee_kcal),
            total_consumed_kcal = VALUES(total_consumed_kcal),
            energy_balance_kcal = VALUES(energy_balance_kcal),
            calculation_provenance = VALUES(calculation_provenance),
            updated_at = CURRENT_TIMESTAMP
        `, [
          userId, dateStr, currentWeight, reeKcal, bmrMethod,
          walkingActiveKcal, gymActiveKcal, neatActiveKcal,
          tefResult.tefEstimatedKcal !== null ? tefResult.tefEstimatedKcal : 0.00,
          tefResult.tefMinKcal !== null ? tefResult.tefMinKcal : 0.00,
          tefResult.tefMaxKcal !== null ? tefResult.tefMaxKcal : 0.00,
          tefResult.isComplete ? 1 : 0,
          totalEstimatedTdee, totalConsumedKcal, energyBalance, provenance
        ]);
      }

      return {
        date: dateStr,
        userWeightKg: currentWeight,
        reeKcal,
        bmrMethod,
        walkingActiveKcal,
        gymActiveKcal,
        neatActiveKcal,
        tefEstimatedKcal: tefResult.tefEstimatedKcal,
        tefMinKcal: tefResult.tefMinKcal,
        tefMaxKcal: tefResult.tefMaxKcal,
        tefIsComplete: tefResult.isComplete,
        tefStatus: tefResult.status,
        tefRanges: tefResult.ranges || null,
        tefDisclosure: tefResult.disclosure || null,
        totalEstimatedTdeeKcal: totalEstimatedTdee,
        totalConsumedKcal,
        energyBalanceKcal: energyBalance,
        calculationProvenance: provenance
      };
    } finally {
      if (shouldRelease) conn.release();
    }
  }

  /**
   * Run 14–21 Day OLS Trend Calibration for User
   */
  static async getCalibratedTdee(userId, options = {}) {
    const { windowDays = 21 } = options;

    // Fetch weigh-ins within window
    const [weighIns] = await pool.query(`
      SELECT recorded_date, weight_kg
      FROM body_metrics
      WHERE user_id = ?
      ORDER BY recorded_date ASC
    `, [userId]);

    // Fetch nutrition logs within window
    const [nutritionLogs] = await pool.query(`
      SELECT nl.date as log_date, SUM(mfi.calories) as total_consumed_kcal
      FROM nutrition_logs nl
      JOIN meal_food_items mfi ON mfi.meal_log_id = nl.id
      WHERE nl.user_id = ?
      GROUP BY nl.date
      HAVING total_consumed_kcal > 0
      ORDER BY nl.date ASC
    `, [userId]);

    const result = calibrateTDEETrend(weighIns, nutritionLogs, {
      minWindowDays: 14,
      minWeighInCount: 6,
      minNutritionCompletenessPct: 80.0
    });

    return result;
  }

  /**
   * Get Personal Records for user
   */
  static async getPersonalRecords(userId, exerciseId = null) {
    let query = `
      SELECT pr.*, e.name as exercise_name, e.primary_muscle, e.equipment, e.exercise_type
      FROM personal_records pr
      JOIN exercises e ON pr.exercise_id = e.id
      WHERE pr.user_id = ?
    `;
    const params = [userId];

    if (exerciseId) {
      query += ` AND pr.exercise_id = ?`;
      params.push(exerciseId);
    }

    query += ` ORDER BY e.primary_muscle, e.name, pr.record_type`;
    const [rows] = await pool.query(query, params);
    return rows;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Validate and insert workout sets
   */
  static async _insertWorkoutSets(conn, userId, sessionId, sets, affectedExerciseIds) {
    for (let i = 0; i < sets.length; i++) {
      const s = sets[i];
      if (!s.exercise_id) {
        throw new Error(`Set #${i + 1} is missing exercise_id`);
      }

      // Check exercise ownership
      const [[ex]] = await conn.query(`
        SELECT id, exercise_type, movement_pattern, equipment FROM exercises
        WHERE id = ? AND (user_id IS NULL OR user_id = ?)
      `, [s.exercise_id, userId]);

      if (!ex) {
        throw new Error(`AUTH_FORBIDDEN_EXERCISE: Set references an exercise that does not exist or belongs to another user`);
      }

      affectedExerciseIds.add(ex.id);

      const isBodyweight = ex.equipment === 'bodyweight';
      const weight = s.weight_kg !== undefined ? (s.weight_kg !== null ? parseFloat(s.weight_kg) : null) : null;
      const reps = s.reps !== undefined ? (s.reps !== null ? parseInt(s.reps, 10) : null) : null;
      const addedWeight = s.added_weight_kg !== undefined ? (s.added_weight_kg !== null ? parseFloat(s.added_weight_kg) : null) : null;
      const duration = s.duration_seconds !== undefined ? (s.duration_seconds !== null ? parseInt(s.duration_seconds, 10) : null) : null;
      const incline = s.incline_pct !== undefined ? (s.incline_pct !== null ? parseFloat(s.incline_pct) : null) : null;
      const speed = s.speed_kmh !== undefined ? (s.speed_kmh !== null ? parseFloat(s.speed_kmh) : null) : null;
      const distance = s.distance_meters !== undefined ? (s.distance_meters !== null ? parseFloat(s.distance_meters) : null) : null;

      // Epley 1RM
      let calc1rm = null;
      if (weight !== null && reps !== null && reps >= 1) {
        const epley = calculateEpley1RM(weight, reps);
        calc1rm = epley.estimated1rm;
      }

      // Pace
      let pace = null;
      if (duration && distance) {
        pace = calculateCardioPace(duration, distance);
      }

      // Cardio ACSM energy calculation if applicable
      let netActiveKcal = null;
      let grossKcal = null;
      let acsmValid = 1;

      if (ex.exercise_type === 'cardio' && speed && duration) {
        // Fetch latest weight
        const [wRows] = await conn.query(`
          SELECT weight_kg FROM body_metrics WHERE user_id = ? ORDER BY recorded_date DESC LIMIT 1
        `, [userId]);
        const wKg = wRows.length > 0 ? parseFloat(wRows[0].weight_kg) : 75.0;

        const acsm = calculateACSMWalkingStage({
          speedKmh: speed,
          inclinePct: incline || 0,
          durationSeconds: duration,
          weightKg: wKg
        });

        netActiveKcal = acsm.netActiveKcal;
        grossKcal = acsm.grossKcal;
        acsmValid = acsm.isValidRange ? 1 : 0;
      }

      await conn.query(`
        INSERT INTO workout_sets (
          workout_session_id, exercise_id, set_order, superset_group, set_type,
          weight_kg, reps, added_weight_kg, duration_seconds, incline_pct,
          speed_kmh, distance_meters, pace_min_per_km, set_met, net_active_kcal,
          gross_kcal, acsm_valid_range, calculated_1rm, is_confirmed_1rm, rpe, rest_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sessionId, ex.id, i + 1, s.superset_group || null, s.set_type || 'normal',
        weight, reps, addedWeight, duration, incline,
        speed, distance, pace, s.set_met || null, netActiveKcal,
        grossKcal, acsmValid, calc1rm, s.is_confirmed_1rm ? 1 : 0,
        s.rpe || null, s.rest_seconds || null
      ]);
    }
  }

  /**
   * Finalize Completed Session aggregates, PRs, and Rotation advancement
   */
  static async _finalizeCompletedSession(conn, userId, sessionId, affectedExerciseIds, advancesRotation, rotationCode) {
    // 1. Compute totals from sets
    const [sets] = await conn.query(`
      SELECT
        s.*, e.equipment, e.exercise_type
      FROM workout_sets s
      JOIN exercises e ON s.exercise_id = e.id
      WHERE s.workout_session_id = ?
    `, [sessionId]);

    let totalStrengthVol = 0;
    let totalBodyweightReps = 0;
    let totalCardioSec = 0;
    let totalCardioDist = 0;

    for (const s of sets) {
      if (s.exercise_type === 'strength') {
        const vol = calculateSetVolume(s.weight_kg, s.reps, s.added_weight_kg, s.equipment === 'bodyweight');
        totalStrengthVol += vol.externalVolumeKg;
        totalBodyweightReps += vol.bodyweightReps;
      } else if (s.exercise_type === 'cardio') {
        totalCardioSec += (s.duration_seconds || 0);
        totalCardioDist += (parseFloat(s.distance_meters) || 0);
      }
    }

    // 2. Compute session-level resistance calories
    const [[sessionData]] = await conn.query(`
      SELECT duration_minutes, session_avg_met FROM workout_sessions WHERE id = ?
    `, [sessionId]);

    const [wRows] = await conn.query(`
      SELECT weight_kg FROM body_metrics WHERE user_id = ? ORDER BY recorded_date DESC LIMIT 1
    `, [userId]);
    const weightKg = wRows.length > 0 ? parseFloat(wRows[0].weight_kg) : 75.0;

    const resEnergy = calculateResistanceSessionEnergy({
      sessionAvgMet: sessionData.session_avg_met,
      durationMinutes: sessionData.duration_minutes || 45,
      weightKg
    });

    await conn.query(`
      UPDATE workout_sessions
      SET
        total_strength_volume_kg = ?,
        total_bodyweight_reps = ?,
        total_cardio_duration_sec = ?,
        total_cardio_distance_m = ?,
        session_net_active_kcal = ?
      WHERE id = ?
    `, [
      totalStrengthVol, totalBodyweightReps, totalCardioSec, totalCardioDist,
      resEnergy.netActiveKcal, sessionId
    ]);

    // 3. Recalculate PRs for all affected exercises
    for (const exId of affectedExerciseIds) {
      await recalculateExercisePRs(conn, userId, exId);
    }

    // 4. Flexible Rotation Advancement Check
    // Advances ONLY IF advances_rotation == 1 AND session matches current rotation position!
    if (advancesRotation && rotationCode) {
      const [rotRows] = await conn.query(`
        SELECT current_position, rotation_sequence
        FROM user_rotation_states
        WHERE user_id = ? FOR UPDATE
      `, [userId]);

      if (rotRows.length > 0) {
        const currentPos = rotRows[0].current_position;
        let seq = rotRows[0].rotation_sequence;
        if (typeof seq === 'string') {
          try { seq = JSON.parse(seq); } catch (e) { seq = ['A', 'B', 'C', 'D']; }
        }

        // Only advance if completed workout code matches the current queue head!
        if (currentPos === rotationCode) {
          const currentIndex = seq.indexOf(currentPos);
          const nextIndex = (currentIndex + 1) % seq.length;
          const nextPos = seq[nextIndex];

          await conn.query(`
            UPDATE user_rotation_states
            SET current_position = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
          `, [nextPos, userId]);
        }
      }
    }
  }
}

module.exports = FitnessService;
