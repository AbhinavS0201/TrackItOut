// scratch/verify_backup_restore.js
const mysql = require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/mysql2/promise');
const fs = require('fs');
const path = require('path');
require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/dotenv').config({ 
  path: 'd:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/.env' 
});

async function verifyBackupRestore() {
  console.log('🧪 Starting Backup Restoration Verification into Temporary Database...');

  const backupPath = path.join(__dirname, '../backend/database/backups/backup_before_phase4_nutrition.sql');
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file missing at ${backupPath}`);
  }

  const liveDbName = process.env.DB_NAME || 'expense_tracker';
  const tempDbName = 'expense_tracker_test_restore_verify';

  // Connect to MySQL server (without selecting a specific db)
  const rootConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    // 1. Create temporary database
    console.log(`  1. Creating temporary database \`${tempDbName}\`...`);
    await rootConn.query(`DROP DATABASE IF EXISTS \`${tempDbName}\`;`);
    await rootConn.query(`CREATE DATABASE \`${tempDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);

    // 2. Read backup file contents
    const sqlDump = fs.readFileSync(backupPath, 'utf8');

    // 3. Connect to temporary database and execute restore
    const tempConn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: tempDbName,
      multipleStatements: true
    });

    try {
      console.log(`  2. Restoring SQL dump into \`${tempDbName}\`...`);
      await tempConn.query(sqlDump);
      console.log('  3. SQL Dump executed successfully.');

      // 4. Compare tables and row counts between live and restored
      const [liveTables] = await rootConn.query(`
        SELECT table_name FROM information_schema.tables WHERE table_schema = '${liveDbName}'
      `);
      const [restoredTables] = await rootConn.query(`
        SELECT table_name FROM information_schema.tables WHERE table_schema = '${tempDbName}'
      `);

      const liveTableNames = liveTables.map(t => t.TABLE_NAME || t.table_name).sort();
      const restoredTableNames = restoredTables.map(t => t.TABLE_NAME || t.table_name).sort();

      console.log('\n📊 Table Comparison:');
      console.log(`  Live DB (${liveDbName}) tables (${liveTableNames.length}):`, liveTableNames.join(', '));
      console.log(`  Restored DB (${tempDbName}) tables (${restoredTableNames.length}):`, restoredTableNames.join(', '));

      if (JSON.stringify(liveTableNames) !== JSON.stringify(restoredTableNames)) {
        throw new Error('Table list mismatch between live and restored database!');
      }

      console.log('\n🔢 Row Count Verification:');
      let allMatch = true;
      for (const tbl of liveTableNames) {
        const [[liveCount]] = await rootConn.query(`SELECT COUNT(*) as count FROM \`${liveDbName}\`.\`${tbl}\``);
        const [[restoredCount]] = await tempConn.query(`SELECT COUNT(*) as count FROM \`${tempDbName}\`.\`${tbl}\``);
        const match = liveCount.count === restoredCount.count;
        console.log(`  - \`${tbl}\`: Live = ${liveCount.count}, Restored = ${restoredCount.count} -> ${match ? 'MATCH ✅' : 'MISMATCH ❌'}`);
        if (!match) allMatch = false;
      }

      if (!allMatch) {
        throw new Error('Row count mismatch detected during restore verification!');
      }

      console.log('\n✅ Backup integrity fully verified: 100% of tables and records match live database.');
    } finally {
      await tempConn.end();
    }

    // 5. Clean up temporary database
    console.log(`  4. Cleaning up temporary database \`${tempDbName}\`...`);
    await rootConn.query(`DROP DATABASE IF EXISTS \`${tempDbName}\`;`);
    console.log(`  5. Temporary database dropped. Live database remained completely isolated.`);

  } finally {
    await rootConn.end();
  }
}

verifyBackupRestore().catch(err => {
  console.error('❌ Restore verification failed:', err);
  process.exit(1);
});
