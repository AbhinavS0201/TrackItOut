import React, { useState } from 'react';
import {
  Dumbbell,
  Flame,
  TrendingUp,
  Plus,
  Calendar,
  CheckCircle2,
  Award,
} from 'lucide-react';
import GlassCard from '../components/common/GlassCard';
import GlassButton from '../components/common/GlassButton';
import GlassInput from '../components/common/GlassInput';
import GlassModal from '../components/common/GlassModal';
import GlassBadge from '../components/common/GlassBadge';

export default function FitnessPage() {
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);

  // Sample workout sessions
  const workouts = [
    {
      id: 1,
      name: 'Chest & Triceps Hypertrophy',
      date: 'Today, 07:00 AM',
      duration: '52 mins',
      exercises: [
        { name: 'Barbell Bench Press', sets: '3 sets × 12 reps @ 40 kg', pr: true },
        { name: 'Incline Dumbbell Press', sets: '3 sets × 10 reps @ 18 kg', pr: false },
        { name: 'Cable Tricep Pushdown', sets: '4 sets × 15 reps @ 25 kg', pr: false },
      ],
    },
    {
      id: 2,
      name: 'Back & Biceps Power',
      date: 'Yesterday, 06:45 PM',
      duration: '58 mins',
      exercises: [
        { name: 'Conventional Deadlift', sets: '4 sets × 8 reps @ 80 kg', pr: true },
        { name: 'Lat Pulldowns', sets: '3 sets × 12 reps @ 45 kg', pr: false },
        { name: 'Barbell Bicep Curls', sets: '3 sets × 10 reps @ 20 kg', pr: false },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-royal-navy tracking-tight">Fitness & Strength</h2>
          <p className="text-xs text-muted-text mt-0.5">
            Log gym workouts, track sets, repetitions, weights and body composition.
          </p>
        </div>

        <GlassButton
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => setIsWorkoutModalOpen(true)}
        >
          <span>Log Workout</span>
        </GlassButton>
      </div>

      {/* Fitness Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard variant="gradient">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-text uppercase">Workout Streak</span>
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-500">
              <Flame size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-royal-navy">5 Days</div>
          <p className="text-[11px] text-muted-text mt-1">4 sessions this week (Target: 5)</p>
        </GlassCard>

        <GlassCard variant="standard">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-text uppercase">Body Weight</span>
            <div className="p-2 rounded-xl bg-electric-blue/15 text-electric-blue">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-royal-navy">72.4 kg</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">-0.8 kg this month</p>
        </GlassCard>

        <GlassCard variant="standard">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-text uppercase">Estimated 1RM</span>
            <div className="p-2 rounded-xl bg-aqua-teal/25 text-royal-navy">
              <Award size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-royal-navy">54 kg</div>
          <p className="text-[11px] text-muted-text mt-1">Barbell Bench Press (Calculated)</p>
        </GlassCard>
      </div>

      {/* Recent Workouts List */}
      <div className="space-y-4">
        <h3 className="font-bold text-royal-navy text-base">Recent Workouts</h3>
        {workouts.map((w) => (
          <GlassCard key={w.id} variant="standard">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h4 className="font-bold text-royal-navy text-sm">{w.name}</h4>
                <div className="flex items-center gap-2 text-xs text-muted-text mt-0.5">
                  <Calendar size={12} />
                  <span>{w.date}</span>
                  <span>•</span>
                  <span>{w.duration}</span>
                </div>
              </div>
              <GlassBadge variant="mint" size="sm">Completed</GlassBadge>
            </div>

            <div className="space-y-2">
              {w.exercises.map((ex, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50/60">
                  <span className="font-semibold text-royal-navy">{ex.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-text font-medium">{ex.sets}</span>
                    {ex.pr && <GlassBadge variant="lavender" size="sm">PR</GlassBadge>}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Workout Logger Modal */}
      <GlassModal
        isOpen={isWorkoutModalOpen}
        onClose={() => setIsWorkoutModalOpen(false)}
        title="Log Workout"
        subtitle="Record exercise, sets, reps and weight lifted"
      >
        <div className="space-y-4">
          <GlassInput label="Workout Title" placeholder="e.g. Chest & Triceps" required />
          <GlassInput label="Exercise Name" placeholder="e.g. Bench Press" required />
          <div className="grid grid-cols-3 gap-3">
            <GlassInput label="Sets" type="number" placeholder="3" />
            <GlassInput label="Reps" type="number" placeholder="12" />
            <GlassInput label="Weight (kg)" type="number" placeholder="40" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsWorkoutModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={() => {
                alert('Workout logged!');
                setIsWorkoutModalOpen(false);
              }}
            >
              Save Workout
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
