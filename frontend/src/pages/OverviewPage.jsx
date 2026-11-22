import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Apple,
  Dumbbell,
  CheckSquare,
  Sparkles,
  ArrowUpRight,
  Flame,
  Droplet,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCopilot } from '../context/CopilotContext';
import apiClient from '../api/client';
import GlassCard from '../components/common/GlassCard';
import GlassButton from '../components/common/GlassButton';
import GlassBadge from '../components/common/GlassBadge';

export default function OverviewPage() {
  const { user } = useAuth();
  const { setIsOpen: setCopilotOpen, processCommand } = useCopilot();

  const [financeSummary, setFinanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load live finance summary from backend
  useEffect(() => {
    if (!user) return;
    apiClient
      .get(`/summary/${user.id}`)
      .then((res) => {
        setFinanceSummary(res.data);
      })
      .catch((err) => {
        console.error('Failed to load summary for overview:', err);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const totalIncome = parseFloat(financeSummary?.totals?.total_income || 0);
  const totalExpense = parseFloat(financeSummary?.totals?.total_expense || 0);
  const balance = totalIncome - totalExpense;
  const monthlyBudget = parseFloat(user?.monthly_budget || 0);
  const budgetUtilization = monthlyBudget > 0 ? Math.min(100, (totalExpense / monthlyBudget) * 100) : 0;

  // Placeholder / Visual structure for Nutrition & Lifestyle (clearly labeled preview)
  const dailyNutrition = {
    calories: 1450,
    calorieTarget: 2200,
    protein: 112,
    proteinTarget: 140,
    carbs: 165,
    carbsTarget: 220,
    fats: 45,
    fatsTarget: 65,
  };

  const dailyHabits = [
    { id: 1, name: 'Drink 3L Water', completed: true, streak: 12 },
    { id: 2, name: 'Chest & Triceps Workout', completed: true, streak: 5 },
    { id: 3, name: 'Read 30 mins', completed: false, streak: 8 },
    { id: 4, name: 'Sleep 8 Hours', completed: false, streak: 3 },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 glass-card-gradient border border-white/80 shadow-glass">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-electric-blue uppercase tracking-wider">
              ✦ Personal Life Overview
            </span>
            <GlassBadge variant="aqua" size="sm">Active</GlassBadge>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-royal-navy tracking-tight">
            Welcome back, {user?.name?.split(' ')[0] || 'Friend'}!
          </h2>
          <p className="text-xs sm:text-sm text-muted-text mt-1">
            Here is your daily snapshot across finance, nutrition, workouts, and habits.
          </p>
        </div>

        {/* AI Copilot Prompt Launcher */}
        <div className="flex items-center gap-2">
          <GlassButton
            variant="gradient"
            size="md"
            icon={Sparkles}
            onClick={() => setCopilotOpen(true)}
            className="shadow-md hover:shadow-aqua-glow"
          >
            <span>Ask Copilot</span>
          </GlassButton>
        </div>
      </div>

      {/* 4 Pillars Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1: Finance */}
        <Link to="/finance" className="block group">
          <GlassCard variant="interactive" className="h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-royal-navy uppercase tracking-wider flex items-center gap-1.5">
                <Wallet size={14} className="text-electric-blue" /> Finance
              </span>
              <ArrowRight size={14} className="text-slate-400 group-hover:text-electric-blue group-hover:translate-x-1 transition-all" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-royal-navy">
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-text mt-2 pt-2 border-t border-slate-100">
              <span className="text-emerald-600 font-semibold">+₹{totalIncome.toLocaleString('en-IN')}</span>
              <span className="text-rose-500 font-semibold">-₹{totalExpense.toLocaleString('en-IN')}</span>
            </div>
          </GlassCard>
        </Link>

        {/* Pillar 2: Nutrition */}
        <Link to="/nutrition" className="block group">
          <GlassCard variant="interactive" className="h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-royal-navy uppercase tracking-wider flex items-center gap-1.5">
                <Apple size={14} className="text-emerald-500" /> Nutrition
              </span>
              <ArrowRight size={14} className="text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-royal-navy">
              {dailyNutrition.calories} <span className="text-xs font-normal text-muted-text">/ {dailyNutrition.calorieTarget} kcal</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-[11px] text-muted-text mb-1">
                <span>Protein: <strong className="text-aqua-teal font-bold">{dailyNutrition.protein}g</strong> / {dailyNutrition.proteinTarget}g</span>
                <span>{Math.round((dailyNutrition.protein / dailyNutrition.proteinTarget) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-aqua-teal"
                  style={{ width: `${Math.min(100, (dailyNutrition.protein / dailyNutrition.proteinTarget) * 100)}%` }}
                />
              </div>
            </div>
          </GlassCard>
        </Link>

        {/* Pillar 3: Fitness */}
        <Link to="/fitness" className="block group">
          <GlassCard variant="interactive" className="h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-royal-navy uppercase tracking-wider flex items-center gap-1.5">
                <Dumbbell size={14} className="text-electric-blue" /> Fitness
              </span>
              <ArrowRight size={14} className="text-slate-400 group-hover:text-electric-blue group-hover:translate-x-1 transition-all" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-royal-navy">
              Chest & Core <span className="text-xs font-normal text-emerald-600 block sm:inline">Completed</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-text mt-2 pt-2 border-t border-slate-100">
              <span>Bench 40kg (3x12)</span>
              <span className="text-electric-blue font-semibold">5-Day Streak</span>
            </div>
          </GlassCard>
        </Link>

        {/* Pillar 4: Habits */}
        <Link to="/habits" className="block group">
          <GlassCard variant="interactive" className="h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-royal-navy uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare size={14} className="text-pastel-lavender" /> Habits
              </span>
              <ArrowRight size={14} className="text-slate-400 group-hover:text-pastel-lavender group-hover:translate-x-1 transition-all" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-royal-navy">
              2 of 4 <span className="text-xs font-normal text-muted-text">Completed</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-text mt-2 pt-2 border-t border-slate-100">
              <span className="text-aqua-teal font-semibold flex items-center gap-1">
                <Droplet size={12} /> 2.5L Water
              </span>
              <span className="text-purple-600 font-semibold flex items-center gap-1">
                <Flame size={12} /> 12d Streak
              </span>
            </div>
          </GlassCard>
        </Link>
      </div>

      {/* Main Grid: AI Copilot Insights & Today's Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: AI Insights & Life Recommendations */}
        <div className="lg:col-span-7 space-y-4">
          <GlassCard variant="highlight">
            <div className="flex items-center justify-between pb-3 border-b border-electric-blue/20 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-electric-blue/15 text-electric-blue">
                  <Sparkles size={16} />
                </div>
                <h3 className="font-bold text-royal-navy text-sm">AI Copilot Life Intelligence</h3>
              </div>
              <GlassBadge variant="blue" size="sm">Real-time Insights</GlassBadge>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-white/70 border border-slate-200/60 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-electric-blue mt-1.5 flex-shrink-0" />
                <div className="text-xs text-main-text">
                  <strong className="text-royal-navy font-semibold">Spending Pace: </strong>
                  You have utilized {budgetUtilization.toFixed(0)}% of your monthly budget. At your current pace, your spending is well within your monthly limit.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/70 border border-slate-200/60 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-aqua-teal mt-1.5 flex-shrink-0" />
                <div className="text-xs text-main-text">
                  <strong className="text-royal-navy font-semibold">Nutrition Goal: </strong>
                  You need 28g more protein today to hit your 140g target. Consider 1 scoop of whey or 150g paneer for dinner.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/70 border border-slate-200/60 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-pastel-lavender mt-1.5 flex-shrink-0" />
                <div className="text-xs text-main-text">
                  <strong className="text-royal-navy font-semibold">Consistency Streak: </strong>
                  Workout streak is at 5 days! Keep up the momentum to break your personal record of 7 days.
                </div>
              </div>
            </div>

            {/* Quick Voice Prompt Trigger */}
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-[11px] text-muted-text">Speak to log anything in 2 seconds:</span>
              <button
                onClick={() => {
                  setCopilotOpen(true);
                  processCommand('Give me my daily progress');
                }}
                className="text-xs font-semibold text-electric-blue hover:text-royal-navy transition flex items-center gap-1"
              >
                <span>"Give me my daily progress"</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </GlassCard>
        </div>

        {/* Right: Daily Habit Tracker Quick Checklist */}
        <div className="lg:col-span-5 space-y-4">
          <GlassCard variant="standard" className="h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-royal-navy text-sm">Today's Habits & Routine</h3>
              <Link to="/habits" className="text-xs text-electric-blue font-semibold hover:underline">
                View all
              </Link>
            </div>

            <div className="space-y-2.5">
              {dailyHabits.map((habit) => (
                <div
                  key={habit.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/60 border border-slate-200/60 hover:bg-white transition"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      defaultChecked={habit.completed}
                      className="w-4 h-4 rounded text-electric-blue focus:ring-electric-blue cursor-pointer"
                    />
                    <span className={`text-xs font-medium ${habit.completed ? 'line-through text-muted-text' : 'text-main-text'}`}>
                      {habit.name}
                    </span>
                  </div>
                  <GlassBadge variant={habit.completed ? 'mint' : 'neutral'} size="sm">
                    {habit.streak}d streak
                  </GlassBadge>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-muted-text">
              <span>Overall daily completion:</span>
              <strong className="text-royal-navy">50%</strong>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
