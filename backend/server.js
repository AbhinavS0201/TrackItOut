// server.js — Express + MySQL backend for Daily Expense Tracker
require('dotenv').config(); // ← MUST be first line
const express    = require('express');
const mysql      = require('mysql2/promise');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');

const app  = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'expense_tracker_secret_2024';

app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());

// Mount Modular Finance API Router
const financeRoutes = require('./src/routes/financeRoutes');
app.use('/api/v1', financeRoutes);

// Mount Modular Nutrition API Router
const nutritionRoutes = require('./src/routes/nutritionRoutes');
app.use('/api/v1/nutrition', nutritionRoutes);

// ─── DB POOL ────────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'expense_tracker',
  waitForConnections: true,
  connectionLimit:    10,
});

// ─── INIT TABLES ─────────────────────────────────────────────────────────────
async function initDB() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        name         VARCHAR(100)  NOT NULL,
        phone        VARCHAR(20),
        email        VARCHAR(150)  NOT NULL UNIQUE,
        password     VARCHAR(255)  NOT NULL,
        monthly_budget DECIMAL(12,2) DEFAULT 0,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        user_id      INT            NOT NULL,
        type         ENUM('Income','Expense') NOT NULL,
        amount       DECIMAL(12,2)  NOT NULL,
        description  VARCHAR(255)   NOT NULL,
        category     VARCHAR(60)    DEFAULT 'General',
        payment_mode VARCHAR(60)    DEFAULT 'Cash',
        txn_date     DATE           NOT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('✅  Database tables ready');
  } finally {
    conn.release();
  }
}

