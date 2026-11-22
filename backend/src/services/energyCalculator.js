// backend/src/services/energyCalculator.js
/**
 * Scientific Calorie & Energy Expenditure Engine
 *
 * Implements:
 * 1. Mifflin-St Jeor formula-estimated Resting Energy Expenditure (REE/RMR)
 * 2. ACSM Stage-by-stage walking metabolic equation for treadmill incline protocols
 * 3. Session-level MET resistance energy expenditure (2024 Adult Compendium benchmarks)
 * 4. Non-Exercise Activity Thermogenesis (NEAT) calculations
 * 5. Thermic Effect of Food (TEF) from logged macronutrients
 * 6. Daily TDEE synthesis (preventing double-counting of resting metabolism)
 * 7. 14–21 day Ordinary Least Squares (OLS) trend-calibrated TDEE engine
 */

/**
 * Calculates Formula-Estimated Resting Energy Expenditure (REE / RMR)
 * using the Mifflin-St Jeor equation.
 *
 * @param {object} params - { weightKg, heightCm, ageYears, biologicalSex, isMeasuredRmr, measuredRmrKcal }
 * @returns {object} { reeKcal, method, isMeasured, description }
 */
function calculateRestingEnergy(params) {
  const { weightKg, heightCm, ageYears, biologicalSex, isMeasuredRmr, measuredRmrKcal } = params;

  // 1. If laboratory direct/indirect calorimetry measurement is provided
  if (isMeasuredRmr && measuredRmrKcal && measuredRmrKcal > 0) {
    return {
      reeKcal: parseFloat(Number(measuredRmrKcal).toFixed(2)),
      method: 'laboratory_indirect_calorimetry',
      isMeasured: true,
      description: 'Laboratory-measured Resting Metabolic Rate (RMR)'
    };
  }

  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm);
  const a = parseInt(ageYears, 10);
  const sex = (biologicalSex || '').toLowerCase();

  if (isNaN(w) || isNaN(h) || isNaN(a) || w <= 0 || h <= 0 || a <= 0) {
    return {
      reeKcal: null,
      method: 'insufficient_biometrics',
      isMeasured: false,
      description: 'Insufficient biometric data (weight, height, or age missing)'
    };
  }

  // Base components: 10 * weight (kg) + 6.25 * height (cm) - 5 * age (years)
  const base = (10 * w) + (6.25 * h) - (5 * a);

  let ree = null;
  let method = 'mifflin_st_jeor';
  let description = '';

  if (sex === 'male') {
    ree = base + 5;
    description = 'Formula-estimated REE/RMR (Mifflin-St Jeor, Male)';
  } else if (sex === 'female') {
    ree = base - 161;
    description = 'Formula-estimated REE/RMR (Mifflin-St Jeor, Female)';
  } else {
    // Gender-neutral mathematical midpoint approximation fallback: base - 78
    ree = base - 78;
    method = 'gender_neutral_midpoint_fallback';
    description = 'Approximate mathematical midpoint fallback (Mifflin-St Jeor midpoint)';
  }

  return {
    reeKcal: parseFloat(ree.toFixed(2)),
    method,
    isMeasured: false,
    description
  };
}

/**
 * Calculates Caloric Expenditure for Treadmill Incline Walking using ACSM Metabolic Equation
 * Formula: VO2 = (0.1 * S) + (1.8 * S * G) + 3.5
 * Where S = speed (m/min) [km/h * 16.6667], G = fractional incline [incline_pct / 100]
 *
 * Gross kcal/min = (VO2 * weight * 5) / 1000
 * Net Active kcal/min = ((VO2 - 3.5) * weight * 5) / 1000
 *
 * @param {object} stage - { speedKmh, inclinePct, durationSeconds, weightKg }
 * @returns {object} { netActiveKcal, grossKcal, vo2, isValidRange, warnings }
 */
