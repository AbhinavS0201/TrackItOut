// backend/src/services/fitnessCalculator.js
/**
 * Fitness Calculator Service
 * Implements Epley 1RM estimation, volume load tracking, pace calculations,
 * and deterministic Personal Record (PR) recalculation.
 */

/**
 * Calculates Estimated One-Rep Maximum (Epley formula)
 * Formula: 1RM = weight * (1 + reps / 30)
 *
 * @param {number} weightKg - Lifted weight in kilograms
 * @param {number} reps - Repetitions performed
 * @returns {object} { estimated1rm, isReliable, flag }
 */
function calculateEpley1RM(weightKg, reps) {
  const w = parseFloat(weightKg);
  const r = parseInt(reps, 10);

  if (isNaN(w) || isNaN(r) || w <= 0 || r <= 0) {
    return { estimated1rm: null, isReliable: false, flag: 'INVALID_INPUT' };
  }

  if (r === 1) {
    return {
      estimated1rm: parseFloat(w.toFixed(2)),
      isReliable: true,
      flag: 'ACTUAL_SINGLE_REP'
    };
  }

  // Epley formula: 1RM = w * (1 + r / 30)
  const e1rm = w * (1 + r / 30.0);
  const isReliable = r <= 10;
  const flag = r > 12 ? 'HIGH_REP_ESTIMATE_UNCERTAIN' : (r > 10 ? 'MODERATE_REP_ESTIMATE' : 'RELIABLE_ESTIMATE');

  return {
    estimated1rm: parseFloat(e1rm.toFixed(2)),
    isReliable,
    flag
  };
}

/**
 * Calculates volume load for a resistance set
 * Strictly separates barbell/dumbbell external load from bodyweight repetitions.
 *
 * @param {number|null} weightKg - External weight (e.g. barbell, dumbbell, machine plate)
 * @param {number|null} reps - Repetitions performed
 * @param {number|null} addedWeightKg - Added weight for bodyweight movements (e.g. dip belt)
 * @param {boolean} isBodyweight - Whether exercise is classified as bodyweight
 * @returns {object} { externalVolumeKg, bodyweightReps, addedWeightVolumeKg }
 */
function calculateSetVolume(weightKg, reps, addedWeightKg = 0, isBodyweight = false) {
  const r = parseInt(reps, 10) || 0;
  const w = parseFloat(weightKg) || 0;
  const added = parseFloat(addedWeightKg) || 0;

  if (isBodyweight) {
    return {
      externalVolumeKg: 0,
      bodyweightReps: r,
      addedWeightVolumeKg: parseFloat((added * r).toFixed(2))
    };
  }

  return {
    externalVolumeKg: parseFloat((w * r).toFixed(2)),
    bodyweightReps: 0,
    addedWeightVolumeKg: 0
  };
}

/**
 * Calculates cardio pace in minutes per kilometer
 *
 * @param {number} durationSeconds - Duration in seconds
 * @param {number} distanceMeters - Distance in meters
 * @returns {number|null} Pace in min/km or null if distance is zero/invalid
 */
function calculateCardioPace(durationSeconds, distanceMeters) {
  const sec = parseFloat(durationSeconds);
  const dist = parseFloat(distanceMeters);

  if (isNaN(sec) || isNaN(dist) || dist <= 0 || sec <= 0) {
    return null;
  }

  const durationMin = sec / 60.0;
  const distanceKm = dist / 1000.0;
  const pace = durationMin / distanceKm;

  return parseFloat(pace.toFixed(2));
}

/**
 * Deterministically recalculates Personal Records for an exercise and user.
 * Deleting or editing a set will recalculate from remaining sets so stale PRs are never left.
 *
 * @param {object} connection - MySQL connection or pool
 * @param {number} userId - Requesting user ID
 * @param {number} exerciseId - Target exercise ID
 */
