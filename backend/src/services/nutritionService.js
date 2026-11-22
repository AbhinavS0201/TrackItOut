// backend/src/services/nutritionService.js
const pool = require('../config/db');
const { calculateItemNutrients, aggregateNutrients } = require('./nutritionCalculator');

class NutritionService {
  /**
   * Search food products: returns global curated catalog + user's own custom products
   */
  async searchFoods(userId, query = '') {
    const searchTerm = `%${query.trim()}%`;
    const [rows] = await pool.query(
      `SELECT * FROM food_products 
       WHERE (user_id IS NULL OR user_id = ?) 
         AND (product_name LIKE ? OR brand_name LIKE ? OR variant LIKE ?)
       ORDER BY (user_id IS NOT NULL) DESC, verification_status = 'Verified' DESC, product_name ASC
       LIMIT 50`,
      [userId, searchTerm, searchTerm, searchTerm]
    );
    return rows;
  }

  /**
   * Get single food product by ID (enforcing tenant isolation)
   */
  async getFoodById(userId, foodId) {
    const [rows] = await pool.query(
      `SELECT * FROM food_products 
       WHERE id = ? AND (user_id IS NULL OR user_id = ?)`,
      [foodId, userId]
    );
    return rows[0] || null;
  }

  /**
   * Create custom food product in user library
   */
  async createCustomFood(userId, data) {
    const {
      brand_name,
      product_name,
      variant = null,
      preparation_state = 'Packaged',
      nutrition_basis = 'per_100g',
      serving_quantity = null,
      serving_unit = null,
      serving_weight_g = null,
      serving_volume_ml = null,
      density_g_per_ml = null,
      calories = null,
      protein = null,
      carbohydrates = null,
      fats = null,
      fiber = null,
      sugar = null,
      sodium_mg = null,
      verification_status = 'User_Approved',
      source_name = 'User Input',
      source_reference = null
    } = data;

    const [result] = await pool.query(
      `INSERT INTO food_products (
        user_id, seed_key, brand_name, product_name, variant, preparation_state, nutrition_basis,
        serving_quantity, serving_unit, serving_weight_g, serving_volume_ml, density_g_per_ml,
        calories, protein, carbohydrates, fats, fiber, sugar, sodium_mg,
        verification_status, source_name, source_reference, is_custom, is_user_modified
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      [
        userId, brand_name, product_name, variant, preparation_state, nutrition_basis,
        serving_quantity, serving_unit, serving_weight_g, serving_volume_ml, density_g_per_ml,
        calories, protein, carbohydrates, fats, fiber, sugar, sodium_mg,
        verification_status, source_name, source_reference
      ]
    );

    return this.getFoodById(userId, result.insertId);
  }

  /**
   * Update an existing food product.
   * STRICT AUDIT RULE: Every update path MUST set is_user_modified = 1!
   * Applies to nutrient edits, serving changes, source changes and verification-status changes.
   */
  async updateFoodProduct(userId, foodId, data) {
    // Check if food exists and user has rights
    const [rows] = await pool.query(
      `SELECT * FROM food_products WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND is_custom = 0))`,
      [foodId, userId]
    );
    if (rows.length === 0) {
      throw new Error('Food product not found or unauthorized');
    }

    const target = rows[0];

    // If modifying a global catalog item, fork it into a custom user product to protect the global catalog:
    let targetId = foodId;
    let targetUserId = userId;
    if (target.user_id === null) {
      const [forkResult] = await pool.query(
        `INSERT INTO food_products (
          user_id, seed_key, brand_name, product_name, variant, preparation_state, nutrition_basis,
          serving_quantity, serving_unit, serving_weight_g, serving_volume_ml, density_g_per_ml,
          calories, protein, carbohydrates, fats, fiber, sugar, sodium_mg,
          verification_status, source_name, source_reference, is_custom, is_user_modified
        ) SELECT ?, NULL, brand_name, product_name, variant, preparation_state, nutrition_basis,
                 serving_quantity, serving_unit, serving_weight_g, serving_volume_ml, density_g_per_ml,
                 calories, protein, carbohydrates, fats, fiber, sugar, sodium_mg,
                 'User_Approved', 'User Modified', source_reference, 1, 1
          FROM food_products WHERE id = ?`,
        [userId, foodId]
      );
      targetId = forkResult.insertId;
    }

    // Explicitly update all fields and MANDATORILY set is_user_modified = 1
    const {
      brand_name = target.brand_name,
      product_name = target.product_name,
      variant = target.variant,
      preparation_state = target.preparation_state,
      nutrition_basis = target.nutrition_basis,
      serving_quantity = target.serving_quantity,
      serving_unit = target.serving_unit,
      serving_weight_g = target.serving_weight_g,
      serving_volume_ml = target.serving_volume_ml,
      density_g_per_ml = target.density_g_per_ml,
      calories = target.calories,
      protein = target.protein,
      carbohydrates = target.carbohydrates,
      fats = target.fats,
      fiber = target.fiber,
      sugar = target.sugar,
      sodium_mg = target.sodium_mg,
      verification_status = 'User_Approved',
      source_name = target.source_name,
      source_reference = target.source_reference
    } = data;

    await pool.query(
      `UPDATE food_products SET
        brand_name = ?,
        product_name = ?,
        variant = ?,
        preparation_state = ?,
        nutrition_basis = ?,
        serving_quantity = ?,
        serving_unit = ?,
        serving_weight_g = ?,
        serving_volume_ml = ?,
        density_g_per_ml = ?,
        calories = ?,
        protein = ?,
        carbohydrates = ?,
        fats = ?,
        fiber = ?,
        sugar = ?,
        sodium_mg = ?,
        verification_status = ?,
        source_name = ?,
        source_reference = ?,
        is_user_modified = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?`,
      [
        brand_name, product_name, variant, preparation_state, nutrition_basis,
        serving_quantity, serving_unit, serving_weight_g, serving_volume_ml, density_g_per_ml,
        calories, protein, carbohydrates, fats, fiber, sugar, sodium_mg,
        verification_status, source_name, source_reference,
        targetId, targetUserId
      ]
    );

    return this.getFoodById(userId, targetId);
  }

  /**
   * Log a meal with items (enforcing atomic insertion and historical snapshots)
   */
  async logMeal(userId, date, mealType, items = [], waterMl = 0, notes = '') {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Create or get nutrition_log header
      const [logResult] = await connection.query(
        `INSERT INTO nutrition_logs (user_id, date, meal_type, water_ml, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, date, mealType, waterMl, notes]
      );
      const mealLogId = logResult.insertId;

      // 2. Insert items if present
      for (const item of items) {
        let product;
        if (item.food_product_id) {
          const [pRows] = await connection.query(
            `SELECT * FROM food_products WHERE id = ? AND (user_id IS NULL OR user_id = ?)`,
            [item.food_product_id, userId]
          );
          if (pRows.length === 0) {
            throw new Error(`Unauthorized or missing food product ID ${item.food_product_id}`);
          }
          product = pRows[0];
        } else {
          // Inline custom item: create on the fly as user custom product
          const [createRes] = await connection.query(
            `INSERT INTO food_products (
              user_id, seed_key, brand_name, product_name, variant, preparation_state, nutrition_basis,
              serving_quantity, serving_unit, serving_weight_g, serving_volume_ml, density_g_per_ml,
              calories, protein, carbohydrates, fats, fiber, sugar, sodium_mg,
              verification_status, source_name, source_reference, is_custom, is_user_modified
            ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
            [
              userId, item.brand_name || 'Generic', item.product_name, item.variant || null,
              item.preparation_state || 'Packaged', item.nutrition_basis || 'per_100g',
              item.serving_quantity || null, item.serving_unit || null, item.serving_weight_g || null,
              item.serving_volume_ml || null, item.density_g_per_ml || null,
              item.calories || null, item.protein || null, item.carbohydrates || null,
              item.fats || null, item.fiber || null, item.sugar || null, item.sodium_mg || null,
              item.verification_status || 'User_Approved', 'User Meal Entry', null
            ]
          );
          const [newProduct] = await connection.query(`SELECT * FROM food_products WHERE id = ?`, [createRes.insertId]);
          product = newProduct[0];
        }

        // Calculate scaled nutrients
        const calculated = calculateItemNutrients(product, item.logged_quantity, item.logged_unit);

        // Derive nutrient status: if product is Verified, status is Verified; otherwise Unverified / User_Approved
        const derivedStatus = product.verification_status === 'Verified' ? 'Verified' : (product.verification_status || 'Unverified');

        // Insert historical snapshot in meal_food_items
        await connection.query(
          `INSERT INTO meal_food_items (
            meal_log_id, food_product_id, logged_quantity, logged_unit,
            normalized_quantity, normalized_unit,
            food_name_snapshot, brand_snapshot, variant_snapshot, preparation_state_snapshot,
            nutrition_basis_snapshot, serving_quantity_snapshot, serving_unit_snapshot,
            serving_weight_g_snapshot, serving_volume_ml_snapshot, density_g_per_ml_snapshot,
            source_name_snapshot, source_reference_snapshot,
            calories, protein, carbohydrates, fats, fiber, sugar, sodium_mg,
            nutrient_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            mealLogId, product.id, item.logged_quantity, item.logged_unit,
            calculated.normalizedQuantity, calculated.normalizedUnit,
            product.product_name, product.brand_name, product.variant, product.preparation_state,
            product.nutrition_basis, product.serving_quantity, product.serving_unit,
            product.serving_weight_g, product.serving_volume_ml, product.density_g_per_ml,
            product.source_name, product.source_reference,
            calculated.calories, calculated.protein, calculated.carbohydrates, calculated.fats,
            calculated.fiber, calculated.sugar, calculated.sodium_mg,
            derivedStatus
          ]
        );
      }

      await connection.commit();
      return { mealLogId, success: true };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Log quick water intake
   */
  async logWater(userId, date, waterMl) {
    const ml = parseInt(waterMl, 10);
    if (isNaN(ml) || ml <= 0) {
      throw new Error('Invalid water amount');
    }
    const [result] = await pool.query(
      `INSERT INTO nutrition_logs (user_id, date, meal_type, water_ml, notes)
       VALUES (?, ?, 'Water', ?, 'Quick water log')`,
      [userId, date, ml]
    );
    return { id: result.insertId, water_ml: ml };
  }

  /**
   * Get complete daily nutrition overview
   */
  async getDailyOverview(userId, date) {
    // 1. Get targets
    const [targetRows] = await pool.query(
      `SELECT * FROM nutrition_targets WHERE user_id = ?`,
      [userId]
    );
    const targets = targetRows[0] || {
      daily_calorie_target: 2200,
      protein_target_g: 130.00,
      carbs_target_g: 240.00,
      fats_target_g: 65.00,
      fiber_target_g: 30.00,
      water_target_ml: 3000
    };

    // 2. Get all meal logs for the date
    const [mealLogs] = await pool.query(
      `SELECT * FROM nutrition_logs WHERE user_id = ? AND date = ? ORDER BY id ASC`,
      [userId, date]
    );

    // 3. Get all food items across those logs
    const logIds = mealLogs.map(l => l.id);
    let allItems = [];
    if (logIds.length > 0) {
      const [items] = await pool.query(
        `SELECT * FROM meal_food_items WHERE meal_log_id IN (?) ORDER BY id ASC`,
        [logIds]
      );
      allItems = items;
    }

    // 4. Calculate total hydration
    const totalWaterMl = mealLogs
      .filter(l => l.meal_type === 'Water')
      .reduce((sum, l) => sum + (l.water_ml || 0), 0);

    // 5. Aggregate nutrients deterministically
    const aggregated = aggregateNutrients(allItems);

    // 6. Group items by meal
    const meals = {
      Breakfast: [],
      Lunch: [],
      Dinner: [],
      Snacks: []
    };

    for (const log of mealLogs) {
      if (log.meal_type !== 'Water') {
        const logItems = allItems.filter(i => i.meal_log_id === log.id);
        meals[log.meal_type] = meals[log.meal_type] || [];
        meals[log.meal_type].push({
          id: log.id,
          notes: log.notes,
          items: logItems,
          meal_totals: aggregateNutrients(logItems)
        });
      }
    }

    return {
      date,
      targets,
      totals: {
        ...aggregated,
        water_ml: totalWaterMl
      },
      meals
    };
  }

  /**
   * Update user nutrition targets
   */
  async updateTargets(userId, targets) {
    const {
      daily_calorie_target = 2200,
      protein_target_g = 130.00,
      carbs_target_g = 240.00,
      fats_target_g = 65.00,
      fiber_target_g = 30.00,
      water_target_ml = 3000
    } = targets;

    await pool.query(
      `INSERT INTO nutrition_targets (
        user_id, daily_calorie_target, protein_target_g, carbs_target_g, fats_target_g, fiber_target_g, water_target_ml
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        daily_calorie_target = VALUES(daily_calorie_target),
        protein_target_g = VALUES(protein_target_g),
        carbs_target_g = VALUES(carbs_target_g),
        fats_target_g = VALUES(fats_target_g),
        fiber_target_g = VALUES(fiber_target_g),
        water_target_ml = VALUES(water_target_ml),
        updated_at = CURRENT_TIMESTAMP`,
      [userId, daily_calorie_target, protein_target_g, carbs_target_g, fats_target_g, fiber_target_g, water_target_ml]
    );

    const [rows] = await pool.query('SELECT * FROM nutrition_targets WHERE user_id = ?', [userId]);
    return rows[0];
  }
}

module.exports = new NutritionService();
