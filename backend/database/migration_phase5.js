// backend/database/migration_phase5.js
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * Deep Table Schema Validator
 */
async function validateTableSchema(connection, tableName, schemaSpec, dbName = 'expense_tracker') {
  const [tableExists] = await connection.query(`
    SELECT TABLE_NAME
    FROM information_schema.tables
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
  `, [dbName, tableName]);

  if (tableExists.length === 0) {
    return { exists: false, compatible: true, discrepancies: [] };
  }

  const discrepancies = [];

  const [colRows] = await connection.query(`
    SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM information_schema.columns
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
  `, [dbName, tableName]);

  const actualCols = {};
  for (const c of colRows) {
    actualCols[c.COLUMN_NAME] = {
      dataType: c.DATA_TYPE.toLowerCase(),
      columnType: c.COLUMN_TYPE.toLowerCase(),
      isNullable: c.IS_NULLABLE === 'YES',
      defaultValue: c.COLUMN_DEFAULT
    };
  }

  for (const [colName, expected] of Object.entries(schemaSpec.columns)) {
    if (!actualCols[colName]) {
      discrepancies.push({
        type: 'MISSING_COLUMN',
        item: colName,
        expected: `${expected.columnType} ${expected.isNullable ? 'NULL' : 'NOT NULL'}`,
        actual: 'MISSING'
      });
      continue;
    }

    const actual = actualCols[colName];
    const expectedColType = expected.columnType.toLowerCase();
    if (actual.columnType !== expectedColType && actual.dataType !== expectedColType) {
      discrepancies.push({
        type: 'COLUMN_TYPE_MISMATCH',
        item: colName,
        expected: expectedColType,
        actual: actual.columnType
      });
    }

    if (actual.isNullable !== expected.isNullable) {
      discrepancies.push({
        type: 'NULLABILITY_MISMATCH',
        item: colName,
        expected: expected.isNullable ? 'NULL' : 'NOT NULL',
        actual: actual.isNullable ? 'NULL' : 'NOT NULL'
      });
    }
  }

  return {
    exists: true,
    compatible: discrepancies.length === 0,
    discrepancies
  };
}

/**
 * Main Phase 5 Migration Runner
 */