async function recalculateExercisePRs(connection, userId, exerciseId) {
  // 1. Fetch all completed sets for this user and exercise
  const [sets] = await connection.query(`
    SELECT
      s.id, s.set_type, s.weight_kg, s.reps, s.duration_seconds,
      s.distance_meters, s.pace_min_per_km, s.calculated_1rm,
      s.is_confirmed_1rm, ws.actual_date, ws.planned_date
    FROM workout_sets s
    JOIN workout_sessions ws ON s.workout_session_id = ws.id
    WHERE ws.user_id = ? AND s.exercise_id = ? AND ws.status = 'completed'
    ORDER BY s.id ASC
  `, [userId, exerciseId]);

  // Target records to track
  let bestActual1rm = null;
  let bestEstimated1rm = null;
  let bestMaxWeight = null;
  let bestMaxVolume = null;
  let bestDuration = null;
  let bestDistance = null;
  let bestPace = null;

  for (const s of sets) {
    const setDate = s.actual_date || s.planned_date;
    const w = s.weight_kg !== null ? parseFloat(s.weight_kg) : null;
    const r = s.reps !== null ? parseInt(s.reps, 10) : null;
    const dur = s.duration_seconds !== null ? parseInt(s.duration_seconds, 10) : null;
    const dist = s.distance_meters !== null ? parseFloat(s.distance_meters) : null;
    const pace = s.pace_min_per_km !== null ? parseFloat(s.pace_min_per_km) : null;

    // Actual 1RM (must be single rep AND explicitly marked as confirmed 1RM)
    if (r === 1 && s.is_confirmed_1rm === 1 && w !== null) {
      if (!bestActual1rm || w > bestActual1rm.numeric_value) {
        bestActual1rm = { numeric_value: w, reps: 1, set_id: s.id, achieved_date: setDate };
      }
    }

    // Estimated 1RM (Epley formula from any valid working set)
    if (w !== null && r !== null && r >= 1 && r <= 15) {
      const epley = calculateEpley1RM(w, r);
      if (epley.estimated1rm !== null) {
        if (!bestEstimated1rm || epley.estimated1rm > bestEstimated1rm.numeric_value) {
          bestEstimated1rm = { numeric_value: epley.estimated1rm, reps: r, set_id: s.id, achieved_date: setDate };
        }
      }
    }

    // Max Weight Lifted (regardless of reps)
    if (w !== null && w > 0 && r !== null && r >= 1) {
      if (!bestMaxWeight || w > bestMaxWeight.numeric_value) {
        bestMaxWeight = { numeric_value: w, reps: r, set_id: s.id, achieved_date: setDate };
      }
    }

    // Max Single-Set Volume (weight * reps)
    if (w !== null && w > 0 && r !== null && r >= 1) {
      const vol = parseFloat((w * r).toFixed(2));
      if (!bestMaxVolume || vol > bestMaxVolume.numeric_value) {
        bestMaxVolume = { numeric_value: vol, reps: r, set_id: s.id, achieved_date: setDate };
      }
    }

    // Longest Duration (isometric holds or cardio)
    if (dur !== null && dur > 0) {
      if (!bestDuration || dur > bestDuration.numeric_value) {
        bestDuration = { numeric_value: dur, reps: null, set_id: s.id, achieved_date: setDate };
      }
    }

    // Longest Distance (cardio)
    if (dist !== null && dist > 0) {
      if (!bestDistance || dist > bestDistance.numeric_value) {
        bestDistance = { numeric_value: dist, reps: null, set_id: s.id, achieved_date: setDate };
      }
    }

    // Fastest Pace (cardio, lower is faster)
    if (pace !== null && pace > 0) {
      if (!bestPace || pace < bestPace.numeric_value) {
        bestPace = { numeric_value: pace, reps: null, set_id: s.id, achieved_date: setDate };
      }
    }
  }

  // Define records array
  const prMap = [
    { type: 'actual_1rm', data: bestActual1rm },
    { type: 'estimated_1rm', data: bestEstimated1rm },
    { type: 'max_weight', data: bestMaxWeight },
    { type: 'max_volume', data: bestMaxVolume },
    { type: 'longest_duration', data: bestDuration },
    { type: 'longest_distance', data: bestDistance },
    { type: 'fastest_pace', data: bestPace }
  ];

  for (const record of prMap) {
    if (record.data) {
      // Upsert record
      await connection.query(`
        INSERT INTO personal_records (
          user_id, exercise_id, record_type, numeric_value, reps_performed, workout_set_id, achieved_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          numeric_value = VALUES(numeric_value),
          reps_performed = VALUES(reps_performed),
          workout_set_id = VALUES(workout_set_id),
          achieved_date = VALUES(achieved_date),
          updated_at = CURRENT_TIMESTAMP
      `, [
        userId, exerciseId, record.type,
        record.data.numeric_value, record.data.reps, record.data.set_id, record.data.achieved_date
      ]);
    } else {
      // If no qualifying set exists, clean up potential stale PR
      await connection.query(`
        DELETE FROM personal_records
        WHERE user_id = ? AND exercise_id = ? AND record_type = ?
      `, [userId, exerciseId, record.type]);
    }
  }
}

module.exports = {
  calculateEpley1RM,
  calculateSetVolume,
  calculateCardioPace,
  recalculateExercisePRs
};