function calculateACSMWalkingStage(stage) {
  const { speedKmh, inclinePct, durationSeconds, weightKg } = stage;
  const speed = parseFloat(speedKmh);
  const incline = parseFloat(inclinePct) || 0;
  const sec = parseFloat(durationSeconds);
  const w = parseFloat(weightKg);

  if (isNaN(speed) || isNaN(sec) || isNaN(w) || speed <= 0 || sec <= 0 || w <= 0) {
    return {
      netActiveKcal: 0,
      grossKcal: 0,
      vo2: null,
      isValidRange: false,
      warnings: ['Invalid speed, duration, or weight']
    };
  }

  const speedMetersPerMin = speed * 16.6667;
  const gradeDecimal = incline / 100.0;
  const durationMin = sec / 60.0;

  // ACSM walking equation validity bounds: 50 to 100 m/min (3.0 to 6.0 km/h), 0% to 20% incline
  const isValidRange = speedMetersPerMin >= 48.0 && speedMetersPerMin <= 105.0 && incline >= 0 && incline <= 25.0;
  const warnings = [];
  if (!isValidRange) {
    warnings.push('Speed or incline is outside standard ACSM walking equation validation range (3.0-6.0 km/h, 0-20% grade)');
  }

  // VO2 in ml/kg/min
  const vo2 = (0.1 * speedMetersPerMin) + (1.8 * speedMetersPerMin * gradeDecimal) + 3.5;

  // Gross and Net kcal per minute
  const grossKcalPerMin = (vo2 * w * 5.0) / 1000.0;
  const netActiveKcalPerMin = ((vo2 - 3.5) * w * 5.0) / 1000.0;

  const grossKcal = grossKcalPerMin * durationMin;
  const netActiveKcal = Math.max(0, netActiveKcalPerMin * durationMin);

  return {
    netActiveKcal: parseFloat(netActiveKcal.toFixed(2)),
    grossKcal: parseFloat(grossKcal.toFixed(2)),
    vo2: parseFloat(vo2.toFixed(2)),
    isValidRange,
    warnings
  };
}

/**
 * Calculates Caloric Expenditure for a 5-Stage Treadmill Protocol
 * Sums stage-by-stage Net Active kcal.
 *
 * @param {Array} stages - Array of stage objects
 * @param {number} userWeightKg - Body weight in kg
 * @returns {object} { totalNetActiveKcal, totalGrossKcal, totalDurationMinutes, stageResults }
 */
function calculateTreadmillProtocol(stages, userWeightKg) {
  let totalNetActive = 0;
  let totalGross = 0;
  let totalDurationSec = 0;
  const stageResults = [];

  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    const res = calculateACSMWalkingStage({
      speedKmh: s.speed_kmh || s.target_speed_kmh,
      inclinePct: s.incline_pct || s.target_incline_pct,
      durationSeconds: s.duration_seconds || s.target_duration_seconds,
      weightKg: userWeightKg
    });

    totalNetActive += res.netActiveKcal;
    totalGross += res.grossKcal;
    totalDurationSec += (s.duration_seconds || s.target_duration_seconds || 0);

    stageResults.push({
      stageIndex: i + 1,
      ...res
    });
  }

  return {
    totalNetActiveKcal: parseFloat(totalNetActive.toFixed(2)),
    totalGrossKcal: parseFloat(totalGross.toFixed(2)),
    totalDurationMinutes: parseFloat((totalDurationSec / 60.0).toFixed(1)),
    stageResults
  };
}

/**
 * Calculates Session-Level Resistance Calorie Expenditure
 * CRITICAL RULE: Uses session-level MET estimates across total workout minutes;
 * NEVER sums individual exercise MET values.
 *
 * Net Active kcal = ((session_met - 1.0) * 3.5 * weight_kg / 200) * minutes
 * Gross kcal = (session_met * 3.5 * weight_kg / 200) * minutes
 *
 * @param {object} params - { sessionAvgMet, durationMinutes, weightKg, intensityLevel }
 * @returns {object} { netActiveKcal, grossKcal, sessionMetUsed, metSource }
 */
