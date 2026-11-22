// backend/database/migration_phase4.js
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * Validates that an existing table possesses all mandatory columns, types, nullability,
 * primary keys, unique constraints, foreign keys, and indexes.
 * Prevents silent CREATE TABLE IF NOT EXISTS drift.
 */
async function validateTableSchema(connection, tableName, schemaSpec) {
  // 1. Check if table exists
  const [tables] = await connection.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'expense_tracker' AND table_name = ?
  `, [tableName]);

  if (tables.length === 0) {
    return { exists: false, valid: true, message: `Table '${tableName}' does not exist (safe for initial creation).` };
  }

  const discrepancies = [];

  // 2. Fetch actual columns
  const [actualColumns] = await connection.query(`
    SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
    FROM information_schema.columns
    WHERE table_schema = 'expense_tracker' AND table_name = ?
  `, [tableName]);

  const actualColMap = {};
  for (const c of actualColumns) {
    actualColMap[c.COLUMN_NAME] = {
      dataType: c.DATA_TYPE.toLowerCase(),
      columnType: c.COLUMN_TYPE.toLowerCase(),
      isNullable: c.IS_NULLABLE === 'YES'
    };
  }

  // 3. Validate columns
  for (const [colName, expected] of Object.entries(schemaSpec.columns)) {
    const actual = actualColMap[colName];
    if (!actual) {
      discrecrepanciesPush(discrepancies, 'MISSING_COLUMN', colName, 
        `Column '${colName}' (${expected.columnType}, nullable=${expected.isNullable})`, 'MISSING');
      continue;
    }

    const expectedColType = expected.columnType.toLowerCase();
    if (actual.columnType !== expectedColType && actual.dataType !== expectedColType) {
      discrecrepanciesPush(discrepancies, 'COLUMN_TYPE_MISMATCH', colName, expectedColType, actual.columnType);
    }

    if (actual.isNullable !== expected.isNullable) {
      discrecrepanciesPush(discrepancies, 'NULLABILITY_MISMATCH', colName, 
        expected.isNullable ? 'NULL' : 'NOT NULL', actual.isNullable ? 'NULL' : 'NOT NULL');
    }
  }

  // 4. Fetch actual primary key
  const [pkRows] = await connection.query(`
    SELECT kcu.COLUMN_NAME
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      AND tc.TABLE_NAME = kcu.TABLE_NAME
    WHERE tc.TABLE_SCHEMA = 'expense_tracker'
      AND tc.TABLE_NAME = ?
      AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
    ORDER BY kcu.ORDINAL_POSITION
  `, [tableName]);
  const actualPk = pkRows.map(r => r.COLUMN_NAME);

  if (schemaSpec.primaryKey) {
    const expectedPk = schemaSpec.primaryKey;
    if (JSON.stringify(actualPk) !== JSON.stringify(expectedPk)) {
      discrecrepanciesPush(discrepancies, 'PRIMARY_KEY_MISMATCH', 'PRIMARY KEY', 
        expectedPk.join(', '), actualPk.join(', ') || 'NONE');
    }
  }

  // 5. Fetch actual foreign keys
  const [fkRows] = await connection.query(`
    SELECT kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      AND tc.TABLE_NAME = kcu.TABLE_NAME
    WHERE tc.TABLE_SCHEMA = 'expense_tracker'
      AND tc.TABLE_NAME = ?
      AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
  `, [tableName]);

  if (schemaSpec.foreignKeys) {
    for (const [colName, expectedFk] of Object.entries(schemaSpec.foreignKeys)) {
      const match = fkRows.find(fk => 
        fk.COLUMN_NAME === colName &&
        fk.REFERENCED_TABLE_NAME.toLowerCase() === expectedFk.referencedTable.toLowerCase() &&
        fk.REFERENCED_COLUMN_NAME.toLowerCase() === expectedFk.referencedColumn.toLowerCase()
      );
      if (!match) {
        discrecrepanciesPush(discrepancies, 'FOREIGN_KEY_MISMATCH', `FK on ${colName}`,
          `REFERENCES ${expectedFk.referencedTable}(${expectedFk.referencedColumn})`,
          fkRows.map(f => `${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME}(${f.REFERENCED_COLUMN_NAME})`).join('; ') || 'NONE');
      }
    }
  }

  // 6. Fetch actual indexes
  const [idxRows] = await connection.query(`
    SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX
    FROM information_schema.statistics
    WHERE TABLE_SCHEMA = 'expense_tracker' AND TABLE_NAME = ?
    ORDER BY INDEX_NAME, SEQ_IN_INDEX
  `, [tableName]);

  const actualIdxMap = {};
  for (const r of idxRows) {
    if (!actualIdxMap[r.INDEX_NAME]) {
      actualIdxMap[r.INDEX_NAME] = { nonUnique: r.NON_UNIQUE === 1, columns: [] };
    }
    actualIdxMap[r.INDEX_NAME].columns.push(r.COLUMN_NAME);
  }

  // Validate unique indexes
  if (schemaSpec.uniqueIndexes) {
    for (const [idxName, cols] of Object.entries(schemaSpec.uniqueIndexes)) {
      const found = Object.values(actualIdxMap).find(idx => 
        !idx.nonUnique && JSON.stringify(idx.columns) === JSON.stringify(cols)
      );
      if (!found) {
        discrecrepanciesPush(discrepancies, 'MISSING_UNIQUE_INDEX', idxName, 
          `UNIQUE (${cols.join(', ')})`, 'MISSING');
      }
    }
  }

  // Validate standard indexes
  if (schemaSpec.indexes) {
    for (const [idxName, cols] of Object.entries(schemaSpec.indexes)) {
      const found = Object.values(actualIdxMap).find(idx => 
        JSON.stringify(idx.columns) === JSON.stringify(cols)
      );
      if (!found) {
        discrecrepanciesPush(discrepancies, 'MISSING_INDEX', idxName, 
          `INDEX (${cols.join(', ')})`, 'MISSING');
      }
    }
  }

  if (discrepancies.length > 0) {
    let report = `🛑 INCOMPATIBLE SCHEMA DETECTED on table '${tableName}':\n`;
    for (const d of discrepancies) {
      report += `  - [${d.type}] ${d.item}\n      Expected: ${d.expected}\n      Actual:   ${d.actual}\n`;
    }
    throw new Error(report);
  }

  return { exists: true, valid: true, message: `Table '${tableName}' exists and matches expected schema.` };
}

function discrecrepanciesPush(arr, type, item, expected, actual) {
  arr.push({ type, item, expected, actual });
}

async function migratePhase4() {
  console.log('🚀 Initiating Phase 4 Nutrition Migration Preflight & Execution...');

  const backupPath = path.join(__dirname, 'backups/backup_before_phase4_nutrition.sql');

  // Preflight 1: Backup verification
  if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) {
    console.error(`🛑 PREFLIGHT FAILED: Missing or empty backup at ${backupPath}`);
    console.error('Run "node backend/database/create_backup.js" first.');
    process.exit(1);
  }
  console.log(`✅ Preflight 1: Verified database backup exists (${(fs.statSync(backupPath).size / 1024).toFixed(2)} KB).`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'expense_tracker',
    multipleStatements: true
  });

  const executionLog = [];
  let currentStep = '0: Initialization';

  try {
    // Preflight 2: Verify users table
    currentStep = 'Preflight 2: Verifying users table';
    const [userTableCheck] = await connection.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'expense_tracker' AND table_name = 'users'
    `);
    if (userTableCheck.length === 0) {
      throw new Error('Prerequisite table "users" does not exist in expense_tracker database.');
    }
    console.log('✅ Preflight 2: Prerequisite table "users" verified.');

    // Preflight 2.5: Align existing food_products preparation_state ENUM if table already exists (Option A)
    const [fpExist] = await connection.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'expense_tracker' AND table_name = 'food_products'
    `);
    if (fpExist.length > 0) {
      await connection.query(`
        ALTER TABLE food_products MODIFY COLUMN preparation_state 
        ENUM('Raw', 'Cooked', 'Boiled', 'Steamed', 'Grilled', 'Baked', 'Fried', 'Packaged', 'Stewed', 'Roasted') 
        NOT NULL DEFAULT 'Packaged';
      `);
      console.log('✅ In-Place Fix: Aligned food_products.preparation_state to include Roasted.');
    }

    // Preflight 3: Comprehensive schema validation (stops migration if existing tables have incompatible definitions)
    currentStep = 'Preflight 3: Comprehensive Schema Validation';
    
    // Spec for food_products
    await validateTableSchema(connection, 'food_products', {
      columns: {
        id: { columnType: 'int', isNullable: false },
        user_id: { columnType: 'int', isNullable: true },
        seed_key: { columnType: 'varchar(120)', isNullable: true },
        brand_name: { columnType: 'varchar(100)', isNullable: false },
        product_name: { columnType: 'varchar(150)', isNullable: false },
        variant: { columnType: 'varchar(100)', isNullable: true },
        preparation_state: { columnType: "enum('raw','cooked','boiled','steamed','grilled','baked','fried','packaged','stewed','roasted')", isNullable: false },
        nutrition_basis: { columnType: "enum('per_100g','per_100ml','per_serving')", isNullable: false },
        serving_quantity: { columnType: 'decimal(8,2)', isNullable: true },
        serving_unit: { columnType: 'varchar(50)', isNullable: true },
        serving_weight_g: { columnType: 'decimal(8,2)', isNullable: true },
        serving_volume_ml: { columnType: 'decimal(8,2)', isNullable: true },
        density_g_per_ml: { columnType: 'decimal(8,4)', isNullable: true },
        calories: { columnType: 'decimal(8,2)', isNullable: true },
        protein: { columnType: 'decimal(8,2)', isNullable: true },
        carbohydrates: { columnType: 'decimal(8,2)', isNullable: true },
        fats: { columnType: 'decimal(8,2)', isNullable: true },
        fiber: { columnType: 'decimal(8,2)', isNullable: true },
        sugar: { columnType: 'decimal(8,2)', isNullable: true },
        sodium_mg: { columnType: 'decimal(8,2)', isNullable: true },
        verification_status: { columnType: "enum('verified','user_approved','estimated','ocr_confirmed','unverified')", isNullable: false },
        source_name: { columnType: 'varchar(150)', isNullable: false },
        source_reference: { columnType: 'varchar(255)', isNullable: true },
        is_custom: { columnType: 'tinyint(1)', isNullable: false },
        is_user_modified: { columnType: 'tinyint(1)', isNullable: false }
      },
      primaryKey: ['id'],
      uniqueIndexes: { seed_key: ['seed_key'] },
      foreignKeys: { user_id: { referencedTable: 'users', referencedColumn: 'id' } },
      indexes: {
        idx_food_search: ['product_name', 'brand_name'],
        idx_food_user: ['user_id', 'is_custom']
      }
    });

    // Spec for nutrition_logs
    await validateTableSchema(connection, 'nutrition_logs', {
      columns: {
        id: { columnType: 'int', isNullable: false },
        user_id: { columnType: 'int', isNullable: false },
        date: { columnType: 'date', isNullable: false },
        meal_type: { columnType: "enum('breakfast','lunch','dinner','snacks','water')", isNullable: false },
        water_ml: { columnType: 'int', isNullable: false },
        notes: { columnType: 'text', isNullable: true }
      },
      primaryKey: ['id'],
      foreignKeys: { user_id: { referencedTable: 'users', referencedColumn: 'id' } },
      indexes: { idx_user_date_meal: ['user_id', 'date', 'meal_type'] }
    });

    // Spec for meal_food_items
    await validateTableSchema(connection, 'meal_food_items', {
      columns: {
        id: { columnType: 'int', isNullable: false },
        meal_log_id: { columnType: 'int', isNullable: false },
        food_product_id: { columnType: 'int', isNullable: true },
        logged_quantity: { columnType: 'decimal(8,2)', isNullable: false },
        logged_unit: { columnType: 'varchar(50)', isNullable: false },
        normalized_quantity: { columnType: 'decimal(8,2)', isNullable: false },
        normalized_unit: { columnType: "enum('g','ml','serving')", isNullable: false },
        food_name_snapshot: { columnType: 'varchar(150)', isNullable: false },
        brand_snapshot: { columnType: 'varchar(100)', isNullable: false },
        variant_snapshot: { columnType: 'varchar(100)', isNullable: true },
        preparation_state_snapshot: { columnType: 'varchar(50)', isNullable: false },
        nutrition_basis_snapshot: { columnType: "enum('per_100g','per_100ml','per_serving')", isNullable: false },
        serving_quantity_snapshot: { columnType: 'decimal(8,2)', isNullable: true },
        serving_unit_snapshot: { columnType: 'varchar(50)', isNullable: true },
        serving_weight_g_snapshot: { columnType: 'decimal(8,2)', isNullable: true },
        serving_volume_ml_snapshot: { columnType: 'decimal(8,2)', isNullable: true },
        density_g_per_ml_snapshot: { columnType: 'decimal(8,4)', isNullable: true },
        source_name_snapshot: { columnType: 'varchar(150)', isNullable: false },
        source_reference_snapshot: { columnType: 'varchar(255)', isNullable: true },
        calories: { columnType: 'decimal(8,2)', isNullable: true },
        protein: { columnType: 'decimal(8,2)', isNullable: true },
        carbohydrates: { columnType: 'decimal(8,2)', isNullable: true },
        fats: { columnType: 'decimal(8,2)', isNullable: true },
        fiber: { columnType: 'decimal(8,2)', isNullable: true },
        sugar: { columnType: 'decimal(8,2)', isNullable: true },
        sodium_mg: { columnType: 'decimal(8,2)', isNullable: true },
        nutrient_status: { columnType: "enum('verified','user_approved','estimated','ocr_confirmed','unverified')", isNullable: false }
      },
      primaryKey: ['id'],
      foreignKeys: {
        meal_log_id: { referencedTable: 'nutrition_logs', referencedColumn: 'id' },
        food_product_id: { referencedTable: 'food_products', referencedColumn: 'id' }
      },
      indexes: { idx_meal_items_log: ['meal_log_id'] }
    });

    // Spec for nutrition_targets
    await validateTableSchema(connection, 'nutrition_targets', {
      columns: {
        id: { columnType: 'int', isNullable: false },
        user_id: { columnType: 'int', isNullable: false },
        daily_calorie_target: { columnType: 'int', isNullable: false },
        protein_target_g: { columnType: 'decimal(6,2)', isNullable: false },
        carbs_target_g: { columnType: 'decimal(6,2)', isNullable: false },
        fats_target_g: { columnType: 'decimal(6,2)', isNullable: false },
        fiber_target_g: { columnType: 'decimal(6,2)', isNullable: false },
        water_target_ml: { columnType: 'int', isNullable: false }
      },
      primaryKey: ['id'],
      uniqueIndexes: { user_id: ['user_id'] },
      foreignKeys: { user_id: { referencedTable: 'users', referencedColumn: 'id' } }
    });

    console.log('✅ Preflight 3: Schema validation passed (no incompatible existing tables).');

    // Step 1: schema_migrations table
    currentStep = 'Step 1: Create schema_migrations table';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        description VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    executionLog.push('Step 1: schema_migrations table verified/created');
    console.log('  [1/8] schema_migrations ready');

    // Step 2: food_products table
    currentStep = 'Step 2: Create food_products table';
    await connection.query(`
      CREATE TABLE IF NOT EXISTS food_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        seed_key VARCHAR(120) NULL UNIQUE,
        brand_name VARCHAR(100) NOT NULL,
        product_name VARCHAR(150) NOT NULL,
        variant VARCHAR(100) NULL,
        preparation_state ENUM('Raw', 'Cooked', 'Boiled', 'Steamed', 'Grilled', 'Baked', 'Fried', 'Packaged', 'Stewed', 'Roasted') NOT NULL DEFAULT 'Packaged',
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
    `);
    executionLog.push('Step 2: food_products table verified/created');
    console.log('  [2/8] food_products table ready');

    // Step 3: nutrition_logs table
    currentStep = 'Step 3: Create nutrition_logs table';
    await connection.query(`
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
    `);
    executionLog.push('Step 3: nutrition_logs table verified/created');
    console.log('  [3/8] nutrition_logs table ready');

    // Step 4: meal_food_items table
    currentStep = 'Step 4: Create meal_food_items table';
    await connection.query(`
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
    `);
    executionLog.push('Step 4: meal_food_items table verified/created');
    console.log('  [4/8] meal_food_items table ready');

    // Step 5: nutrition_targets table
    currentStep = 'Step 5: Create nutrition_targets table';
    await connection.query(`
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
    `);
    executionLog.push('Step 5: nutrition_targets table verified/created');
    console.log('  [5/8] nutrition_targets table ready');

    // Step 6: Safe seed catalog upsert (protects user modifications!)
    currentStep = 'Step 6: Safe seed upsert into food_products';
    await connection.query(`
      INSERT INTO food_products (
        seed_key, brand_name, product_name, variant, preparation_state, nutrition_basis,
        serving_quantity, serving_unit, serving_weight_g, serving_volume_ml, density_g_per_ml,
        calories, protein, carbohydrates, fats, fiber, sugar, sodium_mg,
        verification_status, source_name, source_reference, is_custom, is_user_modified
      ) VALUES 
        ('seed_bigmuscles_whey_belgian', 'BigMuscles Nutrition', 'Premium Gold Whey Protein', 'Belgian Chocolate', 'Packaged', 'per_serving', 1.00, 'scoop', 37.00, NULL, NULL, 136.20, 25.00, 5.00, 1.80, NULL, 0.00, NULL, 'Verified', 'BigMuscles Nutrition Official', 'https://bigmusclesnutrition.com/products/premium-gold-whey', 0, 0),
        ('seed_pintola_oats_dark_choc', 'Pintola', 'High Protein Rolled Oats', 'Dark Chocolate', 'Packaged', 'per_100g', 1.00, 'serving', 40.00, NULL, NULL, 392.00, 25.00, 54.60, 7.80, 9.60, 14.00, 130.00, 'Unverified', 'Pintola Packaging Declaration', 'https://pintola.in/products/dark-chocolate-high-protein-rolled-oats', 0, 0),
        ('seed_amul_rose_lassi_200ml', 'Amul', 'High Protein Lassi', 'Rose', 'Packaged', 'per_100ml', 1.00, 'pack', NULL, 200.00, 1.0350, 53.50, 7.50, 6.00, 0.85, 0.00, 6.00, 32.00, 'Unverified', 'Amul Packaging Declaration', 'https://amul.com/products/amul-high-protein-rose-lassi-200ml.php', 0, 0),
        ('seed_milky_mist_paneer_lofat', 'Milky Mist', 'High Protein Low Fat Paneer', 'Classic', 'Packaged', 'per_100g', 1.00, 'serving', 100.00, NULL, NULL, 190.00, 25.00, 5.70, 7.00, 0.00, 5.70, 125.00, 'Unverified', 'Milky Mist Packaging Declaration', 'https://www.milkymist.com/product/paneer', 0, 0),
        ('seed_chicken_breast_raw', 'Generic', 'Chicken Breast', 'Boneless Skinless', 'Raw', 'per_100g', 1.00, 'serving', 100.00, NULL, NULL, 120.00, 22.50, 0.00, 2.62, 0.00, 0.00, 65.00, 'Verified', 'USDA FoodData Central SR Legacy', 'FDC ID 171077', 0, 0),
        ('seed_chicken_breast_roasted', 'Generic', 'Chicken Breast', 'Meat Only', 'Roasted', 'per_100g', 1.00, 'serving', 100.00, NULL, NULL, 165.00, 31.02, 0.00, 3.57, 0.00, 0.00, 74.00, 'Verified', 'USDA FoodData Central SR Legacy', 'FDC ID 171477 (NDB 5064)', 0, 0),
        ('seed_chicken_breast_stewed', 'Generic', 'Chicken Breast', 'Meat Only', 'Stewed', 'per_100g', 1.00, 'serving', 100.00, NULL, NULL, 151.00, 30.54, 0.00, 3.17, 0.00, 0.00, 70.00, 'Verified', 'USDA FoodData Central SR Legacy', 'FDC ID 171478 (NDB 5065)', 0, 0),
        ('seed_chicken_breast_grilled', 'Generic', 'Chicken Breast', 'Meat Only', 'Grilled', 'per_100g', 1.00, 'serving', 100.00, NULL, NULL, 151.00, 30.54, 0.00, 3.17, 0.00, 0.00, 391.00, 'Verified', 'USDA FoodData Central SR Legacy', 'FDC ID 171534', 0, 0)
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
    `);
    executionLog.push('Step 6: food_products seed data safely upserted');
    console.log('  [6/8] seed catalog upserted');

    // Step 7: Dynamic User Target Initialization
    currentStep = 'Step 7: Dynamic user target initialization';
    await connection.query(`
      INSERT INTO nutrition_targets (user_id, daily_calorie_target, protein_target_g, carbs_target_g, fats_target_g, fiber_target_g, water_target_ml)
      SELECT id, 2200, 130.00, 240.00, 65.00, 30.00, 3000
      FROM users
      ON DUPLICATE KEY UPDATE updated_at = updated_at;
    `);
    executionLog.push('Step 7: nutrition_targets initialized for all users');
    console.log('  [7/8] user targets initialized');

    // Step 8: Record schema version
    currentStep = 'Step 8: Record schema version';
    await connection.query(`
      INSERT INTO schema_migrations (version, description)
      VALUES ('phase4_nutrition', 'Phase 4: Nutrition Management & Food Intelligence')
      ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP;
    `);
    executionLog.push('Step 8: schema_migrations entry recorded');
    console.log('  [8/8] migration record committed');

    console.log('✅ Phase 4 Nutrition Migration completed successfully!');
  } catch (error) {
    console.error(`\n❌ MIGRATION FAILED at: ${currentStep}`);
    console.error('Error Code:', error.code || 'VALIDATION_ERROR');
    console.error('Error Message:', error.message);
    console.error('\n📋 Successfully completed operations before failure:');
    executionLog.forEach(log => console.error(`  - ${log}`));
    console.error('\n⚠️ Note: In MySQL, DDL statements trigger implicit commits. Any created tables remain.');
    console.error('To clean up partially applied tables safely, use:');
    console.error('  CONFIRM_DESTRUCTIVE_ROLLBACK=YES node backend/database/rollback_phase4.js');
    process.exit(1);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  migratePhase4();
}

module.exports = migratePhase4;
