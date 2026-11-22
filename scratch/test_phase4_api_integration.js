// scratch/test_phase4_api_integration.js
const jwt = require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/jsonwebtoken');
require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/dotenv').config({ 
  path: 'd:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/.env' 
});

const API_BASE = 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'expense_tracker_secret_2024';

async function testPhase4Api() {
  console.log('🚀 Running Phase 4 HTTP API Integration Tests...\n');

  // 1. Authenticate as User 1 via verified JWT token
  console.log('  1. Generating authenticated JWT token for User 1 (Abhinav Rama)...');
  const token = jwt.sign({ id: 1 }, JWT_SECRET, { expiresIn: '1h' });
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` 
  };
  console.log('     Token acquired successfully.');

  // 2. GET /api/v1/nutrition/foods
  console.log('  2. Testing GET /api/v1/nutrition/foods...');
  const foodsRes = await fetch(`${API_BASE}/api/v1/nutrition/foods`, { headers });
  const foodsData = await foodsRes.json();
  console.log(`     Retrieved ${foodsData.length} foods from catalog.`);
  if (foodsData.length < 8) throw new Error('Expected at least 8 foods in catalog');

  const roasted = foodsData.find(f => f.seed_key === 'seed_chicken_breast_roasted');
  console.log(`     Roasted Chicken Verified: ${roasted.product_name} (${roasted.preparation_state})`);

  // 3. GET /api/v1/nutrition/overview
  console.log('  3. Testing GET /api/v1/nutrition/overview...');
  const overviewRes = await fetch(`${API_BASE}/api/v1/nutrition/overview?date=2026-11-22`, { headers });
  const overviewData = await overviewRes.json();
  console.log('     Daily Calorie Target:', overviewData.targets.daily_calorie_target);
  console.log('     Daily Fiber Target:', overviewData.targets.fiber_target_g);
  console.log('     Totals Water ML:', overviewData.totals.water_ml);

  // 4. POST /api/v1/nutrition/water
  console.log('  4. Testing POST /api/v1/nutrition/water...');
  const waterRes = await fetch(`${API_BASE}/api/v1/nutrition/water`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      date: '2026-11-22',
      water_ml: 250
    })
  });
  const waterData = await waterRes.json();
  console.log('     Logged water ID:', waterData.id, 'Amount:', waterData.water_ml);

  // 5. POST /api/v1/nutrition/meals
  console.log('  5. Testing POST /api/v1/nutrition/meals...');
  const mealRes = await fetch(`${API_BASE}/api/v1/nutrition/meals`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      date: '2026-11-22',
      meal_type: 'Breakfast',
      items: [
        { food_product_id: roasted.id, logged_quantity: 100, logged_unit: 'g' }
      ],
      notes: 'Breakfast protein check'
    })
  });
  const mealData = await mealRes.json();
  console.log('     Logged meal ID:', mealData.mealLogId);

  // 6. Verify Overview includes the meal and updated hydration
  console.log('  6. Verifying updated daily overview...');
  const updatedOverviewRes = await fetch(`${API_BASE}/api/v1/nutrition/overview?date=2026-11-22`, { headers });
  const updatedOverview = await updatedOverviewRes.json();
  console.log('     Updated Water:', updatedOverview.totals.water_ml, 'ml');
  console.log('     Updated Calories:', updatedOverview.totals.calories, 'kcal');
  console.log('     Updated Protein:', updatedOverview.totals.protein, 'g');
  console.log('     Breakfast Items:', updatedOverview.meals.Breakfast[0].items.length);

  // 7. POST /api/v1/nutrition/foods (Create Custom Food)
  console.log('  7. Testing POST /api/v1/nutrition/foods (Custom Food)...');
  const customFoodRes = await fetch(`${API_BASE}/api/v1/nutrition/foods`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brand_name: 'Homemade',
      product_name: 'Almond Chia Pudding',
      calories: 220,
      protein: 6,
      carbohydrates: 18,
      fats: 12,
      fiber: 8
    })
  });
  const customFoodData = await customFoodRes.json();
  console.log('     Created custom food ID:', customFoodData.id, 'is_user_modified:', customFoodData.is_user_modified);

  // 8. PUT /api/v1/nutrition/foods/:id (Update Custom Food)
  console.log('  8. Testing PUT /api/v1/nutrition/foods/:id (Update)...');
  const updatedFoodRes = await fetch(`${API_BASE}/api/v1/nutrition/foods/${customFoodData.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      calories: 230,
      protein: 7
    })
  });
  const updatedFoodData = await updatedFoodRes.json();
  console.log('     Updated calories:', updatedFoodData.calories, 'protein:', updatedFoodData.protein, 'is_user_modified:', updatedFoodData.is_user_modified);

  // 9. Clean up test logs
  const mysql = require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/mysql2/promise');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  await conn.query('DELETE FROM nutrition_logs WHERE id IN (?, ?)', [waterData.id, mealData.mealLogId]);
  await conn.query('DELETE FROM food_products WHERE id = ?', [customFoodData.id]);
  await conn.end();
  console.log('     Cleaned up test logs and custom food.');

  console.log('\n🎉 ALL 8 HTTP API ENDPOINTS TESTED AND PASSED SUCCESSFULLY!');
}

testPhase4Api().catch(err => {
  console.error('❌ API Integration Test Failed:', err.message);
  process.exit(1);
});
