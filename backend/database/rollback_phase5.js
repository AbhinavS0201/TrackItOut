// backend/database/rollback_phase5.js
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function rollbackPhase5(options = {}) {
  const { targetDb = process.env.DB_NAME || 'expense_tracker' } = options;
  console.log(`⚠️  Initiating Safe Rollback for Phase 5 (targetDb=${targetDb})...\n`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: targetDb
  });

  const dropped = [];

  try {
    console.log('  1. Dropping daily_energy_logs table...');
    await connection.query('DROP TABLE IF EXISTS daily_energy_logs');
    dropped.push('daily_energy_logs');

    console.log('  2. Dropping neat_activity_logs table...');
    await connection.query('DROP TABLE IF EXISTS neat_activity_logs');
    dropped.push('neat_activity_logs');

    console.log('  3. Dropping personal_records table...');
    await connection.query('DROP TABLE IF EXISTS personal_records');
    dropped.push('personal_records');

    console.log('  4. Dropping workout_sets table...');
    await connection.query('DROP TABLE IF EXISTS workout_sets');
    dropped.push('workout_sets');

    console.log('  5. Dropping workout_sessions table...');
    await connection.query('DROP TABLE IF EXISTS workout_sessions');
    dropped.push('workout_sessions');

    console.log('  6. Dropping workout_template_exercises table...');
    await connection.query('DROP TABLE IF EXISTS workout_template_exercises');
    dropped.push('workout_template_exercises');

    console.log('  7. Dropping workout_templates table...');
    await connection.query('DROP TABLE IF EXISTS workout_templates');
    dropped.push('workout_templates');

    console.log('  8. Dropping user_rotation_states table...');
    await connection.query('DROP TABLE IF EXISTS user_rotation_states');
    dropped.push('user_rotation_states');

    console.log('  9. Dropping body_metrics table...');
    await connection.query('DROP TABLE IF EXISTS body_metrics');
    dropped.push('body_metrics');

    console.log('  10. Dropping exercises table...');
    await connection.query('DROP TABLE IF EXISTS exercises');
    dropped.push('exercises');

    console.log('  11. Dropping user_biometrics table...');
    await connection.query('DROP TABLE IF EXISTS user_biometrics');
    dropped.push('user_biometrics');

    console.log('  12. Removing schema_migrations record (phase5_fitness)...');
    await connection.query("DELETE FROM schema_migrations WHERE version = 'phase5_fitness'");
    dropped.push('schema_migrations:phase5_fitness');

    console.log('\n✅ Phase 5 Rollback completed successfully.');
    return { success: true, dropped };
  } catch (err) {
    console.error('❌ Rollback failed:', err.message);
    return { success: false, error: err.message, dropped };
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  rollbackPhase5().then(res => {
    if (!res.success) process.exit(1);
  });
}

module.exports = rollbackPhase5;
