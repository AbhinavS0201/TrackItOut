// backend/src/routes/financeRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const financeController = require('../controllers/financeController');

// All finance routes require JWT authentication
router.use(auth);

// Accounts
router.get('/accounts', (req, res) => financeController.getAccounts(req, res));
router.post('/accounts', (req, res) => financeController.createAccount(req, res));
router.put('/accounts/:id', (req, res) => financeController.updateAccount(req, res));
router.delete('/accounts/:id', (req, res) => financeController.archiveAccount(req, res));

// Transfers
router.post('/transfers', (req, res) => financeController.executeTransfer(req, res));

// Category Budgets
router.get('/budgets', (req, res) => financeController.getBudgets(req, res));
router.post('/budgets', (req, res) => financeController.setBudget(req, res));
router.delete('/budgets/:id', (req, res) => financeController.deleteBudget(req, res));

// Savings Goals
router.get('/savings-goals', (req, res) => financeController.getSavingsGoals(req, res));
router.post('/savings-goals', (req, res) => financeController.createSavingsGoal(req, res));
router.post('/savings-goals/:id/contribute', (req, res) => financeController.contributeSavingsGoal(req, res));
router.delete('/savings-goals/:id', (req, res) => financeController.deleteSavingsGoal(req, res));

// Recurring Transactions
router.get('/recurring-transactions', (req, res) => financeController.getRecurring(req, res));
router.post('/recurring-transactions', (req, res) => financeController.createRecurring(req, res));
router.post('/recurring-transactions/process', (req, res) => financeController.processRecurring(req, res));
router.delete('/recurring-transactions/:id', (req, res) => financeController.deleteRecurring(req, res));

module.exports = router;
