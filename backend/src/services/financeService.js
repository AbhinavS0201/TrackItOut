// backend/src/services/financeService.js
const pool = require('../config/db');

class FinanceService {
  // ─── ACCOUNTS ────────────────────────────────────────────────────────────
  async getAccounts(userId) {
    const [rows] = await pool.query(
      `SELECT id, user_id, name, type, institution_name, account_number, 
              opening_balance, current_balance, status, created_at, updated_at
       FROM accounts 
       WHERE user_id = ? AND status = 'Active'
       ORDER BY id ASC`,
      [userId]
    );
    return rows;
  }

  async createAccount(userId, data) {
    const { name, type, institution_name, account_number, opening_balance } = data;
    const initialBal = parseFloat(opening_balance || 0);

    const [result] = await pool.query(
      `INSERT INTO accounts (user_id, name, type, institution_name, account_number, opening_balance, current_balance, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [userId, name, type || 'Bank', institution_name || null, account_number || null, initialBal, initialBal]
    );

    return {
      id: result.insertId,
      user_id: userId,
      name,
      type: type || 'Bank',
      institution_name,
      account_number,
      opening_balance: initialBal,
      current_balance: initialBal,
      status: 'Active',
    };
  }

  async updateAccount(userId, accountId, data) {
    const { name, type, institution_name, account_number } = data;
    const [existing] = await pool.query(
      'SELECT id FROM accounts WHERE id = ? AND user_id = ?',
      [accountId, userId]
    );
    if (existing.length === 0) {
      throw new Error('Account not found or unauthorized');
    }

    await pool.query(
      `UPDATE accounts 
       SET name = COALESCE(?, name),
           type = COALESCE(?, type),
           institution_name = COALESCE(?, institution_name),
           account_number = COALESCE(?, account_number)
       WHERE id = ? AND user_id = ?`,
      [name, type, institution_name, account_number, accountId, userId]
    );

    const [updated] = await pool.query('SELECT * FROM accounts WHERE id = ?', [accountId]);
    return updated[0];
  }

  async archiveAccount(userId, accountId) {
    const [result] = await pool.query(
      `UPDATE accounts SET status = 'Archived' WHERE id = ? AND user_id = ?`,
      [accountId, userId]
    );
    if (result.affectedRows === 0) {
      throw new Error('Account not found or unauthorized');
    }
    return { success: true, message: 'Account archived successfully' };
  }

  // ─── TRANSFERS (ATOMIC & ZERO-SUM) ────────────────────────────────────────
  async executeTransfer(userId, { source_account_id, destination_account_id, amount, date, notes }) {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      throw new Error('Transfer amount must be a positive number');
    }
    if (source_account_id === destination_account_id) {
      throw new Error('Source and destination accounts must be different');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock and verify both accounts belong to user
      const [accounts] = await conn.query(
        'SELECT id, name, type, current_balance FROM accounts WHERE id IN (?, ?) AND user_id = ? FOR UPDATE',
        [source_account_id, destination_account_id, userId]
      );

      if (accounts.length < 2) {
        throw new Error('One or both accounts were not found or do not belong to you');
      }

      const source = accounts.find((a) => a.id === parseInt(source_account_id));
      const dest = accounts.find((a) => a.id === parseInt(destination_account_id));

      // Balance check (allow negative balance only for Credit Cards)
      if (source.type !== 'Credit Card' && parseFloat(source.current_balance) < amt) {
        throw new Error(`Insufficient funds in ${source.name}. Available: ₹${parseFloat(source.current_balance).toLocaleString('en-IN')}`);
      }

      // 1. Deduct from source
      await conn.query(
        'UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?',
        [amt, source.id]
      );

      // 2. Add to destination
      await conn.query(
        'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?',
        [amt, dest.id]
      );

      // 3. Record in transactions ledger as Transfer (Excluded from Income & Expense)
      const txnDate = date || new Date().toISOString().split('T')[0];
      const description = `Transfer to ${dest.name}`;
      const [txnResult] = await conn.query(
        `INSERT INTO transactions 
           (user_id, account_id, transfer_account_id, type, amount, description, category, payment_mode, notes, txn_date)
         VALUES (?, ?, ?, 'Transfer', ?, ?, 'Transfer', 'Transfer', ?, ?)`,
        [userId, source.id, dest.id, amt, description, notes || null, txnDate]
      );

      await conn.commit();

      return {
        success: true,
        transaction_id: txnResult.insertId,
        amount: amt,
        source_account: { id: source.id, name: source.name, new_balance: parseFloat(source.current_balance) - amt },
        destination_account: { id: dest.id, name: dest.name, new_balance: parseFloat(dest.current_balance) + amt },
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // ─── CATEGORY BUDGETS ────────────────────────────────────────────────────
  async getCategoryBudgets(userId, month, year) {
    const curDate = new Date();
    const m = parseInt(month || curDate.getMonth() + 1);
    const y = parseInt(year || curDate.getFullYear());

    // Get all defined category budgets
    const [budgets] = await pool.query(
      `SELECT id, user_id, category, amount, month, year, created_at, updated_at
       FROM category_budgets
       WHERE user_id = ? AND month = ? AND year = ?
       ORDER BY amount DESC`,
      [userId, m, y]
    );

    // Get actual spending per category for that month/year (excluding transfers)
    const [spending] = await pool.query(
      `SELECT category, SUM(amount) AS spent
       FROM transactions
       WHERE user_id = ? AND type = 'Expense' AND MONTH(txn_date) = ? AND YEAR(txn_date) = ?
       GROUP BY category`,
      [userId, m, y]
    );

    const spendMap = {};
    spending.forEach((s) => {
      spendMap[s.category] = parseFloat(s.spent);
    });

    return budgets.map((b) => {
      const spent = spendMap[b.category] || 0;
      const budgetAmt = parseFloat(b.amount);
      const remaining = Math.max(0, budgetAmt - spent);
      const percentage = budgetAmt > 0 ? (spent / budgetAmt) * 100 : 0;
      return {
        ...b,
        amount: budgetAmt,
        spent,
        remaining,
        percentage: Math.min(100, Math.round(percentage)),
        is_overbudget: spent > budgetAmt,
      };
    });
  }

  async setCategoryBudget(userId, { category, amount, month, year }) {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error('Budget amount must be positive');
    const curDate = new Date();
    const m = parseInt(month || curDate.getMonth() + 1);
    const y = parseInt(year || curDate.getFullYear());

    await pool.query(
      `INSERT INTO category_budgets (user_id, category, amount, month, year)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount), updated_at = CURRENT_TIMESTAMP`,
      [userId, category, amt, m, y]
    );

    return { user_id: userId, category, amount: amt, month: m, year: y };
  }

  async deleteCategoryBudget(userId, budgetId) {
    const [result] = await pool.query(
      'DELETE FROM category_budgets WHERE id = ? AND user_id = ?',
      [budgetId, userId]
    );
    if (result.affectedRows === 0) throw new Error('Budget not found or unauthorized');
    return { success: true };
  }

  // ─── SAVINGS GOALS ────────────────────────────────────────────────────────
  async getSavingsGoals(userId) {
    const [goals] = await pool.query(
      `SELECT id, user_id, name, target_amount, current_amount, target_date, category, status, created_at, updated_at
       FROM savings_goals
       WHERE user_id = ?
       ORDER BY status ASC, created_at DESC`,
      [userId]
    );

    return goals.map((g) => {
      const target = parseFloat(g.target_amount);
      const current = parseFloat(g.current_amount);
      const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
      return {
        ...g,
        target_amount: target,
        current_amount: current,
        progress: Math.round(progress),
        remaining: Math.max(0, target - current),
      };
    });
  }

  async createSavingsGoal(userId, { name, target_amount, target_date, category }) {
    const target = parseFloat(target_amount);
    if (isNaN(target) || target <= 0) throw new Error('Target amount must be a positive number');

    const [res] = await pool.query(
      `INSERT INTO savings_goals (user_id, name, target_amount, current_amount, target_date, category, status)
       VALUES (?, ?, ?, 0.00, ?, ?, 'Active')`,
      [userId, name, target, target_date || null, category || 'General']
    );

    return {
      id: res.insertId,
      user_id: userId,
      name,
      target_amount: target,
      current_amount: 0.0,
      target_date,
      category,
      status: 'Active',
    };
  }

  async contributeToSavingsGoal(userId, goalId, { account_id, amount, notes, date }) {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error('Contribution amount must be positive');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Check goal
      const [goals] = await conn.query(
        'SELECT id, name, target_amount, current_amount FROM savings_goals WHERE id = ? AND user_id = ? FOR UPDATE',
        [goalId, userId]
      );
      if (goals.length === 0) throw new Error('Savings goal not found');
      const goal = goals[0];

      // Check account
      const [accounts] = await conn.query(
        'SELECT id, name, current_balance, type FROM accounts WHERE id = ? AND user_id = ? FOR UPDATE',
        [account_id, userId]
      );
      if (accounts.length === 0) throw new Error('Funding account not found');
      const acc = accounts[0];

      if (acc.type !== 'Credit Card' && parseFloat(acc.current_balance) < amt) {
        throw new Error(`Insufficient funds in ${acc.name}`);
      }

      // Deduct from funding account
      await conn.query(
        'UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?',
        [amt, acc.id]
      );

      // Increment savings goal current amount
      const newGoalBal = parseFloat(goal.current_amount) + amt;
      const isCompleted = newGoalBal >= parseFloat(goal.target_amount);
      await conn.query(
        'UPDATE savings_goals SET current_amount = ?, status = ? WHERE id = ?',
        [newGoalBal, isCompleted ? 'Completed' : 'Active', goal.id]
      );

      // Log contribution record
      const contribDate = date || new Date().toISOString().split('T')[0];
      await conn.query(
        `INSERT INTO savings_contributions (goal_id, user_id, account_id, amount, contrib_date, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [goal.id, userId, acc.id, amt, contribDate, notes || null]
      );

      await conn.commit();

      return {
        success: true,
        goal_id: goal.id,
        goal_name: goal.name,
        new_amount: newGoalBal,
        is_completed: isCompleted,
        funded_from: acc.name,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async deleteSavingsGoal(userId, goalId) {
    const [result] = await pool.query(
      'DELETE FROM savings_goals WHERE id = ? AND user_id = ?',
      [goalId, userId]
    );
    if (result.affectedRows === 0) throw new Error('Goal not found or unauthorized');
    return { success: true };
  }

  // ─── RECURRING TRANSACTIONS (IDEMPOTENT PROCESSOR) ────────────────────────
  async getRecurringTransactions(userId) {
    const [rows] = await pool.query(
      `SELECT r.*, a.name AS account_name
       FROM recurring_transactions r
       LEFT JOIN accounts a ON r.account_id = a.id
       WHERE r.user_id = ?
       ORDER BY r.is_active DESC, r.created_at DESC`,
      [userId]
    );
    return rows;
  }

  async createRecurringTransaction(userId, data) {
    const { account_id, type, amount, description, category, frequency, start_date, end_date } = data;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error('Amount must be positive');

    const [res] = await pool.query(
      `INSERT INTO recurring_transactions 
         (user_id, account_id, type, amount, description, category, frequency, start_date, end_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [userId, account_id || null, type || 'Expense', amt, description, category || 'General', frequency || 'monthly', start_date, end_date || null]
    );

    return { id: res.insertId, ...data };
  }

  async processRecurringDue(userId) {
    // Process recurring transactions that are due today or overdue
    const today = new Date().toISOString().split('T')[0];
    const [dueRules] = await pool.query(
      `SELECT * FROM recurring_transactions
       WHERE user_id = ? AND is_active = 1 
         AND start_date <= ? 
         AND (end_date IS NULL OR end_date >= ?)
         AND (last_processed_date IS NULL OR last_processed_date < ?)`,
      [userId, today, today, today]
    );

    const processed = [];

    for (const rule of dueRules) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // 1. Insert transaction
        const [txn] = await conn.query(
          `INSERT INTO transactions (user_id, account_id, type, amount, description, category, payment_mode, txn_date, is_recurring, recurring_frequency)
           VALUES (?, ?, ?, ?, ?, ?, 'Automated Recurring', ?, 1, ?)`,
          [rule.user_id, rule.account_id, rule.type, rule.amount, `[Recurring] ${rule.description}`, rule.category, today, rule.frequency]
        );

        // 2. Adjust account balance if linked
        if (rule.account_id) {
          const delta = rule.type === 'Income' ? rule.amount : -rule.amount;
          await conn.query(
            'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?',
            [delta, rule.account_id]
          );
        }

        // 3. Mark rule last_processed_date as today to prevent duplicate runs!
        await conn.query(
          'UPDATE recurring_transactions SET last_processed_date = ? WHERE id = ?',
          [today, rule.id]
        );

        await conn.commit();
        processed.push({ rule_id: rule.id, description: rule.description, amount: rule.amount });
      } catch (err) {
        await conn.rollback();
        console.error(`Error processing recurring rule ${rule.id}:`, err);
      } finally {
        conn.release();
      }
    }

    return { processed_count: processed.length, processed };
  }

  async deleteRecurringTransaction(userId, ruleId) {
    const [result] = await pool.query(
      'DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?',
      [ruleId, userId]
    );
    if (result.affectedRows === 0) throw new Error('Recurring rule not found');
    return { success: true };
  }
}

module.exports = new FinanceService();
