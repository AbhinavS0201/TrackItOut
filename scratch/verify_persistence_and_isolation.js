// scratch/verify_persistence_and_isolation.js
const jwt = require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/jsonwebtoken');
const mysql = require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/mysql2/promise');
require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/dotenv').config({ 
  path: 'd:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/.env' 
});

const API_BASE = 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'expense_tracker_secret_2024';

async function runVerification() {
  console.log('🧪 Starting Persistence, Tenant Isolation & Copilot/Finance Audit...\n');

  const tokenUser1 = jwt.sign({ id: 1 }, JWT_SECRET, { expiresIn: '1h' });
  const tokenUser2 = jwt.sign({ id: 2 }, JWT_SECRET, { expiresIn: '1h' });

  const headers1 = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenUser1}` };
  const headers2 = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenUser2}` };

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // ---------------------------------------------------------
    // TEST 1: Nutrition Log Persistence
    // ---------------------------------------------------------
    console.log('--- TEST 1: Nutrition Log Persistence ---');
    const [foods] = await conn.query('SELECT id, product_name FROM food_products WHERE seed_key = "seed_chicken_breast_roasted"');
    const chickenId = foods[0].id;

    const logRes = await fetch(`${API_BASE}/api/v1/nutrition/meals`, {
      method: 'POST',
      headers: headers1,
      body: JSON.stringify({
        date: '2026-11-22',
        meal_type: 'Dinner',
        items: [{ food_product_id: chickenId, logged_quantity: 200, logged_unit: 'g' }],
        notes: 'Persistent Test Dinner'
      })
    });
    const logData = await logRes.json();
    console.log('  1. Logged meal via API. ID:', logData.mealLogId);

    // Verify in MySQL immediately
    const [dbLog] = await conn.query('SELECT * FROM nutrition_logs WHERE id = ?', [logData.mealLogId]);
    const [dbItems] = await conn.query('SELECT * FROM meal_food_items WHERE meal_log_id = ?', [logData.mealLogId]);
    console.log(`  2. Verified in MySQL: nutrition_logs count = ${dbLog.length}, meal_food_items count = ${dbItems.length}`);
    console.log(`     Food snapshot: ${dbItems[0].food_name_snapshot}, Calories: ${dbItems[0].calories} kcal, Prep: ${dbItems[0].preparation_state_snapshot}`);

    if (dbLog.length === 0 || dbItems.length === 0) {
      throw new Error('Meal log was NOT persisted in MySQL!');
    }

    // ---------------------------------------------------------
    // TEST 2: Tenant Isolation
    // ---------------------------------------------------------
    console.log('\n--- TEST 2: Multi-Tenant Isolation ---');
    // User 1 requests overview
    const overviewU1 = await (await fetch(`${API_BASE}/api/v1/nutrition/overview?date=2026-11-22`, { headers: headers1 })).json();
    console.log(`  1. User 1 Overview: Dinner meals count = ${overviewU1.meals.Dinner.length}, Calories = ${overviewU1.totals.calories} kcal`);

    // User 2 requests overview for same date
    const overviewU2 = await (await fetch(`${API_BASE}/api/v1/nutrition/overview?date=2026-11-22`, { headers: headers2 })).json();
    console.log(`  2. User 2 Overview: Dinner meals count = ${overviewU2.meals.Dinner.length}, Calories = ${overviewU2.totals.calories}`);
    if (overviewU2.meals.Dinner.length !== 0 || overviewU2.totals.calories !== null) {
      throw new Error('TENANT LEAK: User 2 was able to see User 1 nutrition records!');
    }
    console.log('  3. Isolation Confirmed: User 2 sees 0 meals and NULL calories.');

    // ---------------------------------------------------------
    // TEST 3: Finance API Operational Status
    // ---------------------------------------------------------
    console.log('\n--- TEST 3: Existing Finance API Operational Status ---');
    const accountsRes = await (await fetch(`${API_BASE}/api/v1/accounts`, { headers: headers1 })).json();
    console.log(`  1. GET /api/v1/accounts (User 1): Retrieved ${accountsRes.length} accounts.`);
    accountsRes.forEach(a => console.log(`     - Account ${a.id}: ${a.name} (Balance: ₹${a.current_balance})`));

    const financeSummaryRes = await (await fetch(`${API_BASE}/summary/1`, { headers: headers1 })).json();
    console.log(`  2. GET /summary/1: Total Income: ₹${financeSummaryRes.total_income}, Total Expenses: ₹${financeSummaryRes.total_expense}, Balance: ₹${financeSummaryRes.balance}`);

    // Clean up test dinner log
    await conn.query('DELETE FROM nutrition_logs WHERE id = ?', [logData.mealLogId]);
    console.log('\n🧹 Cleaned up persistent test dinner log.');

    console.log('\n✅ ALL VERIFICATION CHECKS PASSED.');

  } finally {
    await conn.end();
  }
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
