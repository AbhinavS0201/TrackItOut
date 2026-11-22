// backend/database/rollback_phase4.js
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function rollbackPhase4() {
  console.log('⚠️ INITIATING PHASE 4 NUTRITION ROLLBACK AUDIT...');

  // 1. Mandatory Safety Check: Require explicit environment variable authorization
  if (process.env.CONFIRM_DESTRUCTIVE_ROLLBACK !== 'YES') {
    console.error(`
🛑 SAFETY BLOCK: Destructive rollback aborted!
Rollback will permanently DROP tables: 'meal_food_items', 'nutrition_logs', 'food_products', and 'nutrition_targets'.
To authorize this destructive rollback, run with environment variable:
  CONFIRM_DESTRUCTIVE_ROLLBACK=YES node backend/database/rollback_phase4.js
`);
    process.exit(1);
  }

  // 2. Mandatory Backup Check
  const backupPath = path.join(__dirname, 'backups/backup_before_phase4_nutrition.sql');
  if (!fs.existsSync(backupPath)) {
    console.error(`
🛑 SAFETY BLOCK: Required backup file was NOT found at:
${backupPath}
A valid verified database backup must exist before dropping tables!
`);
    process.exit(1);
  }

  const backupStats = fs.statSync(backupPath);
  if (backupStats.size === 0) {
    console.error(`🛑 SAFETY BLOCK: Backup file at ${backupPath} is empty (0 bytes)!`);
    process.exit(1);
  }
  console.log(`✅ Verified database backup exists (${(backupStats.size / 1024).toFixed(2)} KB).`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'expense_tracker',
    multipleStatements: true
  });

  try {
    console.log('🔄 Executing Dependency-Safe Table Drop Sequence...');

    // Drop child table referencing nutrition_logs and food_products first
    console.log('  1. Dropping meal_food_items...');
    await connection.query('DROP TABLE IF EXISTS meal_food_items;');

    // Drop nutrition_logs referencing users
    console.log('  2. Dropping nutrition_logs...');
    await connection.query('DROP TABLE IF EXISTS nutrition_logs;');

    // Drop food_products referencing users
    console.log('  3. Dropping food_products...');
    await connection.query('DROP TABLE IF EXISTS food_products;');

    // Drop nutrition_targets referencing users
    console.log('  4. Dropping nutrition_targets...');
    await connection.query('DROP TABLE IF EXISTS nutrition_targets;');

    // Remove migration audit entry if schema_migrations exists
    console.log('  5. Removing phase4_nutrition migration record...');
    const [migTable] = await connection.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'expense_tracker' AND table_name = 'schema_migrations'
    `);
    if (migTable.length > 0) {
      await connection.query("DELETE FROM schema_migrations WHERE version = 'phase4_nutrition';");
    }

    console.log('✅ Phase 4 Rollback completed safely. All Phase 3 finance records remain intact.');
  } catch (err) {
    console.error('❌ Rollback encountered error:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  rollbackPhase4();
}

module.exports = rollbackPhase4;
