import React from 'react';
import { LineChart, BarChart2, PieChart, Sparkles, TrendingUp } from 'lucide-react';
import GlassCard from '../components/common/GlassCard';
import GlassBadge from '../components/common/GlassBadge';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-royal-navy tracking-tight">Life Analytics</h2>
        <p className="text-xs text-muted-text mt-0.5">
          Unified insights combining your spending behavior, nutrition macro trends, and habit consistency.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard variant="standard">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-royal-navy text-sm">Monthly Financial Velocity</h3>
            <GlassBadge variant="blue" size="sm">Finance</GlassBadge>
          </div>
          <p className="text-xs text-muted-text mb-4">
            Aggregated time-series trend of your savings rate vs total expenses over the last quarter.
          </p>
          <div className="h-48 flex items-center justify-center bg-slate-50/70 rounded-xl text-xs text-muted-text border border-dashed border-slate-200">
            Financial analytics charts active in Finance module
          </div>
        </GlassCard>

        <GlassCard variant="standard">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-royal-navy text-sm">Macro Intake Consistency</h3>
            <GlassBadge variant="aqua" size="sm">Nutrition</GlassBadge>
          </div>
          <p className="text-xs text-muted-text mb-4">
            Tracking your daily protein and caloric targets to maintain muscle mass and health.
          </p>
          <div className="h-48 flex items-center justify-center bg-slate-50/70 rounded-xl text-xs text-muted-text border border-dashed border-slate-200">
            Average Protein: 124g / day • Target: 140g (88% compliance)
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