// ─── MIDDLEWARE — verify JWT ─────────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ message: 'No token provided' });

  try {
    const payload = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /register
app.post('/register', async (req, res) => {
  const { name, phone, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: 'Name, email and password are required' });

  if (password.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters' });

  try {
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?', [email]
    );
    if (existing.length > 0)
      return res.status(409).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, phone, email, password) VALUES (?, ?, ?, ?)',
      [name, phone || null, email, hashed]
    );

    const token = jwt.sign({ id: result.insertId }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: result.insertId, name, email, phone }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, password, monthly_budget FROM users WHERE email = ?',
      [email]
    );
    if (rows.length === 0)
      return res.status(401).json({ message: 'Invalid email or password' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Login successful',
      token,
      user: {
        id:             user.id,
        name:           user.name,
        email:          user.email,
        phone:          user.phone,
        monthly_budget: user.monthly_budget
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /me  — refresh own profile
app.get('/me', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, monthly_budget, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  BUDGET ROUTE
// ═══════════════════════════════════════════════════════════════════════════════

// PUT /budget
app.put('/budget', auth, async (req, res) => {
  const { monthly_budget } = req.body;
  if (monthly_budget == null || isNaN(monthly_budget) || monthly_budget < 0)
    return res.status(400).json({ message: 'Invalid budget amount' });

  try {
    await pool.query(
      'UPDATE users SET monthly_budget = ? WHERE id = ?',
      [monthly_budget, req.userId]
    );
    res.json({ message: 'Budget updated', monthly_budget });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  TRANSACTION ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /add-transaction
app.post('/add-transaction', auth, async (req, res) => {
  const { Type, Amount, Description, Category, PaymentMode, Date: txnDate, AccountId, Notes } = req.body;

  if (!Type || !Amount || !Description)
    return res.status(400).json({ message: 'Type, amount, and description are required' });

  if (!['Income', 'Expense', 'Transfer'].includes(Type))
    return res.status(400).json({ message: 'Type must be Income, Expense or Transfer' });

  if (parseFloat(Amount) <= 0)
    return res.status(400).json({ message: 'Amount must be greater than 0' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const date = txnDate || new Date().toISOString().split('T')[0];
    const amt = parseFloat(Amount);
    const targetAccountId = AccountId ? parseInt(AccountId) : null;

    if (targetAccountId) {
      const [accCheck] = await conn.query(
        'SELECT id, type, current_balance FROM accounts WHERE id = ? AND user_id = ? FOR UPDATE',
        [targetAccountId, req.userId]
      );
      if (accCheck.length === 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'Selected account does not belong to you' });
      }

      // If expense, check funds (unless credit card)
      if (Type === 'Expense' && accCheck[0].type !== 'Credit Card' && parseFloat(accCheck[0].current_balance) < amt) {
        await conn.rollback();
        return res.status(400).json({ message: 'Insufficient balance in selected account' });
      }

      // Adjust account balance
      const delta = Type === 'Income' ? amt : -amt;
      await conn.query(
        'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?',
        [delta, targetAccountId]
      );
    }

    const [result] = await conn.query(
      `INSERT INTO transactions
         (user_id, account_id, type, amount, description, category, payment_mode, notes, txn_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        targetAccountId,
        Type,
        amt,
        Description,
        Category   || 'General',
        PaymentMode || 'Cash',
        Notes || null,
        date
      ]
    );

    await conn.commit();
    res.status(201).json({
      message: 'Transaction added',
      id: result.insertId
    });
  } catch (err) {
    await conn.rollback();
    console.error('Add transaction error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

// GET /transactions/:userId  — filter by date, category, type, month, account, search
app.get('/transactions/:userId', auth, async (req, res) => {
  // Security: users can only access their own transactions
  if (parseInt(req.params.userId) !== req.userId)
    return res.status(403).json({ message: 'Forbidden' });

  const { date, category, type, month, year, account_id, search } = req.query;

  let sql = `
    SELECT 
      t.id, t.user_id, t.account_id, t.transfer_account_id, t.type, t.amount, 
      t.description, t.notes, t.category, t.payment_mode, t.txn_date, t.is_recurring, 
      t.created_at,
      a.name AS account_name,
      a.type AS account_type,
      ta.name AS transfer_account_name
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN accounts ta ON t.transfer_account_id = ta.id
    WHERE t.user_id = ?
  `;
  const args = [req.userId];

  if (date) {
    sql += ' AND t.txn_date = ?';
    args.push(date);
  }

  if (month && year) {
    sql += ' AND MONTH(t.txn_date) = ? AND YEAR(t.txn_date) = ?';
    args.push(month, year);
  } else if (year) {
    sql += ' AND YEAR(t.txn_date) = ?';
    args.push(year);
  }

  if (category) {
    sql += ' AND t.category = ?';
    args.push(category);
  }

  if (type && ['Income', 'Expense', 'Transfer'].includes(type)) {
    sql += ' AND t.type = ?';
    args.push(type);
  }

  if (account_id) {
    sql += ' AND (t.account_id = ? OR t.transfer_account_id = ?)';
    args.push(account_id, account_id);
  }

  if (search) {
    sql += ' AND (t.description LIKE ? OR t.notes LIKE ?)';
    args.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY t.txn_date DESC, t.created_at DESC';

  try {
    const [rows] = await pool.query(sql, args);
    res.json(rows);
  } catch (err) {
    console.error('Fetch transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// DELETE /transaction/:id
app.delete('/transaction/:id', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id, user_id, account_id, type, amount FROM transactions WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const txn = rows[0];
    if (txn.user_id !== req.userId) {
      await conn.rollback();
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Revert account balance if linked
    if (txn.account_id && ['Income', 'Expense'].includes(txn.type)) {
      const revertDelta = txn.type === 'Income' ? -parseFloat(txn.amount) : parseFloat(txn.amount);
      await conn.query(
        'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?',
        [revertDelta, txn.account_id]
      );
    }

    await conn.query('DELETE FROM transactions WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

// ─── SUMMARY / ANALYTICS ───────────────────────────────────────────────────

// GET /summary/:userId  — totals + category breakdown (Excludes Transfers)
app.get('/summary/:userId', auth, async (req, res) => {
  if (parseInt(req.params.userId) !== req.userId)
    return res.status(403).json({ message: 'Forbidden' });

  const { month, year } = req.query;
  let dateClause = '';
  const args = [req.userId];

  if (month && year) {
    dateClause = ' AND MONTH(txn_date) = ? AND YEAR(txn_date) = ?';
    args.push(month, year);
  }

  try {
    // Totals (Transfers strictly excluded from income and expenses)
    const [totals] = await pool.query(
      `SELECT
         SUM(CASE WHEN type='Income'  THEN amount ELSE 0 END) AS total_income,
         SUM(CASE WHEN type='Expense' THEN amount ELSE 0 END) AS total_expense,
         COUNT(CASE WHEN type != 'Transfer' THEN 1 END) AS txn_count
       FROM transactions
       WHERE user_id = ?${dateClause}`,
      args
    );

    // Category breakdown (expenses only, excluding transfers)
    const [byCategory] = await pool.query(
      `SELECT category, SUM(amount) AS total
       FROM transactions
       WHERE user_id = ? AND type = 'Expense'${dateClause}
       GROUP BY category
       ORDER BY total DESC`,
      args
    );

    // Monthly trend (last 6 months, excluding transfers)
    const [monthly] = await pool.query(
      `SELECT
         DATE_FORMAT(txn_date, '%Y-%m') AS month_label,
         SUM(CASE WHEN type='Income'  THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN type='Expense' THEN amount ELSE 0 END) AS expense
       FROM transactions
       WHERE user_id = ? AND type != 'Transfer' AND txn_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month_label
       ORDER BY month_label ASC`,
      [req.userId]
    );

    // Aggregate Total Balance across all Active Accounts
    const [accSum] = await pool.query(
      `SELECT SUM(current_balance) AS total_account_balance 
       FROM accounts 
       WHERE user_id = ? AND status = 'Active'`,
      [req.userId]
    );

    // Aggregate Savings Goals
    const [goalSum] = await pool.query(
      `SELECT 
         SUM(current_amount) AS total_saved_goals, 
         SUM(target_amount) AS total_target_goals 
       FROM savings_goals 
       WHERE user_id = ? AND status = 'Active'`,
      [req.userId]
    );

    const inc = parseFloat(totals[0].total_income || 0);
    const exp = parseFloat(totals[0].total_expense || 0);
    const totalBal = parseFloat(accSum[0].total_account_balance || (inc - exp));

    res.json({
      totals: {
        total_income: inc,
        total_expense: exp,
        total_savings: inc - exp,
        total_account_balance: totalBal,
        total_saved_goals: parseFloat(goalSum[0].total_saved_goals || 0),
        total_target_goals: parseFloat(goalSum[0].total_target_goals || 0),
        txn_count: totals[0].txn_count || 0,
      },
      byCategory,
      monthly
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── START ────────────────────────────────────────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀  Server running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌  DB init failed:', err.message);
    process.exit(1);
  });