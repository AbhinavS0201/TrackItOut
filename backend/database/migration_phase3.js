// backend/database/migration_phase3.js
// Safe, idempotent, non-destructive migration for Phase 3: Personal Finance Management
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function runMigration() {
  console.log('🔄 Starting Phase 3 Database Migration...');

  const connection = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'expense_tracker',
    multipleStatements: true,
  });

  const report = {
    tablesCreated: [],
    columnsModified: [],
    columnsAdded: [],
    indexesCreated: [],
    dataPreservation: {},
  };

  try {
    // 1. Audit row counts BEFORE migration
    const [usersBefore] = await connection.query('SELECT COUNT(*) AS count FROM users');
    const [txnsBefore]  = await connection.query('SELECT COUNT(*) AS count FROM transactions');
    report.dataPreservation.usersBefore = usersBefore[0].count;
    report.dataPreservation.txnsBefore  = txnsBefore[0].count;

    console.log(`Audited: ${usersBefore[0].count} users, ${txnsBefore[0].count} transactions exist.`);

    // 2. Create `accounts` table
    console.log('Creating accounts table if not exists...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        user_id          INT NOT NULL,
        name             VARCHAR(100) NOT NULL,
        type             ENUM('Bank', 'Cash', 'UPI', 'Credit Card', 'Savings') NOT NULL DEFAULT 'Bank',
        institution_name VARCHAR(100) NULL,
        account_number   VARCHAR(50) NULL,
        opening_balance  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        current_balance  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        status           ENUM('Active', 'Archived') NOT NULL DEFAULT 'Active',
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_accounts_user_status (user_id, status),
        CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    report.tablesCreated.push('accounts');

    // 3. Modify transactions.type ENUM to add 'Transfer' non-destructively
    console.log('Updating transactions.type ENUM to include Transfer...');
    await connection.query(`
      ALTER TABLE transactions 
      MODIFY COLUMN type ENUM('Income', 'Expense', 'Transfer') NOT NULL;
    `);
    report.columnsModified.push('transactions.type (added "Transfer")');

    // 4. Safely check and add columns to `transactions` table
    const [existingCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'transactions'
    `, [process.env.DB_NAME || 'expense_tracker']);
    const colNames = existingCols.map(c => c.COLUMN_NAME);

    if (!colNames.includes('account_id')) {
      await connection.query(`
        ALTER TABLE transactions
        ADD COLUMN account_id INT NULL AFTER user_id,
        ADD CONSTRAINT fk_txns_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;
      `);
      report.columnsAdded.push('transactions.account_id (INT NULL, FK to accounts)');
    }

    if (!colNames.includes('transfer_account_id')) {
      await connection.query(`
        ALTER TABLE transactions
        ADD COLUMN transfer_account_id INT NULL AFTER account_id,
        ADD CONSTRAINT fk_txns_transfer_account FOREIGN KEY (transfer_account_id) REFERENCES accounts(id) ON DELETE SET NULL;
      `);
      report.columnsAdded.push('transactions.transfer_account_id (INT NULL, FK to accounts)');
    }

    if (!colNames.includes('notes')) {
      await connection.query(`
        ALTER TABLE transactions
        ADD COLUMN notes TEXT NULL AFTER description;
      `);
      report.columnsAdded.push('transactions.notes (TEXT NULL)');
    }

    if (!colNames.includes('is_recurring')) {
      await connection.query(`
        ALTER TABLE transactions
        ADD COLUMN is_recurring TINYINT(1) NOT NULL DEFAULT 0 AFTER payment_mode,
        ADD COLUMN recurring_frequency ENUM('daily', 'weekly', 'monthly', 'yearly') NULL AFTER is_recurring;
      `);
      report.columnsAdded.push('transactions.is_recurring (TINYINT(1) DEFAULT 0)');
      report.columnsAdded.push('transactions.recurring_frequency (ENUM NULL)');
    }

    // Add composite index on (user_id, txn_date) for high performance filtering
    const [existingIndexes] = await connection.query(`
      SHOW INDEX FROM transactions WHERE Key_name = 'idx_txns_user_date';
    `);
    if (existingIndexes.length === 0) {
      await connection.query(`
        CREATE INDEX idx_txns_user_date ON transactions (user_id, txn_date);
      `);
      report.indexesCreated.push('transactions.idx_txns_user_date');
    }

    // 5. Create `category_budgets` table
    console.log('Creating category_budgets table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS category_budgets (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        user_id      INT NOT NULL,
        category     VARCHAR(60) NOT NULL,
        amount       DECIMAL(12,2) NOT NULL,
        month        TINYINT NOT NULL,
        year         SMALLINT NOT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_category_month_year (user_id, category, month, year),
        INDEX idx_budget_lookup (user_id, month, year),
        CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    report.tablesCreated.push('category_budgets');

    // 6. Create `savings_goals` table
    console.log('Creating savings_goals table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS savings_goals (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        user_id        INT NOT NULL,
        name           VARCHAR(120) NOT NULL,
        target_amount  DECIMAL(12,2) NOT NULL,
        current_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        target_date    DATE NULL,
        category       VARCHAR(60) DEFAULT 'General',
        status         ENUM('Active', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Active',
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_goals_user_status (user_id, status),
        CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    report.tablesCreated.push('savings_goals');

    // 7. Create `savings_contributions` table
    console.log('Creating savings_contributions table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS savings_contributions (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        goal_id      INT NOT NULL,
        user_id      INT NOT NULL,
        account_id   INT NULL,
        amount       DECIMAL(12,2) NOT NULL,
        contrib_date DATE NOT NULL,
        notes        VARCHAR(255) NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_contrib_goal (goal_id),
        CONSTRAINT fk_contrib_goal FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE,
        CONSTRAINT fk_contrib_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_contrib_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    report.tablesCreated.push('savings_contributions');

    // 8. Create `recurring_transactions` table
    console.log('Creating recurring_transactions table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id                  INT AUTO_INCREMENT PRIMARY KEY,
        user_id             INT NOT NULL,
        account_id          INT NULL,
        type                ENUM('Income', 'Expense') NOT NULL,
        amount              DECIMAL(12,2) NOT NULL,
        description         VARCHAR(255) NOT NULL,
        category            VARCHAR(60) DEFAULT 'General',
        frequency           ENUM('daily', 'weekly', 'monthly', 'yearly') NOT NULL DEFAULT 'monthly',
        start_date          DATE NOT NULL,
        end_date            DATE NULL,
        last_processed_date DATE NULL,
        is_active           TINYINT(1) NOT NULL DEFAULT 1,
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_recurring_user (user_id, is_active),
        CONSTRAINT fk_recurring_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_recurring_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    report.tablesCreated.push('recurring_transactions');

    // 9. Backfill Default Accounts for Existing Users to ensure clean data integrity
    console.log('Checking and seeding default accounts for existing users...');
    const [allUsers] = await connection.query('SELECT id, name FROM users');
    for (const u of allUsers) {
      const [existingAccs] = await connection.query(
        'SELECT id FROM accounts WHERE user_id = ?', [u.id]
      );
      if (existingAccs.length === 0) {
        // Compute user's net income - expense to set realistic opening balance
        const [netTotals] = await connection.query(`
          SELECT 
            SUM(CASE WHEN type='Income' THEN amount ELSE 0 END) AS inc,
            SUM(CASE WHEN type='Expense' THEN amount ELSE 0 END) AS exp
          FROM transactions WHERE user_id = ?
        `, [u.id]);
        const netBal = parseFloat(netTotals[0].inc || 0) - parseFloat(netTotals[0].exp || 0);

        const [accRes] = await connection.query(`
          INSERT INTO accounts (user_id, name, type, institution_name, opening_balance, current_balance, status)
          VALUES (?, 'Primary Bank Account', 'Bank', 'HDFC Bank', 0.00, ?, 'Active')
        `, [u.id, netBal]);

        const primaryAccountId = accRes.insertId;

        // Also add a Cash Wallet
        await connection.query(`
          INSERT INTO accounts (user_id, name, type, institution_name, opening_balance, current_balance, status)
          VALUES (?, 'Cash Wallet', 'Cash', 'Physical Cash', 0.00, 0.00, 'Active')
        `, [u.id]);

        // Link unassigned legacy transactions to the primary account
        await connection.query(`
          UPDATE transactions 
          SET account_id = ? 
          WHERE user_id = ? AND account_id IS NULL
        `, [primaryAccountId, u.id]);

        console.log(`Seeded default accounts and linked transactions for user ${u.id} (${u.name})`);
      }
    }

    // 10. Audit row counts AFTER migration
    const [usersAfter] = await connection.query('SELECT COUNT(*) AS count FROM users');
    const [txnsAfter]  = await connection.query('SELECT COUNT(*) AS count FROM transactions');
    const [accsAfter]  = await connection.query('SELECT COUNT(*) AS count FROM accounts');
    report.dataPreservation.usersAfter = usersAfter[0].count;
    report.dataPreservation.txnsAfter  = txnsAfter[0].count;
    report.dataPreservation.accsAfter  = accsAfter[0].count;

    console.log('✅ Phase 3 Migration completed successfully!');
    console.log(JSON.stringify(report, null, 2));

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