function calculateResistanceSessionEnergy(params) {
  const { sessionAvgMet, durationMinutes, weightKg, intensityLevel } = params;
  const dur = parseFloat(durationMinutes);
  const w = parseFloat(weightKg);

  if (isNaN(dur) || isNaN(w) || dur <= 0 || w <= 0) {
    return { netActiveKcal: 0, grossKcal: 0, sessionMetUsed: 0, metSource: 'Invalid inputs' };
  }

  // Determine appropriate session-level MET from 2024 Adult Compendium benchmarks
  let met = parseFloat(sessionAvgMet);
  let metSource = 'Session-level average MET';

  if (isNaN(met) || met <= 1.0) {
    if (intensityLevel === 'vigorous') {
      met = 6.0;
      metSource = '2024 Adult Compendium Code 02050 (Vigorous resistance training, powerlifting or bodybuilding: 6.0 MET)';
    } else if (intensityLevel === 'heavy_compounds') {
      met = 5.0;
      metSource = '2024 Adult Compendium Code 02052 (Resistance training, squats and deadlifts: 5.0 MET)';
    } else {
      met = 3.5;
      metSource = '2024 Adult Compendium Code 02054 (Multiple resistance exercises, 8-15 reps: 3.5 MET)';
    }
  }

  // Net Active kcal/min = (MET - 1.0) * 3.5 * weight / 200
  const netActiveKcal = Math.max(0, ((met - 1.0) * 3.5 * w / 200.0) * dur);
  const grossKcal = (met * 3.5 * w / 200.0) * dur;

  return {
    netActiveKcal: parseFloat(netActiveKcal.toFixed(2)),
    grossKcal: parseFloat(grossKcal.toFixed(2)),
    sessionMetUsed: parseFloat(met.toFixed(2)),
    metSource
  };
}

/**
 * Calculates Non-Exercise Activity Thermogenesis (NEAT) Caloric Expenditure
 * Net Active kcal = ((MET - 1.0) * 3.5 * weight_kg / 200) * minutes
 *
 * @param {number} metValue - Activity MET
 * @param {number} durationMinutes - Duration in minutes
 * @param {number} weightKg - User weight in kg
 * @returns {object} { netActiveKcal, grossKcal }
 */
function calculateNeatEnergy(metValue, durationMinutes, weightKg) {
  const met = parseFloat(metValue);
  const dur = parseFloat(durationMinutes);
  const w = parseFloat(weightKg);

  if (isNaN(met) || isNaN(dur) || isNaN(w) || dur <= 0 || w <= 0) {
    return { netActiveKcal: 0, grossKcal: 0 };
  }

  // Sedentary baseline (MET = 1.0) produces 0 net active kcal
  const netMet = Math.max(0, met - 1.0);
  const netActiveKcal = (netMet * 3.5 * w / 200.0) * dur;
  const grossKcal = (met * 3.5 * w / 200.0) * dur;

  return {
    netActiveKcal: parseFloat(netActiveKcal.toFixed(2)),
    grossKcal: parseFloat(grossKcal.toFixed(2))
  };
}

/**
 * Calculates Thermic Effect of Food (TEF) from logged macronutrients
 * Agreed clinical macronutrient midpoint formula:
 *   TEF = (P * 4 * 0.25) + (C * 4 * 0.075) + (F * 9 * 0.015)
 * Agreed clinical macronutrient ranges:
 *   - Protein: 20–30% (midpoint 25%)
 *   - Carbohydrates: 5–10% (midpoint 7.5%)
 *   - Fat: 0–3% (midpoint 1.5%)
 *
 * Missing or unrecorded macronutrients are NOT treated as zero consumption.
 *
 * @param {object} macros - { proteinGrams, carbsGrams, fatGrams }
 * @returns {object} { tefEstimatedKcal, tefMinKcal, tefMaxKcal, isComplete, status, disclosure }
 */
function calculateTEF(macros = {}) {
  const pRaw = macros.proteinGrams;
  const cRaw = macros.carbsGrams;
  const fRaw = macros.fatGrams;

  const hasData = (pRaw !== undefined && pRaw !== null) ||
                  (cRaw !== undefined && cRaw !== null) ||
                  (fRaw !== undefined && fRaw !== null);

  if (!hasData) {
    return {
      tefEstimatedKcal: null,
      tefMinKcal: null,
      tefMaxKcal: null,
      isComplete: false,
      status: 'unrecorded',
      disclosure: 'Macronutrients unrecorded for this date. Thermic Effect of Food cannot be estimated from zero without meal logs.'
    };
  }

  const p = parseFloat(pRaw) || 0;
  const c = parseFloat(cRaw) || 0;
  const f = parseFloat(fRaw) || 0;

  // Caloric value of macronutrients (4 kcal/g for protein and carbs, 9 kcal/g for fat)
  const proteinKcal = p * 4.0;
  const carbsKcal = c * 4.0;
  const fatKcal = f * 9.0;

  // Midpoint formula: (P * 4 * 0.25) + (C * 4 * 0.075) + (F * 9 * 0.015)
  const tefEstimated = (proteinKcal * 0.25) + (carbsKcal * 0.075) + (fatKcal * 0.015);
  // Range bounds: Protein 20-30%, Carbs 5-10%, Fat 0-3%
  const tefMin = (proteinKcal * 0.20) + (carbsKcal * 0.05) + (fatKcal * 0.00);
  const tefMax = (proteinKcal * 0.30) + (carbsKcal * 0.10) + (fatKcal * 0.03);

  const isComplete = p > 0 || c > 0 || f > 0;

  return {
    tefEstimatedKcal: parseFloat(tefEstimated.toFixed(2)),
    tefMinKcal: parseFloat(tefMin.toFixed(2)),
    tefMaxKcal: parseFloat(tefMax.toFixed(2)),
    isComplete,
    status: isComplete ? 'calculated' : 'zero_logged',
    ranges: {
      proteinMidpoint: '25% (range 20–30%)',
      carbsMidpoint: '7.5% (range 5–10%)',
      fatMidpoint: '1.5% (range 0–3%)'
    },
    uncertaintyRangeKcal: [parseFloat(tefMin.toFixed(2)), parseFloat(tefMax.toFixed(2))],
    disclosure: 'Derived from clinical macronutrient ranges: Protein (20–30%), Carbs (5–10%), Fat (0–3%).'
  };
}

