import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Plus,
  Trash2,
  Filter,
  Calendar,
  CreditCard,
  PieChart as PieIcon,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Target,
  Clock,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building,
  Smartphone,
  Banknote,
  Archive,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import GlassCard from '../components/common/GlassCard';
import GlassButton from '../components/common/GlassButton';
import GlassInput from '../components/common/GlassInput';
import GlassSelect from '../components/common/GlassSelect';
import GlassModal from '../components/common/GlassModal';
import GlassBadge from '../components/common/GlassBadge';
import { CHART_PALETTE, CATEGORY_COLORS } from '../theme/colors';

export default function FinancePage() {
  const { user, updateMonthlyBudget } = useAuth();

  // Active Tab: 'overview' | 'accounts' | 'budgets' | 'goals' | 'recurring'
  const [activeTab, setActiveTab] = useState('overview');

  // Core Data States
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categoryBudgets, setCategoryBudgets] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [recurringRules, setRecurringRules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddTxnModalOpen, setIsAddTxnModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);

  // Selected for action
  const [selectedGoal, setSelectedGoal] = useState(null);

  // Form States
  const [txnForm, setTxnForm] = useState({
    type: 'Expense',
    amount: '',
    description: '',
    category: 'Food',
    paymentMode: 'UPI',
    accountId: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [transferForm, setTransferForm] = useState({
    source_account_id: '',
    destination_account_id: '',
    amount: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [accountForm, setAccountForm] = useState({
    name: '',
    type: 'Bank',
    institution_name: '',
    account_number: '',
    opening_balance: '',
  });

  const [catBudgetForm, setCatBudgetForm] = useState({
    category: 'Food',
    amount: '',
  });

  const [goalForm, setGoalForm] = useState({
    name: '',
    target_amount: '',
    target_date: '',
    category: 'Emergency Fund',
  });

  const [contributeForm, setContributeForm] = useState({
    account_id: '',
    amount: '',
    notes: '',
  });

  const [recurringForm, setRecurringForm] = useState({
    account_id: '',
    type: 'Expense',
    amount: '',
    description: '',
    category: 'Utilities',
    frequency: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
  });

  // ─── LOAD DATA ────────────────────────────────────────────────────────────
  const loadAllFinanceData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      let txnUrl = `/transactions/${user.id}`;
      const q = [];
      if (filterDate) q.push(`date=${filterDate}`);
      if (filterCategory) q.push(`category=${encodeURIComponent(filterCategory)}`);
      if (filterType) q.push(`type=${filterType}`);
      if (filterAccount) q.push(`account_id=${filterAccount}`);
      if (searchQuery) q.push(`search=${encodeURIComponent(searchQuery)}`);
      if (q.length > 0) txnUrl += `?${q.join('&')}`;

      const [accRes, txnRes, sumRes, budRes, goalRes, recurRes] = await Promise.all([
        apiClient.get('/api/v1/accounts').catch(() => ({ data: [] })),
        apiClient.get(txnUrl).catch(() => ({ data: [] })),
        apiClient.get(`/summary/${user.id}`).catch(() => ({ data: null })),
        apiClient.get('/api/v1/budgets').catch(() => ({ data: [] })),
        apiClient.get('/api/v1/savings-goals').catch(() => ({ data: [] })),
        apiClient.get('/api/v1/recurring-transactions').catch(() => ({ data: [] })),
      ]);

      setAccounts(accRes.data || []);
      setTransactions(Array.isArray(txnRes.data) ? txnRes.data : []);
      setSummary(sumRes.data);
      setCategoryBudgets(budRes.data || []);
      setSavingsGoals(goalRes.data || []);
      setRecurringRules(recurRes.data || []);

      // Set default account selection if available
      if (accRes.data && accRes.data.length > 0) {
        if (!txnForm.accountId) setTxnForm((prev) => ({ ...prev, accountId: String(accRes.data[0].id) }));
        if (!transferForm.source_account_id) setTransferForm((prev) => ({ ...prev, source_account_id: String(accRes.data[0].id) }));
        if (!transferForm.destination_account_id && accRes.data.length > 1) {
          setTransferForm((prev) => ({ ...prev, destination_account_id: String(accRes.data[1].id) }));
        }
        if (!contributeForm.account_id) setContributeForm((prev) => ({ ...prev, account_id: String(accRes.data[0].id) }));
      }
    } catch (err) {
      console.error('Failed to load finance module data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, filterDate, filterCategory, filterType, filterAccount, searchQuery]);

  useEffect(() => {
    loadAllFinanceData();
  }, [loadAllFinanceData]);

  // ─── ACTION HANDLERS ──────────────────────────────────────────────────────

  // 1. Add Transaction
  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!txnForm.amount || !txnForm.description) return;
    try {
      await apiClient.post('/add-transaction', {
        Type: txnForm.type,
        Amount: parseFloat(txnForm.amount),
        Description: txnForm.description,
        Category: txnForm.category,
        PaymentMode: txnForm.paymentMode,
        AccountId: txnForm.accountId || null,
        Notes: txnForm.notes || null,
        Date: txnForm.date,
      });
      setIsAddTxnModalOpen(false);
      setTxnForm({
        type: 'Expense',
        amount: '',
        description: '',
        category: 'Food',
        paymentMode: 'UPI',
        accountId: accounts[0]?.id || '',
        notes: '',
        date: new Date().toISOString().split('T')[0],
      });
      loadAllFinanceData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving transaction');
    }
  };

  // 2. Delete Transaction
  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Delete this transaction? If linked to an account, the balance will be safely restored.')) return;
    try {
      await apiClient.delete(`/transaction/${id}`);
      loadAllFinanceData();
    } catch (err) {
      alert('Failed to delete transaction');
    }
  };

  // 3. Execute Account Transfer
  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!transferForm.source_account_id || !transferForm.destination_account_id || !transferForm.amount) {
      alert('Please fill all required transfer fields');
      return;
    }
    if (transferForm.source_account_id === transferForm.destination_account_id) {
      alert('Source and destination accounts must be different');
      return;
    }
    try {
      await apiClient.post('/api/v1/transfers', {
        source_account_id: parseInt(transferForm.source_account_id),
        destination_account_id: parseInt(transferForm.destination_account_id),
        amount: parseFloat(transferForm.amount),
        notes: transferForm.notes,
        date: transferForm.date,
      });
      setIsTransferModalOpen(false);
      setTransferForm({
        source_account_id: accounts[0]?.id || '',
        destination_account_id: accounts[1]?.id || '',
        amount: '',
        notes: '',
        date: new Date().toISOString().split('T')[0],
      });
      loadAllFinanceData();
    } catch (err) {
      alert(err.response?.data?.message || 'Transfer failed');
    }
  };

  // 4. Create Account
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!accountForm.name) return;
    try {
      await apiClient.post('/api/v1/accounts', {
        name: accountForm.name,
        type: accountForm.type,
        institution_name: accountForm.institution_name,
        account_number: accountForm.account_number,
        opening_balance: parseFloat(accountForm.opening_balance || 0),
      });
      setIsAccountModalOpen(false);
      setAccountForm({
        name: '',
        type: 'Bank',
        institution_name: '',
        account_number: '',
        opening_balance: '',
      });
      loadAllFinanceData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create account');
    }
  };

  // 5. Archive Account
  const handleArchiveAccount = async (id) => {
    if (!window.confirm('Archive this account? Historical transactions will remain preserved.')) return;
    try {
      await apiClient.delete(`/api/v1/accounts/${id}`);
      loadAllFinanceData();
    } catch (err) {
      alert('Failed to archive account');
    }
  };

  // 6. Set Category Budget
  const handleSetCategoryBudget = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/api/v1/budgets', {
        category: catBudgetForm.category,
        amount: parseFloat(catBudgetForm.amount),
      });
      setIsBudgetModalOpen(false);
      setCatBudgetForm({ category: 'Food', amount: '' });
      loadAllFinanceData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save budget');
    }
  };

  // 7. Delete Category Budget
  const handleDeleteBudget = async (id) => {
    try {
      await apiClient.delete(`/api/v1/budgets/${id}`);
      loadAllFinanceData();
    } catch (err) {
      alert('Failed to delete budget');
    }
  };

  // 8. Create Savings Goal
  const handleCreateGoal = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/api/v1/savings-goals', {
        name: goalForm.name,
        target_amount: parseFloat(goalForm.target_amount),
        target_date: goalForm.target_date,
        category: goalForm.category,
      });
      setIsGoalModalOpen(false);
      setGoalForm({ name: '', target_amount: '', target_date: '', category: 'Emergency Fund' });
      loadAllFinanceData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create goal');
    }
  };

  // 9. Contribute to Savings Goal
  const handleContributeGoal = async (e) => {
    e.preventDefault();
    if (!selectedGoal || !contributeForm.amount) return;
    try {
      await apiClient.post(`/api/v1/savings-goals/${selectedGoal.id}/contribute`, {
        account_id: parseInt(contributeForm.account_id),
        amount: parseFloat(contributeForm.amount),
        notes: contributeForm.notes,
      });
      setIsContributeModalOpen(false);
      setSelectedGoal(null);
      setContributeForm({ account_id: accounts[0]?.id || '', amount: '', notes: '' });
      loadAllFinanceData();
    } catch (err) {
      alert(err.response?.data?.message || 'Contribution failed');
    }
  };

  // 10. Create Recurring Transaction
  const handleCreateRecurring = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/api/v1/recurring-transactions', {
        account_id: recurringForm.account_id ? parseInt(recurringForm.account_id) : null,
        type: recurringForm.type,
        amount: parseFloat(recurringForm.amount),
        description: recurringForm.description,
        category: recurringForm.category,
        frequency: recurringForm.frequency,
        start_date: recurringForm.start_date,
      });
      setIsRecurringModalOpen(false);
      loadAllFinanceData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create recurring rule');
    }
  };

  // 11. Run Recurring Processor (Idempotent)
  const handleProcessRecurring = async () => {
    try {
      const res = await apiClient.post('/api/v1/recurring-transactions/process');
      alert(`Recurring transactions processed: ${res.data.processed_count} rule(s) executed.`);
      loadAllFinanceData();
    } catch (err) {
      alert('Error running recurring processor');
    }
  };

  // ─── DERIVED FIGURES ──────────────────────────────────────────────────────
  const totalIncome = parseFloat(summary?.totals?.total_income || 0);
  const totalExpense = parseFloat(summary?.totals?.total_expense || 0);
  const totalSavings = parseFloat(summary?.totals?.total_savings || totalIncome - totalExpense);
  const totalAccountBalance = parseFloat(summary?.totals?.total_account_balance || totalSavings);
  const monthlyOverallBudget = parseFloat(user?.monthly_budget || 0);
  const remainingOverallBudget = Math.max(0, monthlyOverallBudget - totalExpense);
  const budgetUtilization = monthlyOverallBudget > 0 ? Math.min(100, (totalExpense / monthlyOverallBudget) * 100) : 0;

  // Chart Data
  const pieData = (summary?.byCategory || []).map((item, idx) => ({
    name: item.category,
    value: parseFloat(item.total),
    fill: CATEGORY_COLORS[item.category] || CHART_PALETTE[idx % CHART_PALETTE.length],
  }));

  const monthlyData = (summary?.monthly || []).map((m) => ({
    month: m.month_label,
    Income: parseFloat(m.income || 0),
    Expense: parseFloat(m.expense || 0),
  }));

  const categoryOptions = [
    'General',
    'Food',
    'Transport',
    'Utilities',
    'Entertainment',
    'Shopping',
    'Health',
    'Education',
    'Investment',
  ];

  const paymentOptions = ['UPI', 'Cash', 'Debit Card', 'Credit Card', 'Bank Transfer'];

  const accountTypeIcon = (type) => {
    switch (type) {
      case 'Bank':
      case 'Savings':
        return <Building size={16} className="text-electric-blue" />;
      case 'UPI':
        return <Smartphone size={16} className="text-aqua-teal" />;
      case 'Cash':
        return <Banknote size={16} className="text-emerald-500" />;
      case 'Credit Card':
        return <CreditCard size={16} className="text-rose-500" />;
      default:
        return <Wallet size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Main Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-royal-navy tracking-tight">Personal Finance</h2>
          <p className="text-xs text-muted-text mt-0.5">
            Manage multi-accounts, zero-sum transfers, category budgets, savings goals & automated recurring schedules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <GlassButton
            variant="outline"
            size="sm"
            icon={ArrowRightLeft}
            onClick={() => setIsTransferModalOpen(true)}
          >
            <span>Transfer Money</span>
          </GlassButton>
          <GlassButton
            variant="secondary"
            size="sm"
            icon={Building}
            onClick={() => setIsAccountModalOpen(true)}
          >
            <span>+ New Account</span>
          </GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setIsAddTxnModalOpen(true)}
            className="shadow-sm hover:shadow-electric-blue/30"
          >
            <span>Add Transaction</span>
          </GlassButton>
        </div>
      </div>

      {/* Module Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'overview', label: 'Overview & Ledger' },
          { id: 'accounts', label: `Accounts (${accounts.length})` },
          { id: 'budgets', label: `Budgets (${categoryBudgets.length})` },
          { id: 'goals', label: `Savings Goals (${savingsGoals.length})` },
          { id: 'recurring', label: `Recurring (${recurringRules.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-royal-navy to-electric-blue text-white shadow-sm'
                : 'text-muted-text hover:text-royal-navy hover:bg-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1: OVERVIEW & LEDGER ─────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 Core Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassCard variant="gradient">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-text uppercase tracking-wider">
                  Net Balance
                </span>
                <div className="p-2 rounded-xl bg-electric-blue/15 text-electric-blue">
                  <Wallet size={18} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-royal-navy tracking-tight">
                ₹{totalAccountBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 text-[11px] text-muted-text flex items-center justify-between">
                <span>Across {accounts.length} active accounts</span>
                <span className="text-electric-blue font-bold">Verified</span>
              </div>
            </GlassCard>

            <GlassCard variant="standard">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-text uppercase tracking-wider">
                  Total Income
                </span>
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">
                ₹{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <ArrowUpRight size={12} />
                <span>Earned income (transfers excluded)</span>
              </div>
            </GlassCard>

            <GlassCard variant="standard">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-text uppercase tracking-wider">
                  Total Expense
                </span>
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-500">
                  <TrendingDown size={18} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight">
                ₹{totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                <ArrowDownRight size={12} />
                <span>Spending (transfers excluded)</span>
              </div>
            </GlassCard>

            <GlassCard variant="highlight">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-royal-navy uppercase tracking-wider">
                  Monthly Savings
                </span>
                <div className="p-2 rounded-xl bg-aqua-teal/25 text-royal-navy">
                  <PiggyBank size={18} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-royal-navy tracking-tight">
                ₹{totalSavings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2.5">
                <div className="flex justify-between text-[11px] font-semibold text-muted-text mb-1">
                  <span>Budget: ₹{monthlyOverallBudget.toLocaleString('en-IN')}</span>
                  <span>{budgetUtilization.toFixed(0)}% used</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      budgetUtilization > 90
                        ? 'bg-rose-500'
                        : budgetUtilization > 75
                        ? 'bg-amber-400'
                        : 'bg-gradient-to-r from-electric-blue to-aqua-teal'
                    }`}
                    style={{ width: `${budgetUtilization}%` }}
                  />
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Quick Accounts Snapshot Ribbon */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-royal-navy uppercase tracking-wider">
                My Accounts
              </span>
              <button
                onClick={() => setActiveTab('accounts')}
                className="text-xs text-electric-blue font-semibold hover:underline"
              >
                Manage Accounts →
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-2xl bg-white/75 border border-slate-200/80 hover:border-electric-blue/40 shadow-sm transition"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-100">{accountTypeIcon(acc.type)}</div>
                      <span className="font-semibold text-xs text-royal-navy truncate max-w-[120px]">
                        {acc.name}
                      </span>
                    </div>
                    <GlassBadge variant={acc.type === 'Credit Card' ? 'rose' : 'blue'} size="sm">
                      {acc.type}
                    </GlassBadge>
                  </div>
                  <div className="text-lg font-extrabold text-royal-navy">
                    ₹{parseFloat(acc.current_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-muted-text mt-1 truncate">
                    {acc.institution_name || 'Personal Account'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <GlassCard variant="standard" className="h-full">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-royal-navy text-base">Monthly Cash Flow</h3>
                    <p className="text-xs text-muted-text">Income vs Expense trends (Non-inflationary)</p>
                  </div>
                  <BarChart2 size={18} className="text-electric-blue" />
                </div>
                {monthlyData.length > 0 ? (
                  <div className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                        <Tooltip
                          formatter={(val) => `₹${val.toLocaleString('en-IN')}`}
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            borderRadius: '12px',
                            border: '1px solid rgba(57, 127, 232, 0.2)',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Expense" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-muted-text">
                    No historical trend data yet.
                  </div>
                )}
              </GlassCard>
            </div>

            <div className="lg:col-span-5">
              <GlassCard variant="standard" className="h-full">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-royal-navy text-base">Expense by Category</h3>
                    <p className="text-xs text-muted-text">Spending allocation (Excluding transfers)</p>
                  </div>
                  <PieIcon size={18} className="text-electric-blue" />
                </div>
                {pieData.length > 0 ? (
                  <div className="h-64 sm:h-72 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={45}
                          paddingAngle={3}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val) => `₹${val.toLocaleString('en-IN')}`} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-muted-text">
                    No expense categorized yet.
                  </div>
                )}
              </GlassCard>
            </div>
          </div>

          {/* Transactions Ledger with Search & Advanced Filters */}
          <GlassCard variant="standard">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 mb-4">
              <div>
                <h3 className="text-lg font-bold text-royal-navy">Transaction Ledger</h3>
                <p className="text-xs text-muted-text">Complete record of income, expenses, and internal transfers</p>
              </div>

              {/* Search & Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-muted-text" />
                  <input
                    type="text"
                    placeholder="Search description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs glass-input bg-white/80 w-44"
                  />
                </div>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-2.5 py-1.5 text-xs glass-input bg-white/80"
                >
                  <option value="">All Types</option>
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                  <option value="Transfer">Transfer</option>
                </select>

                <select
                  value={filterAccount}
                  onChange={(e) => setFilterAccount(e.target.value)}
                  className="px-2.5 py-1.5 text-xs glass-input bg-white/80"
                >
                  <option value="">All Accounts</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-2.5 py-1.5 text-xs glass-input bg-white/80"
                >
                  <option value="">All Categories</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-2.5 py-1.5 text-xs glass-input bg-white/80"
                />

                {(filterType || filterCategory || filterAccount || filterDate || searchQuery) && (
                  <button
                    onClick={() => {
                      setFilterType('');
                      setFilterCategory('');
                      setFilterAccount('');
                      setFilterDate('');
                      setSearchQuery('');
                    }}
                    className="text-xs text-rose-500 font-semibold hover:underline px-2"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto">
              {transactions.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/60 text-[11px] font-bold text-muted-text uppercase tracking-wider">
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Account</th>
                      <th className="py-3 px-3">Description</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Method</th>
                      <th className="py-3 px-3 text-right">Amount</th>
                      <th className="py-3 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {transactions.map((t) => {
                      const isInc = t.type === 'Income';
                      const isTransfer = t.type === 'Transfer';
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3 text-xs text-muted-text whitespace-nowrap">
                            {t.txn_date ? t.txn_date.slice(0, 10) : ''}
                          </td>
                          <td className="py-3 px-3 text-xs font-medium text-royal-navy whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              {t.account_name || 'Primary Bank Account'}
                              {isTransfer && t.transfer_account_name && (
                                <span className="text-muted-text">→ {t.transfer_account_name}</span>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-royal-navy">
                            <div>{t.description}</div>
                            {t.notes && <div className="text-[11px] font-normal text-muted-text">{t.notes}</div>}
                          </td>
                          <td className="py-3 px-3">
                            <GlassBadge
                              variant={isTransfer ? 'lavender' : isInc ? 'mint' : 'blue'}
                              size="sm"
                            >
                              {t.category || (isTransfer ? 'Transfer' : 'General')}
                            </GlassBadge>
                          </td>
                          <td className="py-3 px-3 text-xs text-muted-text">{t.payment_mode || 'Cash'}</td>
                          <td
                            className={`py-3 px-3 text-right font-bold whitespace-nowrap ${
                              isTransfer ? 'text-purple-600' : isInc ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {isTransfer ? '⇄ ' : isInc ? '+' : '-'}₹
                            {parseFloat(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleDeleteTransaction(t.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                              title="Delete transaction"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-muted-text text-sm">
                  <p>No transactions found matching your criteria.</p>
                  <GlassButton
                    variant="outline"
                    size="sm"
                    icon={Plus}
                    onClick={() => setIsAddTxnModalOpen(true)}
                    className="mt-3"
                  >
                    Log first transaction
                  </GlassButton>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ─── TAB 2: MULTIPLE ACCOUNTS ─────────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-royal-navy">My Accounts</h3>
              <p className="text-xs text-muted-text">Manage your bank accounts, physical cash, UPI handles, and credit cards</p>
            </div>
            <GlassButton variant="primary" size="sm" icon={Plus} onClick={() => setIsAccountModalOpen(true)}>
              Add New Account
            </GlassButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <GlassCard key={acc.id} variant="standard">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-100">{accountTypeIcon(acc.type)}</div>
                    <div>
                      <h4 className="font-bold text-sm text-royal-navy">{acc.name}</h4>
                      <p className="text-xs text-muted-text">{acc.institution_name || acc.type}</p>
                    </div>
                  </div>
                  <GlassBadge variant={acc.type === 'Credit Card' ? 'rose' : 'blue'} size="sm">
                    {acc.type}
                  </GlassBadge>
                </div>

                <div className="my-3 py-2 border-y border-slate-100">
                  <div className="text-xs text-muted-text">Current Balance</div>
                  <div className="text-2xl font-extrabold text-royal-navy mt-0.5">
                    ₹{parseFloat(acc.current_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Opening Balance: ₹{parseFloat(acc.opening_balance).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                    ● {acc.status}
                  </span>
                  <button
                    onClick={() => handleArchiveAccount(acc.id)}
                    className="text-xs text-slate-400 hover:text-rose-500 transition flex items-center gap-1"
                  >
                    <Archive size={13} />
                    <span>Archive</span>
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 3: CATEGORY BUDGETS ───────────────────────────────────────── */}
      {activeTab === 'budgets' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-royal-navy">Category Budgets</h3>
              <p className="text-xs text-muted-text">Monthly category-level spending limits with real-time utilization warnings</p>
            </div>
            <GlassButton variant="primary" size="sm" icon={Plus} onClick={() => setIsBudgetModalOpen(true)}>
              Set Category Budget
            </GlassButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryBudgets.map((b) => (
              <GlassCard key={b.id} variant="standard">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-royal-navy">{b.category}</span>
                  <GlassBadge variant={b.is_overbudget ? 'rose' : b.percentage > 80 ? 'amber' : 'mint'} size="sm">
                    {b.percentage}% Used
                  </GlassBadge>
                </div>

                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xl font-extrabold text-royal-navy">
                    ₹{b.spent.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-muted-text">of ₹{b.amount.toLocaleString('en-IN')}</span>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      b.is_overbudget ? 'bg-rose-500' : b.percentage > 80 ? 'bg-amber-400' : 'bg-electric-blue'
                    }`}
                    style={{ width: `${Math.min(100, b.percentage)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-text pt-2 border-t border-slate-100">
                  <span>Remaining: ₹{b.remaining.toLocaleString('en-IN')}</span>
                  <button
                    onClick={() => handleDeleteBudget(b.id)}
                    className="text-slate-400 hover:text-rose-500 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 4: SAVINGS GOALS ─────────────────────────────────────────── */}
      {activeTab === 'goals' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-royal-navy">Savings Goals</h3>
              <p className="text-xs text-muted-text">Target funds for travel, emergency buffer, devices, or investments</p>
            </div>
            <GlassButton variant="primary" size="sm" icon={Plus} onClick={() => setIsGoalModalOpen(true)}>
              New Savings Goal
            </GlassButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savingsGoals.map((g) => (
              <GlassCard key={g.id} variant="standard">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-sm text-royal-navy">{g.name}</h4>
                    <span className="text-xs text-muted-text">{g.category}</span>
                  </div>
                  <GlassBadge variant={g.status === 'Completed' ? 'mint' : 'blue'} size="sm">
                    {g.progress}%
                  </GlassBadge>
                </div>

                <div className="my-3">
                  <div className="flex justify-between text-xs text-muted-text mb-1">
                    <span>Saved: ₹{g.current_amount.toLocaleString('en-IN')}</span>
                    <span>Target: ₹{g.target_amount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-electric-blue to-aqua-teal transition-all duration-300"
                      style={{ width: `${Math.min(100, g.progress)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-muted-text">
                    {g.target_date ? `Due: ${g.target_date.slice(0, 10)}` : 'Open ended'}
                  </span>
                  <GlassButton
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedGoal(g);
                      setIsContributeModalOpen(true);
                    }}
                  >
                    + Deposit Funds
                  </GlassButton>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 5: RECURRING TRANSACTIONS ─────────────────────────────────── */}
      {activeTab === 'recurring' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-royal-navy">Automated Recurring Transactions</h3>
              <p className="text-xs text-muted-text">Schedules for rent, salaries, subscriptions, and recurring bills</p>
            </div>
            <div className="flex items-center gap-2">
              <GlassButton variant="outline" size="sm" icon={RefreshCw} onClick={handleProcessRecurring}>
                Run Processor
              </GlassButton>
              <GlassButton variant="primary" size="sm" icon={Plus} onClick={() => setIsRecurringModalOpen(true)}>
                Add Schedule
              </GlassButton>
            </div>
          </div>

          <GlassCard variant="standard">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200/60 text-[11px] font-bold text-muted-text uppercase">
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Frequency</th>
                    <th className="py-3 px-3">Account</th>
                    <th className="py-3 px-3">Start Date</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recurringRules.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 px-3 font-semibold text-royal-navy">{r.description}</td>
                      <td className="py-3 px-3">
                        <GlassBadge variant={r.type === 'Income' ? 'mint' : 'rose'} size="sm">
                          {r.type}
                        </GlassBadge>
                      </td>
                      <td className="py-3 px-3 text-xs capitalize text-muted-text">{r.frequency}</td>
                      <td className="py-3 px-3 text-xs text-muted-text">{r.account_name || 'Primary'}</td>
                      <td className="py-3 px-3 text-xs text-muted-text">{r.start_date.slice(0, 10)}</td>
                      <td className="py-3 px-3 text-right font-bold text-royal-navy">
                        ₹{parseFloat(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODALS                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* 1. Add Transaction Modal */}
      <GlassModal
        isOpen={isAddTxnModalOpen}
        onClose={() => setIsAddTxnModalOpen(false)}
        title="Add Transaction"
        subtitle="Log income or expense to an account"
      >
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTxnForm({ ...txnForm, type: 'Expense' })}
              className={`py-2 rounded-xl text-xs font-bold transition border ${
                txnForm.type === 'Expense' ? 'bg-rose-500 text-white border-rose-500' : 'bg-white/60 text-muted-text'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setTxnForm({ ...txnForm, type: 'Income' })}
              className={`py-2 rounded-xl text-xs font-bold transition border ${
                txnForm.type === 'Income' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/60 text-muted-text'
              }`}
            >
              Income
            </button>
          </div>

          <GlassInput
            label="Amount (₹)"
            type="number"
            step="0.01"
            placeholder="e.g. 250"
            value={txnForm.amount}
            onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
            required
          />

          <GlassInput
            label="Description"
            placeholder="e.g. Lunch at Cafe, Grocery"
            value={txnForm.description}
            onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <GlassSelect
              label="Account"
              value={txnForm.accountId}
              onChange={(e) => setTxnForm({ ...txnForm, accountId: e.target.value })}
              options={accounts.map((a) => ({ value: a.id, label: `${a.name} (₹${parseFloat(a.current_balance).toLocaleString('en-IN')})` }))}
            />

            <GlassSelect
              label="Category"
              value={txnForm.category}
              onChange={(e) => setTxnForm({ ...txnForm, category: e.target.value })}
              options={categoryOptions}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <GlassSelect
              label="Payment Mode"
              value={txnForm.paymentMode}
              onChange={(e) => setTxnForm({ ...txnForm, paymentMode: e.target.value })}
              options={paymentOptions}
            />
            <GlassInput
              label="Date"
              type="date"
              value={txnForm.date}
              onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })}
              required
            />
          </div>

          <GlassInput
            label="Notes (Optional)"
            placeholder="e.g. Split with friends"
            value={txnForm.notes}
            onChange={(e) => setTxnForm({ ...txnForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsAddTxnModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" size="sm">
              Save Transaction
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* 2. Transfer Modal (Critical Zero-Sum Account-to-Account) */}
      <GlassModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Transfer Between Accounts"
        subtitle="Zero-sum transfer: updates both accounts without inflating expenses"
      >
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <GlassSelect
              label="From Account (Source)"
              value={transferForm.source_account_id}
              onChange={(e) => setTransferForm({ ...transferForm, source_account_id: e.target.value })}
              options={accounts.map((a) => ({ value: a.id, label: `${a.name} (₹${parseFloat(a.current_balance).toLocaleString('en-IN')})` }))}
              required
            />

            <GlassSelect
              label="To Account (Destination)"
              value={transferForm.destination_account_id}
              onChange={(e) => setTransferForm({ ...transferForm, destination_account_id: e.target.value })}
              options={accounts.map((a) => ({ value: a.id, label: `${a.name} (₹${parseFloat(a.current_balance).toLocaleString('en-IN')})` }))}
              required
            />
          </div>

          <GlassInput
            label="Amount (₹)"
            type="number"
            step="0.01"
            placeholder="e.g. 2000"
            value={transferForm.amount}
            onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
            required
          />

          <GlassInput
            label="Transfer Date"
            type="date"
            value={transferForm.date}
            onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
            required
          />

          <GlassInput
            label="Notes (Optional)"
            placeholder="e.g. Self-transfer for grocery"
            value={transferForm.notes}
            onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsTransferModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" size="sm">
              Confirm Transfer
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* 3. Create Account Modal */}
      <GlassModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title="Add Account"
        subtitle="Create a bank, cash, UPI, or credit card wallet"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <GlassInput
            label="Account Name"
            placeholder="e.g. ICICI Bank, Paytm UPI, Cash"
            value={accountForm.name}
            onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <GlassSelect
              label="Account Type"
              value={accountForm.type}
              onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}
              options={['Bank', 'Cash', 'UPI', 'Credit Card', 'Savings']}
            />
            <GlassInput
              label="Institution (Optional)"
              placeholder="e.g. HDFC, SBI"
              value={accountForm.institution_name}
              onChange={(e) => setAccountForm({ ...accountForm, institution_name: e.target.value })}
            />
          </div>

          <GlassInput
            label="Initial Opening Balance (₹)"
            type="number"
            placeholder="e.g. 5000"
            value={accountForm.opening_balance}
            onChange={(e) => setAccountForm({ ...accountForm, opening_balance: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsAccountModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" size="sm">
              Create Account
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* 4. Set Category Budget Modal */}
      <GlassModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        title="Set Category Budget"
        subtitle="Define spending limits for specific categories"
      >
        <form onSubmit={handleSetCategoryBudget} className="space-y-4">
          <GlassSelect
            label="Category"
            value={catBudgetForm.category}
            onChange={(e) => setCatBudgetForm({ ...catBudgetForm, category: e.target.value })}
            options={categoryOptions}
          />
          <GlassInput
            label="Monthly Limit (₹)"
            type="number"
            placeholder="e.g. 8000"
            value={catBudgetForm.amount}
            onChange={(e) => setCatBudgetForm({ ...catBudgetForm, amount: e.target.value })}
            required
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsBudgetModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" size="sm">
              Save Budget
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* 5. Savings Goal Modal */}
      <GlassModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        title="New Savings Goal"
        subtitle="Set up a target amount and deadline"
      >
        <form onSubmit={handleCreateGoal} className="space-y-4">
          <GlassInput
            label="Goal Name"
            placeholder="e.g. Emergency Fund, Laptop"
            value={goalForm.name}
            onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
            required
          />
          <GlassInput
            label="Target Amount (₹)"
            type="number"
            placeholder="e.g. 100000"
            value={goalForm.target_amount}
            onChange={(e) => setGoalForm({ ...goalForm, target_amount: e.target.value })}
            required
          />
          <GlassInput
            label="Target Date (Optional)"
            type="date"
            value={goalForm.target_date}
            onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsGoalModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" size="sm">
              Create Goal
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* 6. Deposit to Savings Goal Modal */}
      <GlassModal
        isOpen={isContributeModalOpen}
        onClose={() => setIsContributeModalOpen(false)}
        title={`Deposit to ${selectedGoal?.name || 'Goal'}`}
        subtitle="Transfer funds from an account into your savings goal"
      >
        <form onSubmit={handleContributeGoal} className="space-y-4">
          <GlassSelect
            label="Source Account"
            value={contributeForm.account_id}
            onChange={(e) => setContributeForm({ ...contributeForm, account_id: e.target.value })}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} (₹${parseFloat(a.current_balance).toLocaleString('en-IN')})` }))}
            required
          />
          <GlassInput
            label="Deposit Amount (₹)"
            type="number"
            placeholder="e.g. 5000"
            value={contributeForm.amount}
            onChange={(e) => setContributeForm({ ...contributeForm, amount: e.target.value })}
            required
          />
          <GlassInput
            label="Notes"
            placeholder="e.g. Monthly contribution"
            value={contributeForm.notes}
            onChange={(e) => setContributeForm({ ...contributeForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsContributeModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" size="sm">
              Deposit Funds
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* 7. Recurring Schedule Modal */}
      <GlassModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        title="Schedule Recurring Transaction"
        subtitle="Automate recurring income or expenses"
      >
        <form onSubmit={handleCreateRecurring} className="space-y-4">
          <GlassInput
            label="Description"
            placeholder="e.g. Netflix Subscription, Rent"
            value={recurringForm.description}
            onChange={(e) => setRecurringForm({ ...recurringForm, description: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <GlassSelect
              label="Type"
              value={recurringForm.type}
              onChange={(e) => setRecurringForm({ ...recurringForm, type: e.target.value })}
              options={['Expense', 'Income']}
            />
            <GlassSelect
              label="Frequency"
              value={recurringForm.frequency}
              onChange={(e) => setRecurringForm({ ...recurringForm, frequency: e.target.value })}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'daily', label: 'Daily' },
                { value: 'yearly', label: 'Yearly' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <GlassInput
              label="Amount (₹)"
              type="number"
              placeholder="e.g. 1000"
              value={recurringForm.amount}
              onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })}
              required
            />
            <GlassSelect
              label="Account"
              value={recurringForm.account_id}
              onChange={(e) => setRecurringForm({ ...recurringForm, account_id: e.target.value })}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsRecurringModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" size="sm">
              Save Schedule
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  );
}
