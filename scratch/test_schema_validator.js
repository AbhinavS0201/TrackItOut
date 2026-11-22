// scratch/test_schema_validator.js
const mysql = require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/mysql2/promise');
require('d:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/node_modules/dotenv').config({ 
  path: 'd:/OneDrive/Desktop/Daily_Expense_Tracker-main/backend/.env' 
});

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
      discrepancies.push({
        type: 'MISSING_COLUMN',
        item: colName,
        expected: `Column '${colName}' (${expected.columnType}, nullable=${expected.isNullable})`,
        actual: 'MISSING'
      });
      continue;
    }

    // Compare column type
    const expectedColType = expected.columnType.toLowerCase();
    if (actual.columnType !== expectedColType && actual.dataType !== expectedColType) {
      discrepancies.push({
        type: 'COLUMN_TYPE_MISMATCH',
        item: colName,
        expected: expectedColType,
        actual: actual.columnType
      });
    }

    // Compare nullability
    if (actual.isNullable !== expected.isNullable) {
      discrepancies.push({
        type: 'NULLABILITY_MISMATCH',
        item: colName,
        expected: expected.isNullable ? 'NULL' : 'NOT NULL',
        actual: actual.isNullable ? 'NULL' : 'NOT NULL'
      });
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
      discrepancies.push({
        type: 'PRIMARY_KEY_MISMATCH',
        item: 'PRIMARY KEY',
        expected: expectedPk.join(', '),
        actual: actualPk.join(', ') || 'NONE'
      });
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
        discrepancies.push({
          type: 'FOREIGN_KEY_MISMATCH',
          item: `FK on ${colName}`,
          expected: `REFERENCES ${expectedFk.referencedTable}(${expectedFk.referencedColumn})`,
          actual: fkRows.map(f => `${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME}(${f.REFERENCED_COLUMN_NAME})`).join('; ') || 'NONE'
        });
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
        discrepancies.push({
          type: 'MISSING_UNIQUE_INDEX',
          item: idxName,
          expected: `UNIQUE (${cols.join(', ')})`,
          actual: 'MISSING'
        });
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
        discrepancies.push({
          type: 'MISSING_INDEX',
          item: idxName,
          expected: `INDEX (${cols.join(', ')})`,
          actual: 'MISSING'
        });
      }
    }
  }

  if (discrepancies.length > 0) {
    let report = `🛑 INCOMPATIBLE SCHEMA DETECTED on table '${tableName}':\n`;
    for (const d of discrepancies) {
      report += `  - [${d.type}] ${d.item}: Expected: ${d.expected} | Actual: ${d.actual}\n`;
    }
    throw new Error(report);
  }

  return { exists: true, valid: true, message: `Table '${tableName}' exists and matches expected schema.` };
}

// Test against existing Phase 3 table 'accounts'
async function test() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'expense_tracker'
  });

  try {
    console.log('Testing validator on existing table "accounts"...');
    const resultAccounts = await validateTableSchema(connection, 'accounts', {
      columns: {
        id: { columnType: 'int', isNullable: false },
        user_id: { columnType: 'int', isNullable: false },
        name: { columnType: 'varchar(100)', isNullable: false },
        current_balance: { columnType: 'decimal(12,2)', isNullable: false }
      },
      primaryKey: ['id'],
      foreignKeys: {
        user_id: { referencedTable: 'users', referencedColumn: 'id' }
      }
    });
    console.log('Result for accounts:', resultAccounts);

    console.log('\nTesting validator on non-existing table "food_products"...');
    const resultFood = await validateTableSchema(connection, 'food_products', {
      columns: {
        id: { columnType: 'int', isNullable: false }
      }
    });
    console.log('Result for food_products:', resultFood);
  } finally {
    await connection.end();
  }
}

test().catch(console.error);