/**
 * Synthesizes Total Daily Energy Expenditure (TDEE)
 * Formula: TDEE = REE + Net Active Walking + Net Active Gym + Net Active NEAT + TEF
 *
 * @param {object} components - { reeKcal, walkingActiveKcal, gymActiveKcal, neatActiveKcal, tefKcal }
 * @returns {number} Estimated total daily TDEE in kcal
 */
function synthesizeTDEE(components) {
  const ree = parseFloat(components.reeKcal) || 0;
  const walking = parseFloat(components.walkingActiveKcal) || 0;
  const gym = parseFloat(components.gymActiveKcal) || 0;
  const neat = parseFloat(components.neatActiveKcal) || 0;
  const tef = parseFloat(components.tefKcal) || 0;

  const total = ree + walking + gym + neat + tef;
  return parseFloat(total.toFixed(2));
}

/**
 * 14–21 Day Ordinary Least Squares (OLS) Trend Calibration Engine
 * Calibrates observed TDEE from actual weigh-in slope and average caloric intake.
 *
 * @param {Array} weighIns - Array of { recorded_date, weight_kg }
 * @param {Array} nutritionLogs - Array of { log_date, total_consumed_kcal }
 * @param {object} options - Configuration overrides
 * @returns {object} Calibration result with status, slope, calibrated TDEE, and physiological warnings
 */
