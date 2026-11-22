// backend/src/controllers/financeController.js
const financeService = require('../services/financeService');

class FinanceController {
  // Accounts
  async getAccounts(req, res) {
    try {
      const accounts = await financeService.getAccounts(req.userId);
      res.json(accounts);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async createAccount(req, res) {
    try {
      const { name, type, opening_balance, institution_name, account_number } = req.body;
      if (!name) return res.status(400).json({ message: 'Account name is required' });

      const account = await financeService.createAccount(req.userId, {
        name,
        type,
        opening_balance,
        institution_name,
        account_number,
      });
      res.status(201).json(account);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async updateAccount(req, res) {
    try {
      const account = await financeService.updateAccount(req.userId, req.params.id, req.body);
      res.json(account);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  async archiveAccount(req, res) {
    try {
      const result = await financeService.archiveAccount(req.userId, req.params.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  // Transfers
  async executeTransfer(req, res) {
    try {
      const { source_account_id, destination_account_id, amount, date, notes } = req.body;
      if (!source_account_id || !destination_account_id || !amount) {
        return res.status(400).json({ message: 'Source, destination, and amount are required' });
      }

      const result = await financeService.executeTransfer(req.userId, {
        source_account_id,
        destination_account_id,
        amount,
        date,
        notes,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  // Category Budgets
  async getBudgets(req, res) {
    try {
      const { month, year } = req.query;
      const budgets = await financeService.getCategoryBudgets(req.userId, month, year);
      res.json(budgets);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async setBudget(req, res) {
    try {
      const { category, amount, month, year } = req.body;
      if (!category || !amount) {
        return res.status(400).json({ message: 'Category and amount are required' });
      }
      const budget = await financeService.setCategoryBudget(req.userId, {
        category,
        amount,
        month,
        year,
      });
      res.json(budget);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  async deleteBudget(req, res) {
    try {
      const result = await financeService.deleteCategoryBudget(req.userId, req.params.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  // Savings Goals
  async getSavingsGoals(req, res) {
    try {
      const goals = await financeService.getSavingsGoals(req.userId);
      res.json(goals);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async createSavingsGoal(req, res) {
    try {
      const { name, target_amount, target_date, category } = req.body;
      if (!name || !target_amount) {
        return res.status(400).json({ message: 'Goal name and target amount are required' });
      }
      const goal = await financeService.createSavingsGoal(req.userId, {
        name,
        target_amount,
        target_date,
        category,
      });
      res.status(201).json(goal);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  async contributeSavingsGoal(req, res) {
    try {
      const { account_id, amount, notes, date } = req.body;
      if (!account_id || !amount) {
        return res.status(400).json({ message: 'Funding account and amount are required' });
      }
      const result = await financeService.contributeToSavingsGoal(req.userId, req.params.id, {
        account_id,
        amount,
        notes,
        date,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  async deleteSavingsGoal(req, res) {
    try {
      const result = await financeService.deleteSavingsGoal(req.userId, req.params.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  // Recurring Transactions
  async getRecurring(req, res) {
    try {
      const list = await financeService.getRecurringTransactions(req.userId);
      res.json(list);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async createRecurring(req, res) {
    try {
      const rule = await financeService.createRecurringTransaction(req.userId, req.body);
      res.status(201).json(rule);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  async processRecurring(req, res) {
    try {
      const result = await financeService.processRecurringDue(req.userId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async deleteRecurring(req, res) {
    try {
      const result = await financeService.deleteRecurringTransaction(req.userId, req.params.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
}

module.exports = new FinanceController();
