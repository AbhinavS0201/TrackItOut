// scratch/verify_phase4_complete.js
const mysql = require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/mysql2/promise');
require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/dotenv').config({ 
  path: 'd:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/.env' 
});

const { calculateItemNutrients, aggregateNutrients } = require('../backend/src/services/nutritionCalculator');
const nutritionService = require('../backend/src/services/nutritionService');

async function verifyAll() {
  console.log('🔍 Running Comprehensive Post-Migration Phase 4 Verification...\n');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'expense_tracker'
  });

  const report = {
    checks: [],
    errors: []
  };

  function assert(name, condition, details = '') {
    if (condition) {
      report.checks.push(`✅ [PASS] ${name} ${details ? '(' + details + ')' : ''}`);
      console.log(`✅ [PASS] ${name} ${details ? '(' + details + ')' : ''}`);
    } else {
      report.errors.push(`❌ [FAIL] ${name} ${details ? '(' + details + ')' : ''}`);
      console.error(`❌ [FAIL] ${name} ${details ? '(' + details + ')' : ''}`);
    }
  }

  try {
    // 1. Table Counts & Schema Version
    const [tables] = await conn.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'expense_tracker' ORDER BY table_name
    `);
    const tableNames = tables.map(t => t.TABLE_NAME || t.table_name);
    assert('Total Database Tables', tableNames.length === 12, `Found ${tableNames.length} tables: ${tableNames.join(', ')}`);

    const [migRows] = await conn.query("SELECT * FROM schema_migrations WHERE version = 'phase4_nutrition'");
    assert('Schema Migration Record', migRows.length === 1, `Version: ${migRows[0]?.version}, Applied: ${migRows[0]?.applied_at}`);

    // 2. Food Products Verification
    const [foods] = await conn.query('SELECT * FROM food_products ORDER BY id ASC');
    assert('Seeded Food Products Count', foods.length === 8, `Expected 8, Found ${foods.length}`);

    const roasted = foods.find(f => f.seed_key === 'seed_chicken_breast_roasted');
    assert('Roasted Chicken Exists', !!roasted, `ID: ${roasted?.id}`);
    assert('Roasted Chicken Prep State', roasted?.preparation_state === 'Roasted', `Actual: '${roasted?.preparation_state}'`);

    const duplicateCheck = new Set(foods.map(f => f.seed_key));
    assert('No Duplicate Seed Keys', duplicateCheck.size === foods.length, `${duplicateCheck.size} unique keys`);

    // Verification statuses
    const verifiedFoods = foods.filter(f => f.verification_status === 'Verified');
    const unverifiedFoods = foods.filter(f => f.verification_status === 'Unverified');
    assert('Verified Food Count', verifiedFoods.length === 5, `Expected 5 (BigMuscles + 4 USDA chickens), Found ${verifiedFoods.length}`);
    assert('Unverified Food Count', unverifiedFoods.length === 3, `Expected 3 (Pintola, Amul, Milky Mist), Found ${unverifiedFoods.length}`);

    // Check NULL handling on BigMuscles
    const bigMuscles = foods.find(f => f.seed_key === 'seed_bigmuscles_whey_belgian');
    assert('BigMuscles Serving Weight', bigMuscles?.serving_weight_g === '37.00', `Serving weight = ${bigMuscles?.serving_weight_g}g`);
    assert('BigMuscles Fiber is NULL', bigMuscles?.fiber === null, `Fiber = ${bigMuscles?.fiber}`);
    assert('BigMuscles Sodium is NULL', bigMuscles?.sodium_mg === null, `Sodium = ${bigMuscles?.sodium_mg}`);

    // 3. User Nutrition Targets Verification
    const [users] = await conn.query('SELECT id, name FROM users');
    const [targets] = await conn.query('SELECT * FROM nutrition_targets ORDER BY user_id ASC');
    assert('Nutrition Targets User Coverage', targets.length === users.length, `Expected ${users.length} targets, Found ${targets.length}`);
    const user1Target = targets.find(t => t.user_id === 1);
    assert('User 1 Calorie Target', user1Target?.daily_calorie_target === 2200, `${user1Target?.daily_calorie_target} kcal`);
    assert('User 1 Fiber Target', user1Target?.fiber_target_g === '30.00', `${user1Target?.fiber_target_g} g`);

    // 4. Phase 3 Table Integrity & Account Balances
    const [[accCount]] = await conn.query('SELECT COUNT(*) as c FROM accounts');
    const [[budCount]] = await conn.query('SELECT COUNT(*) as c FROM category_budgets');
    const [[recCount]] = await conn.query('SELECT COUNT(*) as c FROM recurring_transactions');
    const [[scCount]] = await conn.query('SELECT COUNT(*) as c FROM savings_contributions');
    const [[sgCount]] = await conn.query('SELECT COUNT(*) as c FROM savings_goals');
    const [[txCount]] = await conn.query('SELECT COUNT(*) as c FROM transactions');
    const [[uCount]] = await conn.query('SELECT COUNT(*) as c FROM users');

    assert('Phase 3 accounts Count Intact', accCount.c === 10, `${accCount.c} rows`);
    assert('Phase 3 category_budgets Count Intact', budCount.c === 5, `${budCount.c} rows`);
    assert('Phase 3 recurring_transactions Count Intact', recCount.c === 3, `${recCount.c} rows`);
    assert('Phase 3 savings_contributions Count Intact', scCount.c === 2, `${scCount.c} rows`);
    assert('Phase 3 savings_goals Count Intact', sgCount.c === 3, `${sgCount.c} rows`);
    assert('Phase 3 transactions Count Intact', txCount.c === 9, `${txCount.c} rows`);
    assert('Phase 3 users Count Intact', uCount.c === 7, `${uCount.c} rows`);

    const [[user1Bank]] = await conn.query('SELECT current_balance FROM accounts WHERE id = 1');
    assert('User 1 Primary Bank Balance Intact', user1Bank.current_balance === '80800.00', `₹${user1Bank.current_balance}`);

    // 5. Test Nutrition Calculation Engine & Density Conversions
    // Case A: 250ml Amul Rose Lassi (per_100ml basis) -> density not required, scale = 2.5
    const amul = foods.find(f => f.seed_key === 'seed_amul_rose_lassi_200ml');
    const amulCalc = calculateItemNutrients(amul, 250, 'ml');
    assert('Amul 250ml Calorie Calc (2.5x)', amulCalc.calories === 133.75, `${amulCalc.calories} kcal`);
    assert('Amul 250ml Protein Calc (2.5x)', amulCalc.protein === 18.75, `${amulCalc.protein} g`);

    // Case B: 250g Amul Rose Lassi (mass to volume) -> requires density 1.0350
    const amulMassCalc = calculateItemNutrients(amul, 250, 'g');
    const expectedVol = 250 / 1.0350;
    const expectedCals = parseFloat((53.50 * (expectedVol / 100)).toFixed(2));
    assert('Amul 250g Mass-to-Volume Calc', amulMassCalc.calories === expectedCals, `${amulMassCalc.calories} kcal (expected ${expectedCals})`);

    // Case C: Volume to Mass without density fails cleanly
    let rejectedNoDensity = false;
    try {
      calculateItemNutrients(roasted, 100, 'ml'); // chicken has per_100g basis, density is null
    } catch (e) {
      rejectedNoDensity = true;
    }
    assert('Reject Volume-to-Mass without Density', rejectedNoDensity, 'Correctly threw 400 Bad Request error');

    // Case D: NULL nutrient preservation in calculations & aggregations
    const bmCalc = calculateItemNutrients(bigMuscles, 2, 'scoop'); // 2 scoops
    assert('BigMuscles 2 scoops Protein (50g)', bmCalc.protein === 50.00, `${bmCalc.protein} g`);
    assert('BigMuscles 2 scoops Fiber remains NULL', bmCalc.fiber === null, `Fiber = ${bmCalc.fiber}`);

    const aggregated = aggregateNutrients([amulCalc, bmCalc]);
    assert('Aggregated Fiber Missing Indicator', aggregated.fiber_is_complete === false && aggregated.fiber_missing_count === 1, 
      `complete: ${aggregated.fiber_is_complete}, missing: ${aggregated.fiber_missing_count}`);

    // 6. Test Logging Meal & Provenance Snapshot (using test user 2)
    const testUserId = 2;
    const testDate = '2026-11-22';
    const logRes = await nutritionService.logMeal(testUserId, testDate, 'Lunch', [
      { food_product_id: roasted.id, logged_quantity: 150, logged_unit: 'g' },
      { food_product_id: bigMuscles.id, logged_quantity: 1, logged_unit: 'scoop' }
    ], 0, 'Post-workout lunch');
    assert('Meal Log Execution', logRes.success === true, `Meal Log ID: ${logRes.mealLogId}`);

    // Verify snapshot in meal_food_items
    const [snapshotItems] = await conn.query('SELECT * FROM meal_food_items WHERE meal_log_id = ?', [logRes.mealLogId]);
    assert('Snapshot Items Stored', snapshotItems.length === 2, `Found ${snapshotItems.length} snapshot items`);
    const chickenSnap = snapshotItems.find(i => i.food_product_id === roasted.id);
    assert('Snapshot Food Name Intact', chickenSnap.food_name_snapshot === 'Chicken Breast', chickenSnap.food_name_snapshot);
    assert('Snapshot Prep State Intact', chickenSnap.preparation_state_snapshot === 'Roasted', chickenSnap.preparation_state_snapshot);
    assert('Snapshot Nutrient Status Intact', chickenSnap.nutrient_status === 'Verified', chickenSnap.nutrient_status);
    assert('Snapshot Scaled Calories (1.5x 165)', chickenSnap.calories === '247.50', `${chickenSnap.calories} kcal`);

    // Verify daily overview
    const overview = await nutritionService.getDailyOverview(testUserId, testDate);
    assert('Daily Overview Retrieval', !!overview, `Date: ${overview.date}`);
    assert('Daily Overview Meals Grouping', overview.meals.Lunch.length === 1, `Lunch meal present`);

    // 7. Test Hydration Logging
    const waterLog = await nutritionService.logWater(testUserId, testDate, 500);
    assert('Hydration Log Execution', waterLog.water_ml === 500, `Logged 500ml`);
    const overviewAfterWater = await nutritionService.getDailyOverview(testUserId, testDate);
    assert('Hydration in Daily Overview', overviewAfterWater.totals.water_ml === 500, `${overviewAfterWater.totals.water_ml} ml`);

    // Clean up test meal & water log
    await conn.query('DELETE FROM nutrition_logs WHERE id IN (?, ?)', [logRes.mealLogId, waterLog.id]);
    console.log('🧹 Cleaned up verification meal & water log.');

    // 8. Test Product Ownership Isolation
    const customFood = await nutritionService.createCustomFood(testUserId, {
      brand_name: 'Test Kitchen',
      product_name: 'Custom Protein Cookie',
      calories: 250,
      protein: 15,
      carbohydrates: 20,
      fats: 8
    });
    assert('Custom Food Creation', customFood.is_custom === 1 && customFood.user_id === testUserId, `ID: ${customFood.id}`);
    assert('Custom Food is_user_modified Flag', customFood.is_user_modified === 1, `is_user_modified = 1`);

    // User 1 cannot view or log User 2's custom food in search
    const user1Search = await nutritionService.searchFoods(1, 'Custom Protein Cookie');
    assert('Custom Food Privacy Isolation', user1Search.length === 0, `User 1 search returned 0 items`);

    // Clean up test custom food
    await conn.query('DELETE FROM food_products WHERE id = ?', [customFood.id]);
    console.log('🧹 Cleaned up verification custom food.');

    console.log(`\n================ FINAL RESULTS ================`);
    console.log(`Total Passed Checks: ${report.checks.length}`);
    console.log(`Total Failed Checks: ${report.errors.length}`);

    if (report.errors.length > 0) {
      throw new Error(`Verification had ${report.errors.length} failed checks.`);
    }

  } finally {
    await conn.end();
  }
}

verifyAll().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