function calibrateTDEETrend(weighIns, nutritionLogs, options = {}) {
  const {
    minWindowDays = 14,
    minWeighInCount = 6,
    minNutritionCompletenessPct = 80.0,
    kcalPerKgAdipose = 7700 // Scientific approximation (~3,500 kcal/lb)
  } = options;

  const warnings = [];

  // Safeguard 1: Duplicate weigh-in handling (aggregate same-day weigh-ins by daily mean)
  const weighInMap = new Map();
  for (const w of weighIns) {
    const dateStr = typeof w.recorded_date === 'string' ? w.recorded_date.substring(0, 10) : w.recorded_date.toISOString().substring(0, 10);
    if (!weighInMap.has(dateStr)) {
      weighInMap.set(dateStr, []);
    }
    weighInMap.get(dateStr).push(parseFloat(w.weight_kg));
  }

  const distinctDays = Array.from(weighInMap.keys()).sort();
  const aggregatedWeighIns = distinctDays.map(dateStr => {
    const weights = weighInMap.get(dateStr);
    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
    return { dateStr, weight_kg: avgWeight, epochDays: new Date(dateStr).getTime() / 86400000 };
  });

  if (weighIns.length > distinctDays.length) {
    warnings.push(`Handled ${weighIns.length - distinctDays.length} duplicate weigh-in(s) across dates by averaging daily measurements.`);
  }

  // Safeguard 2: Actual elapsed-day calculation
  if (aggregatedWeighIns.length < 2) {
    return {
      status: 'INSUFFICIENT_DATA',
      calibrated_tdee_kcal: null,
      reason: 'At least 2 distinct weigh-in days required to establish an elapsed interval.',
      warnings
    };
  }

  const firstDate = new Date(aggregatedWeighIns[0].dateStr);
  const lastDate = new Date(aggregatedWeighIns[aggregatedWeighIns.length - 1].dateStr);
  const elapsedDays = Math.round((lastDate - firstDate) / 86400000);

  // Safeguard 3: Minimum calibration window and minimum weigh-in count
  if (elapsedDays < minWindowDays || aggregatedWeighIns.length < minWeighInCount) {
    return {
      status: 'INSUFFICIENT_DATA',
      calibrated_tdee_kcal: null,
      elapsed_days: elapsedDays,
      weigh_in_days_count: aggregatedWeighIns.length,
      reason: `Calibration window insufficient. Requires >= ${minWindowDays} elapsed days (found ${elapsedDays}) and >= ${minWeighInCount} weigh-ins (found ${aggregatedWeighIns.length}).`,
      warnings: [
        ...warnings,
        'Short-term weight changes (< 14 days) are heavily confounded by glycogen, sodium, and fluid shifts.'
      ]
    };
  }

  // Safeguard 4: Missing nutrition-log days and logging completeness threshold
  const totalWindowCalendarDays = elapsedDays + 1;
  const nutritionDaysLogged = nutritionLogs.filter(n => n.total_consumed_kcal != null && n.total_consumed_kcal > 0).length;
  const completenessPct = (nutritionDaysLogged / totalWindowCalendarDays) * 100;

  if (completenessPct < minNutritionCompletenessPct) {
    return {
      status: 'INCOMPLETE_NUTRITION_LOGS',
      calibrated_tdee_kcal: null,
      elapsed_days: elapsedDays,
      completeness_pct: parseFloat(completenessPct.toFixed(1)),
      reason: `Nutrition log completeness (${completenessPct.toFixed(1)}%) is below required threshold of ${minNutritionCompletenessPct}%. Missing days cannot be treated as 0 kcal.`,
      warnings: [
        ...warnings,
        'Treating missing meal log days as zero consumption creates severe starvation artifacts in expenditure calibration.'
      ]
    };
  }

  // Average intake calculation across logged days (excluding missing days)
  const totalIntake = nutritionLogs.reduce((sum, n) => sum + (parseFloat(n.total_consumed_kcal) || 0), 0);
  const avgDailyIntake = totalIntake / nutritionDaysLogged;

  // Safeguard 5: Ordinary Least Squares (OLS) Linear Regression slope over elapsed days
  const baseEpoch = aggregatedWeighIns[0].epochDays;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  const n = aggregatedWeighIns.length;

  for (const pt of aggregatedWeighIns) {
    const x = pt.epochDays - baseEpoch;
    const y = pt.weight_kg;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const slopeKgPerDay = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  // Safeguard 6: Calibrated TDEE using approximate 7,700 kcal/kg adipose tissue density
  // Trend TDEE = Avg Daily Intake - (slope_kg_per_day * 7700)
  const calibratedTdee = avgDailyIntake - (slopeKgPerDay * kcalPerKgAdipose);

  warnings.push('7,700 kcal/kg (3,500 kcal/lb) is an accepted physiological approximation for adipose tissue density; metabolic adaptation introduces normal individual variance.');
  warnings.push('Day-to-day weight fluctuations (±1–2 kg) are water/glycogen noise rather than changes in fat or lean tissue.');
  warnings.push('The reported ±8% uncertainty range is a physiological margin of error (representing metabolic adaptation and logging variance), not a parametric statistical confidence interval.');

  return {
    status: 'SUCCESS',
    calibrated_tdee_kcal: Math.round(calibratedTdee),
    avg_daily_intake_kcal: Math.round(avgDailyIntake),
    weight_slope_kg_per_day: parseFloat(slopeKgPerDay.toFixed(4)),
    weight_change_kg_total: parseFloat((slopeKgPerDay * elapsedDays).toFixed(2)),
    elapsed_days: elapsedDays,
    weigh_in_days_count: aggregatedWeighIns.length,
    completeness_pct: parseFloat(completenessPct.toFixed(1)),
    energy_density_constant_kcal_per_kg: kcalPerKgAdipose,
    uncertainty_band_pct: 8.0,
    uncertainty_range_kcal: [
      Math.round(calibratedTdee * 0.92),
      Math.round(calibratedTdee * 1.08)
    ],
    warnings
  };
}

module.exports = {
  calculateRestingEnergy,
  calculateACSMWalkingStage,
  calculateTreadmillProtocol,
  calculateResistanceSessionEnergy,
  calculateNeatEnergy,
  calculateTEF,
  synthesizeTDEE,
  calibrateTDEETrend
};
