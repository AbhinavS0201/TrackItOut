const mysql = require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/mysql2/promise');
require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/dotenv').config({ 
  path: 'd:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/.env' 
});

async function checkStatus() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'expense_tracker'
  });

  const [tables] = await conn.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'expense_tracker'
    ORDER BY table_name
  `);

  console.log('=== CURRENT LIVE DATABASE TABLES AND ROW COUNTS ===');
  for (const t of tables) {
    const tableName = t.TABLE_NAME || t.table_name;
    const [[countRes]] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
    console.log(`  - \`${tableName}\`: ${countRes.cnt} rows`);
  }

  // Also verify User 1 and User 2 balances
  const [accounts] = await conn.query('SELECT id, user_id, name, type, current_balance FROM accounts');
  console.log('\n=== CURRENT ACCOUNTS & BALANCES ===');
  accounts.forEach(a => console.log(`  Account ${a.id} (User ${a.user_id}, ${a.name}, ${a.type}): ₹${a.current_balance}`));

  await conn.end();
}
checkStatus().catch(console.error);
