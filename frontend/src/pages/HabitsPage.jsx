import React, { useState } from 'react';
import {
  CheckSquare,
  Droplet,
  Moon,
  BookOpen,
  Plus,
  Flame,
  Award,
} from 'lucide-react';
import GlassCard from '../components/common/GlassCard';
import GlassButton from '../components/common/GlassButton';
import GlassInput from '../components/common/GlassInput';
import GlassModal from '../components/common/GlassModal';
import GlassBadge from '../components/common/GlassBadge';

export default function HabitsPage() {
  const [waterMl, setWaterMl] = useState(2250);
  const waterTarget = 3000;
  const [isAddHabitModalOpen, setIsAddHabitModalOpen] = useState(false);

  const [habits, setHabits] = useState([
    { id: 1, name: 'Drink 3L Water', category: 'Health', streak: 12, completed: true },
    { id: 2, name: 'Chest Workout', category: 'Fitness', streak: 5, completed: true },
    { id: 3, name: 'Read 30 mins', category: 'Learning', streak: 8, completed: false },
    { id: 4, name: 'Sleep 8 Hours', category: 'Rest', streak: 3, completed: false },
    { id: 5, name: 'Study 2 Hours', category: 'Learning', streak: 6, completed: true },
  ]);

  const toggleHabit = (id) => {
    setHabits(habits.map((h) => (h.id === id ? { ...h, completed: !h.completed } : h)));
  };

  const addWater = (amount) => {
    setWaterMl((prev) => Math.min(5000, prev + amount));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-royal-navy tracking-tight">Habits & Lifestyle</h2>
          <p className="text-xs text-muted-text mt-0.5">
            Maintain daily routines, build unbroken streaks, and track water and sleep.
          </p>
        </div>

        <GlassButton
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => setIsAddHabitModalOpen(true)}
        >
          <span>New Habit</span>
        </GlassButton>
      </div>

      {/* Hydration Tracker Card */}
      <GlassCard variant="highlight">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-600">
              <Droplet size={20} />
            </div>
            <div>
              <h3 className="font-bold text-royal-navy text-base">Hydration Tracker</h3>
              <p className="text-xs text-muted-text">Daily target: {waterTarget} ml</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold text-cyan-600">{waterMl} ml</div>
            <div className="text-[11px] text-muted-text">{Math.round((waterMl / waterTarget) * 100)}% of goal</div>
          </div>
        </div>

        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-electric-blue transition-all duration-300"
            style={{ width: `${Math.min(100, (waterMl / waterTarget) * 100)}%` }}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => addWater(250)}
            className="px-3 py-1.5 rounded-xl bg-white/70 hover:bg-white text-xs font-semibold text-royal-navy border border-slate-200 transition"
          >
            +250 ml (1 Glass)
          </button>
          <button
            onClick={() => addWater(500)}
            className="px-3 py-1.5 rounded-xl bg-white/70 hover:bg-white text-xs font-semibold text-royal-navy border border-slate-200 transition"
          >
            +500 ml (1 Bottle)
          </button>
        </div>
      </GlassCard>

      {/* Habits List */}
      <GlassCard variant="standard">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="font-bold text-royal-navy text-base">Daily Habits Checklist</h3>
          <span className="text-xs text-muted-text">
            {habits.filter((h) => h.completed).length} of {habits.length} completed
          </span>
        </div>

        <div className="space-y-3">
          {habits.map((habit) => (
            <div
              key={habit.id}
              onClick={() => toggleHabit(habit.id)}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 hover:border-electric-blue/40 cursor-pointer transition shadow-sm"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={habit.completed}
                  onChange={() => toggleHabit(habit.id)}
                  className="w-5 h-5 rounded text-electric-blue focus:ring-electric-blue cursor-pointer"
                />
                <div>
                  <h4
                    className={`text-sm font-semibold ${
                      habit.completed ? 'line-through text-slate-400' : 'text-royal-navy'
                    }`}
                  >
                    {habit.name}
                  </h4>
                  <span className="text-[11px] text-muted-text">{habit.category}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <GlassBadge variant={habit.completed ? 'mint' : 'lavender'} size="sm">
                  <Flame size={12} className="inline mr-1 text-rose-500" />
                  {habit.streak} day streak
                </GlassBadge>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Modal */}
      <GlassModal
        isOpen={isAddHabitModalOpen}
        onClose={() => setIsAddHabitModalOpen(false)}
        title="Create New Habit"
        subtitle="Set up a routine with custom target and streak tracking"
      >
        <div className="space-y-4">
          <GlassInput label="Habit Name" placeholder="e.g. Read for 30 minutes" required />
          <GlassInput label="Category" placeholder="e.g. Learning, Fitness, Health" />
          <GlassInput label="Target Frequency" placeholder="Daily / 5 days a week" />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsAddHabitModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={() => {
                alert('Habit created!');
                setIsAddHabitModalOpen(false);
              }}
            >
              Create Habit
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
