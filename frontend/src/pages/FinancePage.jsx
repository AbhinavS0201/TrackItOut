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
  DollarSign,
  PieChart as PieIcon,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
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
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  // Form state
  const [txnForm, setTxnForm] = useState({
    type: 'Expense',
    amount: '',
    description: '',
    category: 'Food',
    paymentMode: 'UPI',
    date: new Date().toISOString().split('T')[0],
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Load transactions and summary
  const loadFinanceData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      let txnUrl = `/transactions/${user.id}`;
      const queryParams = [];
      if (filterDate) queryParams.push(`date=${filterDate}`);
      if (filterCategory) queryParams.push(`category=${encodeURIComponent(filterCategory)}`);
      if (filterType) queryParams.push(`type=${filterType}`);
      if (queryParams.length > 0) txnUrl += `?${queryParams.join('&')}`;

      const [txnRes, summaryRes] = await Promise.all([
        apiClient.get(txnUrl),
        apiClient.get(`/summary/${user.id}`),
      ]);

      setTransactions(Array.isArray(txnRes.data) ? txnRes.data : []);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error('Failed to load finance data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, filterDate, filterCategory, filterType]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  useEffect(() => {
    if (user?.monthly_budget) {
      setBudgetInput(String(user.monthly_budget));
    }
  }, [user]);

  // Handle Add Transaction
  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!txnForm.amount || !txnForm.description) return;

    setFormSubmitting(true);
    try {
      await apiClient.post('/add-transaction', {
        Type: txnForm.type,
        Amount: parseFloat(txnForm.amount),
        Description: txnForm.description,
        Category: txnForm.category,
        PaymentMode: txnForm.paymentMode,
        Date: txnForm.date,
      });

      setIsAddModalOpen(false);
      setTxnForm({
        type: 'Expense',
        amount: '',
        description: '',
        category: 'Food',
        paymentMode: 'UPI',
        date: new Date().toISOString().split('T')[0],
      });
      loadFinanceData();
    } catch (err) {
      console.error('Failed to add transaction:', err);
      alert(err.response?.data?.message || 'Error saving transaction');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Delete Transaction
  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await apiClient.delete(`/transaction/${id}`);
      loadFinanceData();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete transaction');
    }
  };

  // Handle Save Budget
  const handleSaveBudget = async (e) => {
    e.preventDefault();
    const val = parseFloat(budgetInput);
    if (isNaN(val) || val < 0) return;

    try {
      await updateMonthlyBudget(val);
      setIsBudgetModalOpen(false);
    } catch (err) {
      console.error('Error updating budget:', err);
      alert('Failed to update monthly budget');
    }
  };

  // Calculations
  const totalIncome = parseFloat(summary?.totals?.total_income || 0);
  const totalExpense = parseFloat(summary?.totals?.total_expense || 0);
  const balance = totalIncome - totalExpense;
  const monthlyBudget = parseFloat(user?.monthly_budget || 0);
  const budgetUtilization = monthlyBudget > 0 ? Math.min(100, (totalExpense / monthlyBudget) * 100) : 0;
  const remainingBudget = Math.max(0, monthlyBudget - totalExpense);

  // Category Pie Data
  const pieData = (summary?.byCategory || []).map((item, idx) => ({
    name: item.category,
    value: parseFloat(item.total),
    fill: CATEGORY_COLORS[item.category] || CHART_PALETTE[idx % CHART_PALETTE.length],
  }));

  // Monthly Bar Data
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
  ];

  const paymentOptions = ['UPI', 'Cash', 'Debit Card', 'Credit Card', 'Bank Transfer'];

  return (
    <div className="space-y-6">
      {/* Top Banner: Actions & Quick Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-royal-navy tracking-tight">Personal Finance</h2>
          <p className="text-xs text-muted-text mt-0.5">
            Manage your daily transactions, multi-account balances, and monthly budget limits.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <GlassButton
            variant="outline"
            size="sm"
            icon={PiggyBank}
            onClick={() => setIsBudgetModalOpen(true)}
          >
            <span>Set Budget</span>
          </GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setIsAddModalOpen(true)}
            className="shadow-sm hover:shadow-electric-blue/30"
          >
            <span>Add Transaction</span>
          </GlassButton>
        </div>
      </div>

      {/* 4 Core Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Balance */}
        <GlassCard variant="gradient" className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wider">
              Total Balance
            </span>
            <div className="p-2 rounded-xl bg-electric-blue/15 text-electric-blue">
              <Wallet size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-royal-navy tracking-tight">
            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-[11px] text-muted-text flex items-center gap-1">
            <span>Net calculated from all accounts</span>
          </div>
        </GlassCard>

        {/* Total Income */}
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
            <span>Lifetime recorded income</span>
          </div>
        </GlassCard>

        {/* Total Expense */}
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
            <span>{transactions.filter((t) => t.type === 'Expense').length} expenses logged</span>
          </div>
        </GlassCard>

        {/* Monthly Budget */}
        <GlassCard variant="highlight">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-royal-navy uppercase tracking-wider">
              Monthly Budget
            </span>
            <div className="p-2 rounded-xl bg-aqua-teal/25 text-royal-navy">
              <PiggyBank size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-royal-navy tracking-tight">
            ₹{monthlyBudget.toLocaleString('en-IN')}
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[11px] font-semibold text-muted-text mb-1">
              <span>Used: {budgetUtilization.toFixed(0)}%</span>
              <span>₹{remainingBudget.toLocaleString('en-IN')} left</span>
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

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Income vs Expense Monthly Trend */}
        <div className="lg:col-span-7">
          <GlassCard variant="standard" className="h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-royal-navy text-base">Monthly Cash Flow</h3>
                <p className="text-xs text-muted-text">Income vs. Expense past 6 months</p>
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
                        boxShadow: '0 8px 24px rgba(7, 27, 58, 0.1)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expense" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted-text text-xs">
                <span>No monthly transaction data available yet.</span>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Category Expense Breakdown */}
        <div className="lg:col-span-5">
          <GlassCard variant="standard" className="h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-royal-navy text-base">Expense by Category</h3>
                <p className="text-xs text-muted-text">Where your money goes</p>
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
                    <Tooltip
                      formatter={(val) => `₹${val.toLocaleString('en-IN')}`}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '12px',
                        border: '1px solid rgba(57, 127, 232, 0.2)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted-text text-xs">
                <span>No expense categorization data yet.</span>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Transaction History & Filters */}
      <GlassCard variant="standard">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 mb-4">
          <div>
            <h3 className="text-lg font-bold text-royal-navy">Transaction History</h3>
            <p className="text-xs text-muted-text">Showing all logged income and expenses</p>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 text-xs glass-input bg-white/80"
            >
              <option value="">All Types</option>
              <option value="Income">Income Only</option>
              <option value="Expense">Expense Only</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 text-xs glass-input bg-white/80"
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
              className="px-3 py-1.5 text-xs glass-input bg-white/80"
            />

            {(filterType || filterCategory || filterDate) && (
              <button
                onClick={() => {
                  setFilterType('');
                  setFilterCategory('');
                  setFilterDate('');
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
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Payment Mode</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {transactions.map((t) => {
                  const isInc = t.type === 'Income';
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 text-xs text-muted-text whitespace-nowrap">
                        {t.txn_date ? t.txn_date.slice(0, 10) : ''}
                      </td>
                      <td className="py-3 px-3 font-semibold text-royal-navy">
                        {t.description}
                      </td>
                      <td className="py-3 px-3">
                        <GlassBadge
                          variant={isInc ? 'mint' : 'blue'}
                          size="sm"
                        >
                          {t.category || 'General'}
                        </GlassBadge>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-text">
                        {t.payment_mode || 'Cash'}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-bold whitespace-nowrap ${
                          isInc ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {isInc ? '+' : '-'}₹
                        {parseFloat(t.amount).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
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
                onClick={() => setIsAddModalOpen(true)}
                className="mt-3"
              >
                Log first transaction
              </GlassButton>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Add Transaction Glass Modal */}
      <GlassModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Transaction"
        subtitle="Log income or expense with category and payment method"
      >
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTxnForm({ ...txnForm, type: 'Expense' })}
              className={`py-2 rounded-xl text-xs font-bold transition border ${
                txnForm.type === 'Expense'
                  ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                  : 'bg-white/60 text-muted-text border-slate-200 hover:bg-white'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setTxnForm({ ...txnForm, type: 'Income' })}
              className={`py-2 rounded-xl text-xs font-bold transition border ${
                txnForm.type === 'Income'
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                  : 'bg-white/60 text-muted-text border-slate-200 hover:bg-white'
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
            placeholder="e.g. Lunch at Cafe, Salary, Grocery"
            value={txnForm.description}
            onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GlassSelect
              label="Category"
              value={txnForm.category}
              onChange={(e) => setTxnForm({ ...txnForm, category: e.target.value })}
              options={categoryOptions}
            />

            <GlassSelect
              label="Payment Mode"
              value={txnForm.paymentMode}
              onChange={(e) => setTxnForm({ ...txnForm, paymentMode: e.target.value })}
              options={paymentOptions}
            />
          </div>

          <GlassInput
            label="Date"
            type="date"
            value={txnForm.date}
            onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })}
            required
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              size="sm"
              loading={formSubmitting}
            >
              Save Transaction
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* Set Monthly Budget Modal */}
      <GlassModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        title="Set Monthly Budget"
        subtitle="Configure your target spending limit for the month"
      >
        <form onSubmit={handleSaveBudget} className="space-y-4">
          <GlassInput
            label="Monthly Budget Target (₹)"
            type="number"
            step="100"
            placeholder="e.g. 25000"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            helperText="TrackItOut will monitor your utilization against this budget in real-time."
            required
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => setIsBudgetModalOpen(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" size="sm">
              Save Budget
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  );
}