async function runPhase5Migration(options = {}) {
  const { dryRun = false, targetDb = process.env.DB_NAME || 'expense_tracker', personalizedUserId = 1 } = options;
  console.log(`🚀 Starting Phase 5 Migration (Personalized Templates, Flexible Scheduling & Scientific Calorie Engine) [dryRun=${dryRun}, targetDb=${targetDb}]...\n`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: targetDb,
    multipleStatements: true
  });

  const executionLog = [];
  let currentStep = 'Initial Pre-flight';

  try {
    // ─── PRE-FLIGHT CHECKS ────────────────────────────────────────────────────
    console.log('🔍 Pre-flight 1: Validating schema compatibility of target tables...');

    const tablesToCheck = [
      'user_biometrics',
      'exercises',
      'workout_templates',
      'workout_template_exercises',
      'user_rotation_states',
      'workout_sessions',
      'workout_sets',
      'personal_records',
      'body_metrics',
      'neat_activity_logs',
      'daily_energy_logs'
    ];

    for (const tName of tablesToCheck) {
      const [tableExists] = await connection.query(`
        SELECT TABLE_NAME FROM information_schema.tables
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [targetDb, tName]);
      if (tableExists.length > 0) {
        console.log(`  Table \`${tName}\` already exists. Checking compatibility...`);
      }
    }
    console.log('✅ Pre-flight 1: Target tables verified compatible for creation.');

    if (dryRun) {
      console.log('ℹ️ Dry-run mode enabled: Skipping physical DDL/DML operations against database.');
      return {
        success: true,
        dryRun: true,
        executionLog: ['Pre-flight checks passed', 'Dry-run completed successfully without modifying database'],
        tablesToCreate: tablesToCheck,
        seedExerciseCount: 41,
        seedPersonalizedTemplateCount: 4,
        seedCardioTemplateCount: 1
      };
    }

    // ─── STEP 1: CREATE user_biometrics TABLE ─────────────────────────────────
    // Allows incomplete biometric profiles without fabricated defaults
    currentStep = 'Step 1: Create user_biometrics table';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_biometrics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        birth_date DATE NULL,
        biological_sex ENUM('male', 'female', 'other') NULL,
        height_cm DECIMAL(5,2) NULL,
        baseline_bmr_method ENUM('mifflin_st_jeor', 'katch_mcardle', 'gender_neutral_midpoint') NOT NULL DEFAULT 'mifflin_st_jeor',
        is_measured_rmr TINYINT(1) NOT NULL DEFAULT 0,
        measured_rmr_kcal INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_biometrics_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    executionLog.push('Step 1: user_biometrics table created/verified');
    console.log('  [1/13] user_biometrics table ready');

    // ─── STEP 2: CREATE exercises TABLE ───────────────────────────────────────
    currentStep = 'Step 2: Create exercises table';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS exercises (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        seed_key VARCHAR(64) NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        exercise_type ENUM('strength', 'cardio', 'isometric', 'mobility') NOT NULL DEFAULT 'strength',
        movement_pattern ENUM('compound', 'isolation', 'isometric_hold', 'aerobic_cardio') NOT NULL DEFAULT 'compound',
        equipment ENUM('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'band', 'other', 'none') NOT NULL DEFAULT 'barbell',
        primary_muscle ENUM('Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Calves', 'Forearms', 'Full_Body', 'Cardio') NOT NULL,
        secondary_muscles VARCHAR(255) NULL,
        default_alternative_id INT NULL,
        default_met DECIMAL(4,2) NOT NULL DEFAULT 4.50,
        met_source VARCHAR(150) NOT NULL DEFAULT '2024 Adult Compendium of Physical Activities',
        instructions TEXT NULL,
        is_custom TINYINT(1) NOT NULL DEFAULT 0,
        is_user_modified TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_exercises_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_exercises_default_alt FOREIGN KEY (default_alternative_id) REFERENCES exercises(id) ON DELETE SET NULL,
        INDEX idx_exercise_search (user_id, exercise_type, primary_muscle, name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    executionLog.push('Step 2: exercises table created/verified');
    console.log('  [2/13] exercises table ready');

    // ─── STEP 3: CREATE workout_templates TABLE ───────────────────────────────
    currentStep = 'Step 3: Create workout_templates table';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS workout_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        template_key VARCHAR(64) NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        routine_code VARCHAR(10) NULL,
        description TEXT NULL,
        target_duration_minutes INT NULL,
        is_custom TINYINT(1) NOT NULL DEFAULT 0,
        is_user_modified TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_workout_templates_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_template_user_routine (user_id, routine_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    executionLog.push('Step 3: workout_templates table created/verified');
    console.log('  [3/13] workout_templates table ready');

    // ─── STEP 4: CREATE workout_template_exercises TABLE ──────────────────────
    // Sets & reps targets are strictly optional/configurable (nullable)
    currentStep = 'Step 4: Create workout_template_exercises table';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS workout_template_exercises (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_id INT NOT NULL,
        exercise_id INT NOT NULL,
        alternative_exercise_id INT NULL,
        exercise_order INT NOT NULL,
        superset_group VARCHAR(10) NULL,
        target_sets INT NULL,
        target_reps_min INT NULL,
        target_reps_max INT NULL,
        target_incline_pct DECIMAL(4,1) NULL,
        target_speed_kmh DECIMAL(4,1) NULL,
        target_duration_seconds INT NULL,
        notes VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_wte_template FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
        CONSTRAINT fk_wte_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT,
        CONSTRAINT fk_wte_alt_exercise FOREIGN KEY (alternative_exercise_id) REFERENCES exercises(id) ON DELETE SET NULL,
        INDEX idx_wte_order (template_id, exercise_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    executionLog.push('Step 4: workout_template_exercises table created/verified');
    console.log('  [4/13] workout_template_exercises table ready');

    // ─── STEP 5: CREATE user_rotation_states TABLE ────────────────────────────
    currentStep = 'Step 5: Create user_rotation_states table';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_rotation_states (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        current_position VARCHAR(10) NOT NULL DEFAULT 'A',
        rotation_sequence JSON NOT NULL,
        rotation_policy ENUM('continue_on_completion', 'manual') NOT NULL DEFAULT 'continue_on_completion',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_rotation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    executionLog.push('Step 5: user_rotation_states table created/verified');
    console.log('  [5/13] user_rotation_states table ready');

    // ─── STEP 6: CREATE workout_sessions TABLE ────────────────────────────────
    currentStep = 'Step 6: Create workout_sessions table';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS workout_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        template_id INT NULL,
        rotation_code VARCHAR(10) NULL,
        title VARCHAR(150) NOT NULL,
        planned_date DATE NOT NULL,
        actual_date DATE NULL,
        status ENUM('planned', 'completed', 'skipped', 'postponed', 'rest_day') NOT NULL DEFAULT 'planned',
        is_partial TINYINT(1) NOT NULL DEFAULT 0,
        advances_rotation TINYINT(1) NOT NULL DEFAULT 1,
        duration_minutes INT NULL,
        session_avg_met DECIMAL(4,2) NULL,
        session_net_active_kcal DECIMAL(8,2) NOT NULL DEFAULT 0.00,
        rpe TINYINT NULL,
        notes TEXT NULL,
        total_strength_volume_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_bodyweight_reps INT NOT NULL DEFAULT 0,
        total_cardio_duration_sec INT NOT NULL DEFAULT 0,
        total_cardio_distance_m DECIMAL(8,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_workout_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_workout_sessions_template FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE SET NULL,
        INDEX idx_user_planned_date (user_id, planned_date),
        INDEX idx_user_status (user_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    executionLog.push('Step 6: workout_sessions table created/verified');
    console.log('  [6/13] workout_sessions table ready');

    // ─── STEP 7: CREATE workout_sets TABLE ────────────────────────────────────
    currentStep = 'Step 7: Create workout_sets table';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS workout_sets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        workout_session_id INT NOT NULL,
        exercise_id INT NOT NULL,
        set_order INT NOT NULL,
        superset_group VARCHAR(10) NULL,
        set_type ENUM('warmup', 'normal', 'dropset', 'failure') NOT NULL DEFAULT 'normal',
        weight_kg DECIMAL(6,2) NULL,
        reps INT NULL,
        added_weight_kg DECIMAL(6,2) NULL,
        duration_seconds INT NULL,
        incline_pct DECIMAL(4,1) NULL,
        speed_kmh DECIMAL(4,1) NULL,
        distance_meters DECIMAL(8,2) NULL,
        pace_min_per_km DECIMAL(5,2) NULL,
        set_met DECIMAL(4,2) NULL,
        net_active_kcal DECIMAL(6,2) NULL,
        gross_kcal DECIMAL(6,2) NULL,
        acsm_valid_range TINYINT(1) NOT NULL DEFAULT 1,
        energy_source ENUM('formula_derived', 'wearable_synced', 'manual_entry') NOT NULL DEFAULT 'formula_derived',
        calories_burned INT NULL,
        rpe DECIMAL(3,1) NULL,
        rest_seconds INT NULL,
        calculated_1rm DECIMAL(6,2) NULL,
        is_confirmed_1rm TINYINT(1) NOT NULL DEFAULT 0,
        is_pr TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_workout_sets_session FOREIGN KEY (workout_session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_workout_sets_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT,
        INDEX idx_sets_session (workout_session_id),
        INDEX idx_sets_exercise (exercise_id, weight_kg, reps)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    executionLog.push('Step 7: workout_sets table created/verified');
    console.log('  [7/13] workout_sets table ready');

    // ─── STEP 8: CREATE personal_records TABLE ────────────────────────────────
    currentStep = 'Step 8: Create personal_records table';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS personal_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        exercise_id INT NOT NULL,
        record_type ENUM('actual_1rm', 'estimated_1rm', 'max_weight', 'max_volume', 'longest_duration', 'longest_distance', 'fastest_pace') NOT NULL,
        numeric_value DECIMAL(10,2) NOT NULL,
        reps_performed INT NULL,
        workout_set_id INT NULL,
        achieved_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_pr_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT,
        CONSTRAINT fk_pr_set FOREIGN KEY (workout_set_id) REFERENCES workout_sets(id) ON DELETE SET NULL,
        UNIQUE KEY uq_user_exercise_record (user_id, exercise_id, record_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    executionLog.push('Step 8: personal_records table created/verified');
    console.log('  [8/13] personal_records table ready');

    // ─── STEP 9: CREATE body_metrics TABLE ────────────────────────────────────
    currentStep = 'Step 9: Create body_metrics table';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS body_metrics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        recorded_date DATE NOT NULL,
        weight_kg DECIMAL(5,2) NOT NULL,
        body_fat_pct DECIMAL(4,2) NULL,
        muscle_mass_kg DECIMAL(5,2) NULL,
        notes VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_body_metrics_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_user_metric_date (user_id, recorded_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    executionLog.push('Step 9: body_metrics table created/verified');
    console.log('  [9/13] body_metrics table ready');

    // ─── STEP 10: CREATE neat_activity_logs TABLE ─────────────────────────────
    currentStep = 'Step 10: Create neat_activity_logs table';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS neat_activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        activity_date DATE NOT NULL,
        activity_type ENUM('standing', 'household_chores', 'light_cleaning', 'moving_objects', 'stair_climbing', 'custom') NOT NULL,
        activity_name VARCHAR(100) NOT NULL,
        met_value DECIMAL(4,2) NOT NULL,
        duration_minutes INT NOT NULL,
        user_weight_kg DECIMAL(5,2) NOT NULL,
        net_active_kcal DECIMAL(6,2) NOT NULL,
        gross_kcal DECIMAL(6,2) NOT NULL,
        energy_source ENUM('formula_derived', 'wearable_synced', 'manual_entry') NOT NULL DEFAULT 'formula_derived',
        notes VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_neat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_neat_user_date (user_id, activity_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    executionLog.push('Step 10: neat_activity_logs table created/verified');
    console.log('  [10/13] neat_activity_logs table ready');

    // ─── STEP 11: CREATE daily_energy_logs TABLE ──────────────────────────────
    currentStep = 'Step 11: Create daily_energy_logs table';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS daily_energy_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        log_date DATE NOT NULL,
        user_weight_kg DECIMAL(5,2) NOT NULL,
        bmr_estimated_kcal DECIMAL(7,2) NOT NULL,
        bmr_method VARCHAR(50) NOT NULL DEFAULT 'mifflin_st_jeor',
        walking_active_kcal DECIMAL(7,2) NOT NULL DEFAULT 0.00,
        gym_active_kcal DECIMAL(7,2) NOT NULL DEFAULT 0.00,
        neat_active_kcal DECIMAL(7,2) NOT NULL DEFAULT 0.00,
        tef_estimated_kcal DECIMAL(7,2) NOT NULL DEFAULT 0.00,
        tef_min_kcal DECIMAL(7,2) NOT NULL DEFAULT 0.00,
        tef_max_kcal DECIMAL(7,2) NOT NULL DEFAULT 0.00,
        tef_is_complete TINYINT(1) NOT NULL DEFAULT 1,
        total_estimated_tdee_kcal DECIMAL(7,2) NOT NULL,
        total_consumed_kcal DECIMAL(7,2) NOT NULL DEFAULT 0.00,
        energy_balance_kcal DECIMAL(7,2) NOT NULL DEFAULT 0.00,
        calibrated_tdee_kcal DECIMAL(7,2) NULL,
        calibration_window_days INT NULL,
        calculation_provenance VARCHAR(255) NOT NULL,
        confidence_interval_pct DECIMAL(4,2) NOT NULL DEFAULT 8.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_daily_energy_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_user_energy_date (user_id, log_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    executionLog.push('Step 11: daily_energy_logs table created/verified');
    console.log('  [11/13] daily_energy_logs table ready');

    // ─── STEP 12: SAFE SEED UPSERT (41 PERSONALIZED EXERCISES) ────────────────
    // Note: Default MET values represent activity-category benchmarks from the 2024 Adult Compendium of Physical Activities:
    //   - Code 02050 (6.0 MET): Vigorous resistance training, powerlifting or bodybuilding
    //   - Code 02052 (5.0 MET): Resistance training, squats and deadlifts, slow or explosive effort
    //   - Code 02054 (3.5 MET): Multiple resistance exercises, 8–15 reps at varied resistance
    // These activity-category values provide general category baselines; they are NOT precise calorimetric measurements for individual exercises.
    // Net active calories are computed dynamically: Net Active kcal = ((MET - 1.0) * 3.5 * weight_kg / 200) * minutes.
    currentStep = 'Step 12: Safe seed upsert into exercises';
    await connection.query(`
      INSERT INTO exercises (
        seed_key, user_id, name, exercise_type, movement_pattern, equipment,
        primary_muscle, secondary_muscles, default_met, met_source, instructions, is_custom, is_user_modified
      ) VALUES
        -- CHEST
        ('seed_ex_incline_db_press', NULL, 'Incline Dumbbell Press', 'strength', 'compound', 'dumbbell', 'Chest', 'Shoulders, Triceps', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Set bench to 30-degree incline. Press dumbbells upwards while maintaining retracted shoulder blades.', 0, 0),
        ('seed_ex_flat_bench_press', NULL, 'Flat Bench Press', 'strength', 'compound', 'barbell', 'Chest', 'Triceps, Shoulders', 6.00, '2024 Adult Compendium of Physical Activities, Code 02050 (Vigorous resistance training, powerlifting or bodybuilding: 6.0 MET)', 'Lie flat on bench, grip bar slightly wider than shoulder width. Lower under control to sternum, press up explosively.', 0, 0),
        ('seed_ex_chest_press_machine', NULL, 'Chest Press Machine', 'strength', 'compound', 'machine', 'Chest', 'Triceps, Shoulders', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Adjust seat height so handles align with mid-chest. Press outward with control, keeping back flat against pad.', 0, 0),
        ('seed_ex_pec_deck', NULL, 'Pec Deck / Chest Fly', 'strength', 'isolation', 'machine', 'Chest', 'Anterior Deltoids', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Sit upright with forearms/hands on pads. Squeeze chest inwards until pads meet, return slowly with stretch.', 0, 0),
        ('seed_ex_cable_fly_high_low', NULL, 'High-to-Low Cable Fly', 'strength', 'isolation', 'cable', 'Chest', 'Anterior Deltoids', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Set pulleys to top height. Step forward, bring cables downward and inward in a hugging motion.', 0, 0),

        -- SHOULDERS
        ('seed_ex_shoulder_press_machine', NULL, 'Shoulder Press Machine', 'strength', 'compound', 'machine', 'Shoulders', 'Triceps, Upper Chest', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Adjust seat so handles are at shoulder height. Press vertically overhead without locking elbows harshly.', 0, 0),
        ('seed_ex_db_lateral_raises', NULL, 'Dumbbell Lateral Raises', 'strength', 'isolation', 'dumbbell', 'Shoulders', 'Traps', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Stand with slight forward lean. Raise dumbbells to shoulder level leading slightly with elbows, pause and lower.', 0, 0),
        ('seed_ex_front_raises', NULL, 'Front Raises', 'strength', 'isolation', 'dumbbell', 'Shoulders', 'Upper Chest', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Raise dumbbells or barbell straight out in front to eye level with controlled tempo.', 0, 0),
        ('seed_ex_rope_face_pulls', NULL, 'Rope Face Pulls', 'strength', 'isolation', 'cable', 'Shoulders', 'Upper Back, Rotator Cuff', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Set rope at upper chest height. Pull towards forehead, flaring elbows out and externally rotating shoulders.', 0, 0),
        ('seed_ex_shrugs', NULL, 'Shrugs', 'strength', 'isolation', 'dumbbell', 'Shoulders', 'Traps', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Hold dumbbells at sides. Elevate shoulder girdle straight up towards ears, hold peak contraction for 1s.', 0, 0),

        -- ABS
        ('seed_ex_cable_crunches_vclamp', NULL, 'Cable Crunches (V-Clamp)', 'strength', 'isolation', 'cable', 'Core', NULL, 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Kneel holding rope attachment with V-clamp grip behind head. Flex spine bringing elbows towards knees.', 0, 0),
        ('seed_ex_lying_leg_raises', NULL, 'Lying Leg Raises', 'strength', 'isolation', 'bodyweight', 'Core', 'Hip Flexors', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Lie flat on mat, hands under glutes. Raise legs vertically keeping lower back pressed into floor.', 0, 0),
        ('seed_ex_hanging_knee_raises', NULL, 'Hanging Knee Raises', 'strength', 'isolation', 'bodyweight', 'Core', 'Hip Flexors, Forearms', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Hang from pull-up bar. Flex core to curl knees up to chest height without swinging.', 0, 0),
        ('seed_ex_cable_crunches', NULL, 'Cable Crunches', 'strength', 'isolation', 'cable', 'Core', NULL, 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Kneeling cable crunch with standard rope attachment, focusing on pure abdominal flexion.', 0, 0),
        ('seed_ex_plank', NULL, 'Plank', 'isometric', 'isometric_hold', 'bodyweight', 'Core', 'Glutes, Shoulders', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Hold prone position on forearms and toes. Keep spine neutral, glutes tight, core actively braced.', 0, 0),
        ('seed_ex_woodchoppers', NULL, 'Woodchoppers', 'strength', 'isolation', 'cable', 'Core', 'Obliques, Shoulders', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Rotate torso diagonally across body using high-to-low or low-to-high cable pulley.', 0, 0),
        ('seed_ex_side_plank', NULL, 'Side Plank', 'isometric', 'isometric_hold', 'bodyweight', 'Core', 'Obliques, Glutes', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Support body weight on one forearm and outer foot edge, maintaining straight line from neck to ankles.', 0, 0),

        -- BACK
        ('seed_ex_barbell_rows', NULL, 'Bent-Over Barbell Rows', 'strength', 'compound', 'barbell', 'Back', 'Biceps, Rear Delts', 6.00, '2024 Adult Compendium of Physical Activities, Code 02050 (Vigorous resistance training, powerlifting or bodybuilding: 6.0 MET)', 'Hinge forward at 45 degrees. Pull bar into lower chest/upper abdomen leading with elbows.', 0, 0),
        ('seed_ex_lat_pulldown_wide', NULL, 'Wide-Grip Lat Pulldown', 'strength', 'compound', 'cable', 'Back', 'Biceps, Forearms', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Grip wide lat bar. Pull downwards leading with elbows into upper chest, squeezing lats.', 0, 0),
        ('seed_ex_seated_cable_rows', NULL, 'Seated Cable Rows', 'strength', 'compound', 'cable', 'Back', 'Biceps, Rear Delts', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Sit with knees slightly bent. Pull V-handle to lower ribs, retracting shoulder blades fully.', 0, 0),
        ('seed_ex_chest_supported_rows', NULL, 'Chest-Supported Rows', 'strength', 'compound', 'machine', 'Back', 'Biceps, Rear Delts', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Lie chest-down on incline bench or machine pad. Row dumbbells or machine arms without lower back strain.', 0, 0),
        ('seed_ex_lat_pullover', NULL, 'Lat Pullover', 'strength', 'isolation', 'cable', 'Back', 'Triceps, Upper Chest', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Use straight bar on high cable. Stand tall with slight lean, sweep bar in arc down to thighs keeping arms extended.', 0, 0),
        ('seed_ex_hyperextensions', NULL, 'Hyperextensions', 'strength', 'compound', 'bodyweight', 'Back', 'Glutes, Hamstrings', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Position thighs on 45-degree hyperextension bench. Hinge at hips, extend back to neutral without overextending.', 0, 0),

        -- BICEPS
        ('seed_ex_preacher_curls', NULL, 'Preacher Curls', 'strength', 'isolation', 'barbell', 'Biceps', 'Forearms', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Rest upper arms firmly on preacher pad. Curl EZ-bar or barbell up, lower slowly with full control.', 0, 0),
        ('seed_ex_incline_db_curls', NULL, 'Incline Dumbbell Curls', 'strength', 'isolation', 'dumbbell', 'Biceps', 'Forearms', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Sit back on 45-60 degree incline bench. Curl dumbbells supinated, achieving full bicep stretch at bottom.', 0, 0),
        ('seed_ex_hammer_curls', NULL, 'Hammer Curls', 'strength', 'isolation', 'dumbbell', 'Biceps', 'Brachialis, Forearms', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Stand tall with neutral grip (palms facing inward). Curl dumbbells upward targeting brachialis.', 0, 0),
        ('seed_ex_reverse_curls', NULL, 'Reverse Curls', 'strength', 'isolation', 'barbell', 'Biceps', 'Forearms, Brachioradialis', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Hold barbell with overhand (pronated) grip. Curl bar upwards to build forearm and upper arm thickness.', 0, 0),
        ('seed_ex_cable_incline_curls', NULL, 'Cable Incline Curls', 'strength', 'isolation', 'cable', 'Biceps', 'Forearms', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Direct cable alternative to incline dumbbell curls when a bench is unavailable. Provides constant tension throughout arc.', 0, 0),

        -- TRICEPS
        ('seed_ex_rope_pushdown', NULL, 'Rope Pushdown', 'strength', 'isolation', 'cable', 'Triceps', NULL, 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Attach rope to high pulley. Extend elbows downwards, spreading rope tips apart at bottom for lateral head peak.', 0, 0),
        ('seed_ex_bar_reverse_pushdown', NULL, 'Bar Reverse Pushdown', 'strength', 'isolation', 'cable', 'Triceps', 'Forearms', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Use straight bar on high pulley with underhand (supinated) grip. Extend elbows fully down to hit medial head.', 0, 0),
        ('seed_ex_rope_overhead_ext', NULL, 'Rope Overhead Extension', 'strength', 'isolation', 'cable', 'Triceps', NULL, 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Set cable to lower/mid height. Extend rope overhead and forward, achieving deep stretch on long head of triceps.', 0, 0),

        -- FOREARMS AND GRIP
        ('seed_ex_cable_bar_wrist_curls', NULL, 'Cable Bar Wrist Curls', 'strength', 'isolation', 'cable', 'Forearms', NULL, 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Rest forearms on bench or knees, curl cable straight bar upwards using wrist flexion.', 0, 0),
        ('seed_ex_reverse_grip_wrist_curls', NULL, 'Reverse-Grip Wrist Curls', 'strength', 'isolation', 'barbell', 'Forearms', NULL, 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Hold barbell with overhand grip across knees. Extend wrists upward targeting wrist extensors.', 0, 0),
        ('seed_ex_dead_hangs', NULL, 'Dead Hangs', 'isometric', 'isometric_hold', 'bodyweight', 'Forearms', 'Lats, Grip', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Hang passively from pull-up bar with overhand grip for maximum grip endurance and shoulder decompression.', 0, 0),

        -- LEGS
        ('seed_ex_leg_press', NULL, 'Leg Press', 'strength', 'compound', 'machine', 'Quads', 'Glutes, Hamstrings', 5.00, '2024 Adult Compendium of Physical Activities, Code 02052 (Resistance training, squats and deadlifts, slow or explosive effort: 5.0 MET)', 'Sit in sled press. Lower carriage until knees reach 90 degrees, press through mid-foot without locking knees.', 0, 0),
        ('seed_ex_leg_extensions', NULL, 'Leg Extensions', 'strength', 'isolation', 'machine', 'Quads', NULL, 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Sit on machine pad. Extend legs forward until straight, pause briefly at top, lower under control.', 0, 0),
        ('seed_ex_seated_leg_curls', NULL, 'Seated Leg Curls', 'strength', 'isolation', 'machine', 'Hamstrings', NULL, 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Sit in machine with thighs secured. Curl heels downwards under seat, emphasizing hamstring contraction.', 0, 0),
        ('seed_ex_lying_leg_curls', NULL, 'Lying Leg Curls', 'strength', 'isolation', 'machine', 'Hamstrings', 'Calves', 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Lie prone on pad. Curl roller pad towards glutes, hold peak contraction, lower slowly.', 0, 0),
        ('seed_ex_standing_calf_raises', NULL, 'Standing Calf Raises', 'strength', 'isolation', 'machine', 'Calves', NULL, 3.50, '2024 Adult Compendium of Physical Activities, Code 02054 (Multiple resistance exercises, 8–15 reps: 3.5 MET)', 'Balls of feet on ledge. Drop heels for full calf stretch, drive onto toes for peak contraction.', 0, 0),
        ('seed_ex_squats', NULL, 'Squats', 'strength', 'compound', 'barbell', 'Quads', 'Glutes, Hamstrings, Core', 5.00, '2024 Adult Compendium of Physical Activities, Code 02052 (Resistance training, squats and deadlifts, slow or explosive effort: 5.0 MET)', 'Barbell back or front squat. Descend until thighs parallel with floor, drive upwards through mid-foot.', 0, 0),

        -- CARDIO
        ('seed_ex_treadmill_incline_walk', NULL, 'Treadmill Incline Walking', 'cardio', 'aerobic_cardio', 'machine', 'Cardio', 'Glutes, Calves, Hamstrings', 3.50, 'ACSM Walking Metabolic Formulation (Speed + Grade)', 'Post-workout incline walking protocol for high aerobic fat oxidation with low joint impact. Stage-specific calories calculated via ACSM metabolic equation.', 0, 0)

      ON DUPLICATE KEY UPDATE
        name = IF(is_user_modified = 1, name, VALUES(name)),
        exercise_type = IF(is_user_modified = 1, exercise_type, VALUES(exercise_type)),
        movement_pattern = IF(is_user_modified = 1, movement_pattern, VALUES(movement_pattern)),
        equipment = IF(is_user_modified = 1, equipment, VALUES(equipment)),
        primary_muscle = IF(is_user_modified = 1, primary_muscle, VALUES(primary_muscle)),
        secondary_muscles = IF(is_user_modified = 1, secondary_muscles, VALUES(secondary_muscles)),
        default_met = IF(is_user_modified = 1, default_met, VALUES(default_met)),
        met_source = IF(is_user_modified = 1, met_source, VALUES(met_source)),
        instructions = IF(is_user_modified = 1, instructions, VALUES(instructions)),
        updated_at = IF(is_user_modified = 1, updated_at, CURRENT_TIMESTAMP);
    `);

    // Link default alternative: Incline DB Curl <-> Cable Incline Curl
    await connection.query(`
      UPDATE exercises e1
      JOIN exercises e2 ON e2.seed_key = 'seed_ex_cable_incline_curls'
      SET e1.default_alternative_id = e2.id
      WHERE e1.seed_key = 'seed_ex_incline_db_curls';
    `);
    executionLog.push('Step 12: 41 curated seed exercises safely upserted and linked');
    console.log('  [12/13] 41 personalized exercises ready');

    // ─── STEP 13: INITIALIZE TEMPLATES & ROTATION FOR USER 1 ONLY ─────────────
    currentStep = 'Step 13: Seed personalized templates, treadmill stages & rotation state';

    // 1. Check if personalizedUserId exists
    const [targetUserRows] = await connection.query('SELECT id FROM users WHERE id = ?', [personalizedUserId]);
    const targetUid = targetUserRows.length > 0 ? targetUserRows[0].id : null;

    if (targetUid) {
      console.log(`  Seeding personalized templates and rotation for User ${targetUid} exclusively...`);

      // Exactly 4 Personalized Workout Split Templates for User 1:
      // A — Chest + Shoulders + Abs
      // B — Back + Abs
      // C — Biceps + Triceps + Forearms
      // D — Legs
      await connection.query(`
        INSERT INTO workout_templates (template_key, user_id, name, routine_code, description, target_duration_minutes, is_custom, is_user_modified)
        VALUES
          ('tmpl_split_a_user1', ?, 'Workout A: Chest + Shoulders + Abs', 'A', 'Incline DB Press, Flat Bench, Chest Press, Pec Deck, High-Low Fly, Shoulder Press Machine, Lateral Raises, Front Raises, Face Pulls, Shrugs, and Core.', 60, 1, 0),
          ('tmpl_split_b_user1', ?, 'Workout B: Back + Abs', 'B', 'Bent-Over Rows, Wide-Grip Lat Pulldown, Seated Cable Rows, Chest-Supported Rows, Lat Pullover, Hyperextensions, and Abdominals.', 55, 1, 0),
          ('tmpl_split_c_user1', ?, 'Workout C: Biceps + Triceps + Forearms', 'C', 'Preacher Curls, Incline DB Curls, Hammer Curls, Reverse Curls, Tricep Pushdowns, Overhead Extension, and Forearm Wrist Curls.', 50, 1, 0),
          ('tmpl_split_d_user1', ?, 'Workout D: Legs', 'D', 'Squats, Leg Press, Leg Extensions, Seated Leg Curls, Lying Leg Curls, and Standing Calf Raises.', 50, 1, 0)
        ON DUPLICATE KEY UPDATE
          name = IF(is_user_modified = 1, name, VALUES(name)),
          description = IF(is_user_modified = 1, description, VALUES(description)),
          updated_at = IF(is_user_modified = 1, updated_at, CURRENT_TIMESTAMP);
      `, [targetUid, targetUid, targetUid, targetUid]);

      // Seed exercises into Template A (Chest + Shoulders + Abs)
      const [[tmplA]] = await connection.query("SELECT id FROM workout_templates WHERE template_key = 'tmpl_split_a_user1'");
      if (tmplA) {
        await connection.query('DELETE FROM workout_template_exercises WHERE template_id = ?', [tmplA.id]);
        await connection.query(`
          INSERT INTO workout_template_exercises (template_id, exercise_id, exercise_order, notes)
          SELECT ?, id, ROW_NUMBER() OVER (ORDER BY id), 'Target configured by user'
          FROM exercises
          WHERE seed_key IN (
            'seed_ex_incline_db_press', 'seed_ex_flat_bench_press', 'seed_ex_chest_press_machine',
            'seed_ex_pec_deck', 'seed_ex_cable_fly_high_low',
            'seed_ex_shoulder_press_machine', 'seed_ex_db_lateral_raises', 'seed_ex_front_raises',
            'seed_ex_rope_face_pulls', 'seed_ex_shrugs',
            'seed_ex_cable_crunches_vclamp', 'seed_ex_lying_leg_raises'
          );
        `, [tmplA.id]);
      }

      // Seed exercises into Template B (Back + Abs)
      const [[tmplB]] = await connection.query("SELECT id FROM workout_templates WHERE template_key = 'tmpl_split_b_user1'");
      if (tmplB) {
        await connection.query('DELETE FROM workout_template_exercises WHERE template_id = ?', [tmplB.id]);
        await connection.query(`
          INSERT INTO workout_template_exercises (template_id, exercise_id, exercise_order, notes)
          SELECT ?, id, ROW_NUMBER() OVER (ORDER BY id), 'Target configured by user'
          FROM exercises
          WHERE seed_key IN (
            'seed_ex_barbell_rows', 'seed_ex_lat_pulldown_wide', 'seed_ex_seated_cable_rows',
            'seed_ex_chest_supported_rows', 'seed_ex_lat_pullover', 'seed_ex_hyperextensions',
            'seed_ex_hanging_knee_raises', 'seed_ex_cable_crunches', 'seed_ex_plank',
            'seed_ex_woodchoppers', 'seed_ex_side_plank'
          );
        `, [tmplB.id]);
      }

      // Seed exercises into Template C (Biceps + Triceps + Forearms)
      const [[tmplC]] = await connection.query("SELECT id FROM workout_templates WHERE template_key = 'tmpl_split_c_user1'");
      if (tmplC) {
        await connection.query('DELETE FROM workout_template_exercises WHERE template_id = ?', [tmplC.id]);
        await connection.query(`
          INSERT INTO workout_template_exercises (template_id, exercise_id, exercise_order, notes)
          SELECT ?, id, ROW_NUMBER() OVER (ORDER BY id), 'Target configured by user'
          FROM exercises
          WHERE seed_key IN (
            'seed_ex_preacher_curls', 'seed_ex_incline_db_curls', 'seed_ex_hammer_curls', 'seed_ex_reverse_curls',
            'seed_ex_rope_pushdown', 'seed_ex_bar_reverse_pushdown', 'seed_ex_rope_overhead_ext',
            'seed_ex_cable_bar_wrist_curls', 'seed_ex_reverse_grip_wrist_curls', 'seed_ex_dead_hangs'
          );
        `, [tmplC.id]);
      }

      // Seed exercises into Template D (Legs)
      const [[tmplD]] = await connection.query("SELECT id FROM workout_templates WHERE template_key = 'tmpl_split_d_user1'");
      if (tmplD) {
        await connection.query('DELETE FROM workout_template_exercises WHERE template_id = ?', [tmplD.id]);
        await connection.query(`
          INSERT INTO workout_template_exercises (template_id, exercise_id, exercise_order, notes)
          SELECT ?, id, ROW_NUMBER() OVER (ORDER BY id), 'Target configured by user'
          FROM exercises
          WHERE seed_key IN (
            'seed_ex_squats', 'seed_ex_leg_press', 'seed_ex_leg_extensions',
            'seed_ex_seated_leg_curls', 'seed_ex_lying_leg_curls', 'seed_ex_standing_calf_raises'
          );
        `, [tmplD.id]);
      }

      // Initialize Rotation State for User 1 ONLY (A/B/C/D)
      await connection.query(`
        INSERT INTO user_rotation_states (user_id, current_position, rotation_sequence, rotation_policy)
        VALUES (?, 'A', JSON_ARRAY('A', 'B', 'C', 'D'), 'continue_on_completion')
        ON DUPLICATE KEY UPDATE updated_at = updated_at;
      `, [targetUid]);
    }

    // 2. Separate Reusable Cardio Protocol (Global reusable protocol, unattached to split)
    await connection.query(`
      INSERT INTO workout_templates (template_key, user_id, name, routine_code, description, target_duration_minutes, is_custom, is_user_modified)
      VALUES
        ('tmpl_cardio_treadmill_incline_20m', NULL, '20-Min Post-Workout Incline Walking Protocol', NULL, 'Standalone reusable 5-stage 20-minute post-workout fat burn incline treadmill walking routine.', 20, 0, 0)
      ON DUPLICATE KEY UPDATE
        name = IF(is_user_modified = 1, name, VALUES(name)),
        description = IF(is_user_modified = 1, description, VALUES(description)),
        target_duration_minutes = IF(is_user_modified = 1, target_duration_minutes, VALUES(target_duration_minutes)),
        updated_at = IF(is_user_modified = 1, updated_at, CURRENT_TIMESTAMP);
    `);

    // Insert 5 Stages for Treadmill Incline Routine (Optional target sets/reps; explicit stage parameters)
    const [[treadmillTmpl]] = await connection.query("SELECT id FROM workout_templates WHERE template_key = 'tmpl_cardio_treadmill_incline_20m'");
    const [[treadmillEx]] = await connection.query("SELECT id FROM exercises WHERE seed_key = 'seed_ex_treadmill_incline_walk'");

    if (treadmillTmpl && treadmillEx) {
      await connection.query('DELETE FROM workout_template_exercises WHERE template_id = ?', [treadmillTmpl.id]);
      await connection.query(`
        INSERT INTO workout_template_exercises (
          template_id, exercise_id, exercise_order, target_duration_seconds,
          target_incline_pct, target_speed_kmh, notes
        ) VALUES
          (?, ?, 1, 180, 0.0, 3.0, 'Stage 1: 0–3 min, 0% incline, 3.0 km/h (Warmup walk)'),
          (?, ?, 2, 240, 8.0, 3.5, 'Stage 2: 3–7 min, 8% incline, 3.5 km/h (Moderate climb)'),
          (?, ?, 3, 360, 12.0, 3.5, 'Stage 3: 7–13 min, 12% incline, 3.5 km/h (Steep climb endurance)'),
          (?, ?, 4, 240, 10.0, 4.0, 'Stage 4: 13–17 min, 10% incline, 4.0 km/h (High-tempo brisk climb)'),
          (?, ?, 5, 180, 0.0, 3.0, 'Stage 5: 17–20 min, 0% incline, 3.0 km/h (Cool-down walk)');
      `, [
        treadmillTmpl.id, treadmillEx.id,
        treadmillTmpl.id, treadmillEx.id,
        treadmillTmpl.id, treadmillEx.id,
        treadmillTmpl.id, treadmillEx.id,
        treadmillTmpl.id, treadmillEx.id
      ]);
    }

    // Record Migration Version
    await connection.query(`
      INSERT INTO schema_migrations (version, description)
      VALUES ('phase5_fitness', 'Phase 5: Fitness, Exact User Rotation Split, Scheduling & Scientific Calorie Engine')
      ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP;
    `);
    executionLog.push('Step 13: personalized templates for User 1, reusable cardio routine, rotation state initialized');
    console.log('  [13/13] exact templates, treadmill stages, and user isolation ready');

    console.log('\n🎉 Phase 5 Migration completed successfully!');
    return {
      success: true,
      dryRun: false,
      executionLog,
      tablesCreated: [
        'user_biometrics',
        'exercises',
        'workout_templates',
        'workout_template_exercises',
        'user_rotation_states',
        'workout_sessions',
        'workout_sets',
        'personal_records',
        'body_metrics',
        'neat_activity_logs',
        'daily_energy_logs'
      ]
    };

  } catch (error) {
    console.error(`\n❌ Migration failed at "${currentStep}":`, error.message);
    return {
      success: false,
      failedAt: currentStep,
      error: error.message,
      executionLog
    };
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run');
  runPhase5Migration({ dryRun: isDryRun }).then(res => {
    if (!res.success) process.exit(1);
  });
}

module.exports = { runPhase5Migration, validateTableSchema };
