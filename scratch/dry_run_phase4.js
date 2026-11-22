// scratch/dry_run_phase4.js
const mysql = require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/mysql2/promise');
const fs = require('fs');
const path = require('path');
require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/dotenv').config({ 
  path: 'd:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/.env' 
});

async function dryRunPhase4() {
  console.log('🔍 Executing Final Phase 4 Non-Destructive Migration Dry-Run...\n');

  const backupPath = path.join(__dirname, '../backend/database/backups/backup_before_phase4_nutrition.sql');
  const backupExists = fs.existsSync(backupPath);
  let backupSize = 0;
  if (backupExists) {
    backupSize = fs.statSync(backupPath).size;
  }
  console.log(`🛡️ Preflight Backup Check: ${backupExists ? 'EXISTS' : 'MISSING'} (${(backupSize / 1024).toFixed(2)} KB)`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'expense_tracker'
  });

  try {
    // 1. Current Tables
    const [tables] = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'expense_tracker'
    `);
    const tableList = tables.map(t => t.TABLE_NAME || t.table_name).sort();
    console.log('📊 Current Live Tables in expense_tracker (' + tableList.length + ' tables):', tableList.join(', '));

    // 2. Users
    const [users] = await connection.query('SELECT id, name, email FROM users');
    console.log(`👥 Target Users for Dynamic Seeding: ${users.length} users verified.`);

    // 3. Confirm row counts of original 7 tables
    console.log('\n🔢 Current Record Counts across original Phase 3 tables:');
    for (const tbl of tableList) {
      const [[countRes]] = await connection.query(`SELECT COUNT(*) as cnt FROM \`${tbl}\``);
      console.log(`  - \`${tbl}\`: ${countRes.cnt} rows`);
    }

    // 4. Confirm zero-mutation state
    console.log('\n🔒 CONFIRMATION: This dry-run does NOT execute DDL, does NOT insert records, and changes NOTHING in MySQL.');

    console.log('\n================ EXECUTION SEQUENCE & STEP-BY-STEP SQL ================');
    console.log(`
[Preflight 1] Backup Verification: Checks presence and size of backup_before_phase4_nutrition.sql
[Preflight 2] Users Verification: Ensures users table exists
[Preflight 3] Comprehensive Schema Validation:
  - Validates column names, types (including ENUMs & decimals), nullability
  - Validates primary keys, unique constraints, foreign keys, and indexes
  - If existing table differs from Phase 4 specification, migration halts immediately.
  - If table does not yet exist, allows clean creation.

[Step 1] DDL on schema_migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

[Step 2] DDL on food_products (Includes is_user_modified TINYINT(1) DEFAULT 0)
CREATE TABLE IF NOT EXISTS food_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  seed_key VARCHAR(120) NULL UNIQUE,
  brand_name VARCHAR(100) NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  variant VARCHAR(100) NULL,
  preparation_state ENUM('Raw', 'Cooked', 'Boiled', 'Steamed', 'Grilled', 'Baked', 'Fried', 'Packaged', 'Stewed') NOT NULL DEFAULT 'Packaged',
  nutrition_basis ENUM('per_100g', 'per_100ml', 'per_serving') NOT NULL DEFAULT 'per_100g',
  serving_quantity DECIMAL(8,2) NULL,
  serving_unit VARCHAR(50) NULL,
  serving_weight_g DECIMAL(8,2) NULL,
  serving_volume_ml DECIMAL(8,2) NULL,
  density_g_per_ml DECIMAL(8,4) NULL,
  calories DECIMAL(8,2) NULL,
  protein DECIMAL(8,2) NULL,
  carbohydrates DECIMAL(8,2) NULL,
  fats DECIMAL(8,2) NULL,
  fiber DECIMAL(8,2) NULL,
  sugar DECIMAL(8,2) NULL,
  sodium_mg DECIMAL(8,2) NULL,
  verification_status ENUM('Verified', 'User_Approved', 'Estimated', 'OCR_Confirmed', 'Unverified') NOT NULL DEFAULT 'Unverified',
  source_name VARCHAR(150) NOT NULL,
  source_reference VARCHAR(255) NULL,
  is_custom TINYINT(1) NOT NULL DEFAULT 0,
  is_user_modified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_food_products_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_food_search (product_name, brand_name),
  INDEX idx_food_user (user_id, is_custom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

[Step 3] DDL on nutrition_logs (Consolidates meals + hydration)
CREATE TABLE IF NOT EXISTS nutrition_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  meal_type ENUM('Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Water') NOT NULL,
  water_ml INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_nutrition_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_date_meal (user_id, date, meal_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

[Step 4] DDL on meal_food_items (Full immutable snapshot)
CREATE TABLE IF NOT EXISTS meal_food_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  meal_log_id INT NOT NULL,
  food_product_id INT NULL,
  logged_quantity DECIMAL(8,2) NOT NULL,
  logged_unit VARCHAR(50) NOT NULL,
  normalized_quantity DECIMAL(8,2) NOT NULL,
  normalized_unit ENUM('g', 'ml', 'serving') NOT NULL,
  food_name_snapshot VARCHAR(150) NOT NULL,
  brand_snapshot VARCHAR(100) NOT NULL,
  variant_snapshot VARCHAR(100) NULL,
  preparation_state_snapshot VARCHAR(50) NOT NULL DEFAULT 'Packaged',
  nutrition_basis_snapshot ENUM('per_100g', 'per_100ml', 'per_serving') NOT NULL,
  serving_quantity_snapshot DECIMAL(8,2) NULL,
  serving_unit_snapshot VARCHAR(50) NULL,
  serving_weight_g_snapshot DECIMAL(8,2) NULL,
  serving_volume_ml_snapshot DECIMAL(8,2) NULL,
  density_g_per_ml_snapshot DECIMAL(8,4) NULL,
  source_name_snapshot VARCHAR(150) NOT NULL,
  source_reference_snapshot VARCHAR(255) NULL,
  calories DECIMAL(8,2) NULL,
  protein DECIMAL(8,2) NULL,
  carbohydrates DECIMAL(8,2) NULL,
  fats DECIMAL(8,2) NULL,
  fiber DECIMAL(8,2) NULL,
  sugar DECIMAL(8,2) NULL,
  sodium_mg DECIMAL(8,2) NULL,
  nutrient_status ENUM('Verified', 'User_Approved', 'Estimated', 'OCR_Confirmed', 'Unverified') NOT NULL DEFAULT 'Unverified',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_meal_items_log FOREIGN KEY (meal_log_id) REFERENCES nutrition_logs(id) ON DELETE CASCADE,
  CONSTRAINT fk_meal_items_product FOREIGN KEY (food_product_id) REFERENCES food_products(id) ON DELETE SET NULL,
  INDEX idx_meal_items_log (meal_log_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

[Step 5] DDL on nutrition_targets (Includes fiber_target_g)
CREATE TABLE IF NOT EXISTS nutrition_targets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  daily_calorie_target INT NOT NULL DEFAULT 2200,
  protein_target_g DECIMAL(6,2) NOT NULL DEFAULT 130.00,
  carbs_target_g DECIMAL(6,2) NOT NULL DEFAULT 240.00,
  fats_target_g DECIMAL(6,2) NOT NULL DEFAULT 65.00,
  fiber_target_g DECIMAL(6,2) NOT NULL DEFAULT 30.00,
  water_target_ml INT NOT NULL DEFAULT 3000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_nutrition_targets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

[Step 6] DML on food_products (Protected User Edits via IF(is_user_modified = 1, col, VALUES(col)))
INSERT INTO food_products (seed_key, ...) VALUES (...)
ON DUPLICATE KEY UPDATE
  brand_name = IF(is_user_modified = 1, brand_name, VALUES(brand_name)),
  product_name = IF(is_user_modified = 1, product_name, VALUES(product_name)),
  variant = IF(is_user_modified = 1, variant, VALUES(variant)),
  preparation_state = IF(is_user_modified = 1, preparation_state, VALUES(preparation_state)),
  nutrition_basis = IF(is_user_modified = 1, nutrition_basis, VALUES(nutrition_basis)),
  serving_quantity = IF(is_user_modified = 1, serving_quantity, VALUES(serving_quantity)),
  serving_unit = IF(is_user_modified = 1, serving_unit, VALUES(serving_unit)),
  serving_weight_g = IF(is_user_modified = 1, serving_weight_g, VALUES(serving_weight_g)),
  serving_volume_ml = IF(is_user_modified = 1, serving_volume_ml, VALUES(serving_volume_ml)),
  density_g_per_ml = IF(is_user_modified = 1, density_g_per_ml, VALUES(density_g_per_ml)),
  calories = IF(is_user_modified = 1, calories, VALUES(calories)),
  protein = IF(is_user_modified = 1, protein, VALUES(protein)),
  carbohydrates = IF(is_user_modified = 1, carbohydrates, VALUES(carbohydrates)),
  fats = IF(is_user_modified = 1, fats, VALUES(fats)),
  fiber = IF(is_user_modified = 1, fiber, VALUES(fiber)),
  sugar = IF(is_user_modified = 1, sugar, VALUES(sugar)),
  sodium_mg = IF(is_user_modified = 1, sodium_mg, VALUES(sodium_mg)),
  verification_status = IF(is_user_modified = 1, verification_status, VALUES(verification_status)),
  source_name = IF(is_user_modified = 1, source_name, VALUES(source_name)),
  source_reference = IF(is_user_modified = 1, source_reference, VALUES(source_reference)),
  updated_at = IF(is_user_modified = 1, updated_at, CURRENT_TIMESTAMP);

[Step 7] DML on nutrition_targets (Idempotent target seeding)
INSERT INTO nutrition_targets (user_id, daily_calorie_target, protein_target_g, carbs_target_g, fats_target_g, fiber_target_g, water_target_ml)
SELECT id, 2200, 130.00, 240.00, 65.00, 30.00, 3000
FROM users
ON DUPLICATE KEY UPDATE updated_at = updated_at;

[Step 8] DML on schema_migrations
INSERT INTO schema_migrations (version, description)
VALUES ('phase4_nutrition', 'Phase 4: Nutrition Management & Food Intelligence')
ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP;
`);

    console.log('================ DEPENDENCY-SAFE ROLLBACK SEQUENCE ================');
    console.log('1. DROP TABLE IF EXISTS meal_food_items;      -- Child table referencing nutrition_logs and food_products');
    console.log('2. DROP TABLE IF EXISTS nutrition_logs;        -- Child table referencing users');
    console.log('3. DROP TABLE IF EXISTS food_products;         -- Catalog table referencing users');
    console.log('4. DROP TABLE IF EXISTS nutrition_targets;     -- Targets table referencing users');
    console.log("5. DELETE FROM schema_migrations WHERE version = 'phase4_nutrition';");

    console.log('\n✅ Final Dry-Run Completed. Database tables and records remain 100% untouched.');
  } finally {
    await connection.end();
  }
}

dryRunPhase4().catch(console.error);
