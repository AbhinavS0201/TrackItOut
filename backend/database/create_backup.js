// backend/database/create_backup.js
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function createBackup(customFilename) {
  const filename = customFilename || 'backup_before_phase4_nutrition.sql';
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = path.join(backupDir, filename);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'expense_tracker'
  });

  try {
    let sqlDump = `-- TrackItOut MySQL Backup\n-- Generated: ${new Date().toISOString()}\n-- Database: expense_tracker\n\n`;
    sqlDump += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    const [tables] = await connection.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'expense_tracker'
    `);

    for (const t of tables) {
      const tableName = t.TABLE_NAME || t.table_name;
      // Get CREATE TABLE
      const [[createResult]] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      const createSql = createResult['Create Table'];
      sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      sqlDump += `${createSql};\n\n`;

      // Get rows
      const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
      if (rows.length > 0) {
        for (const row of rows) {
          const keys = Object.keys(row).map(k => `\`${k}\``).join(', ');
          const values = Object.values(row).map(val => {
            if (val === null) return 'NULL';
            if (typeof val === 'number') return val;
            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            if (typeof val === 'object') return connection.escape(JSON.stringify(val));
            return connection.escape(val);
          }).join(', ');
          sqlDump += `INSERT INTO \`${tableName}\` (${keys}) VALUES (${values});\n`;
        }
        sqlDump += `\n`;
      }
    }

    sqlDump += `SET FOREIGN_KEY_CHECKS = 1;\n`;

    fs.writeFileSync(backupPath, sqlDump, 'utf8');
    const stats = fs.statSync(backupPath);
    console.log(`✅ Backup created successfully at: ${backupPath} (${(stats.size / 1024).toFixed(2)} KB)`);
    return backupPath;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  createBackup().catch(err => {
    console.error('❌ Backup generation failed:', err);
    process.exit(1);
  });
}

module.exports = createBackup;
