import React, { useState } from 'react';
import {
  Apple,
  Search,
  Plus,
  Flame,
  CheckCircle,
  Sparkles,
  Camera,
  Barcode,
  Mic,
  Info,
} from 'lucide-react';
import GlassCard from '../components/common/GlassCard';
import GlassButton from '../components/common/GlassButton';
import GlassInput from '../components/common/GlassInput';
import GlassModal from '../components/common/GlassModal';
import GlassBadge from '../components/common/GlassBadge';
import { useCopilot } from '../context/CopilotContext';

export default function NutritionPage() {
  const { setOpen: setCopilotOpen, processCommand } = useCopilot();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Verified Branded Products Catalog (Demonstrating Pintola, Milky Mist, BigMuscles etc.)
  const verifiedProducts = [
    {
      id: 'pintola-oats',
      brand: 'Pintola',
      name: 'High Protein Rolled Oats',
      variant: 'Dark Chocolate / Natural',
      serving: '100g',
      calories: 398,
      protein: 26,
      carbs: 58,
      fats: 8.5,
      fiber: 10,
      source: 'Verified Nutrition Label',
    },
    {
      id: 'milky-mist-paneer',
      brand: 'Milky Mist',
      name: 'High Protein Low Fat Paneer',
      variant: 'Fresh Block',
      serving: '100g',
      calories: 265,
      protein: 25,
      carbs: 4,
      fats: 16,
      fiber: 0,
      source: 'Verified Nutrition Label',
    },
    {
      id: 'bigmuscles-whey',
      brand: 'BigMuscles',
      name: 'Premium Gold Whey Protein',
      variant: 'Belgian Chocolate',
      serving: '33g (1 Scoop)',
      calories: 135,
      protein: 25,
      carbs: 2.5,
      fats: 1.5,
      fiber: 1,
      source: 'Verified Lab Certificate',
    },
    {
      id: 'amul-high-protein-lassi',
      brand: 'Amul',
      name: 'High Protein Lassi',
      variant: 'Rose Flavoured (200ml)',
      serving: '200ml',
      calories: 130,
      protein: 15,
      carbs: 12,
      fats: 2,
      fiber: 0,
      source: 'Verified Nutrition Label',
    },
  ];

  // Daily Meal Log structure
  const [meals, setMeals] = useState([
    {
      id: 1,
      type: 'Breakfast',
      time: '08:30 AM',
      items: [
        { name: 'Pintola High Protein Oats', qty: '100g', calories: 398, protein: 26, carbs: 58, fats: 8.5 },
        { name: 'Cow Milk (Toned)', qty: '250ml', calories: 150, protein: 8, carbs: 12, fats: 7 },
      ],
    },
    {
      id: 2,
      type: 'Lunch',
      time: '01:30 PM',
      items: [
        { name: 'Milky Mist Protein Paneer', qty: '150g', calories: 397, protein: 37.5, carbs: 6, fats: 24 },
        { name: 'Steamed Rice', qty: '150g', calories: 195, protein: 4, carbs: 42, fats: 0.5 },
      ],
    },
  ]);

  const filteredProducts = verifiedProducts.filter(
    (p) =>
      p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-royal-navy tracking-tight">Nutrition Intelligence</h2>
          <p className="text-xs text-muted-text mt-0.5">
            Log foods, track exact macros, and verify branded high-protein Indian products.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <GlassButton
            variant="outline"
            size="sm"
            icon={Barcode}
            onClick={() => alert('Barcode camera scanning preview active.')}
          >
            <span>Scan Barcode</span>
          </GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setIsLogModalOpen(true)}
          >
            <span>Log Food</span>
          </GlassButton>
        </div>
      </div>

      {/* Daily Macro Targets Card */}
      <GlassCard variant="gradient">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-4">
          <div>
            <span className="text-xs font-bold text-electric-blue uppercase tracking-wider">
              Today's Targets
            </span>
            <h3 className="text-lg font-extrabold text-royal-navy">Daily Macro Breakdown</h3>
          </div>
          <GlassBadge variant="aqua" size="sm">Target: 2,200 kcal</GlassBadge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="bg-white/70 p-4 rounded-2xl border border-slate-200/60">
            <div className="text-xs font-semibold text-muted-text mb-1">Calories</div>
            <div className="text-2xl font-extrabold text-electric-blue">1,140</div>
            <div className="text-[11px] text-muted-text mt-1">Goal: 2,200 kcal</div>
          </div>
          <div className="bg-white/70 p-4 rounded-2xl border border-slate-200/60">
            <div className="text-xs font-semibold text-muted-text mb-1">Protein</div>
            <div className="text-2xl font-extrabold text-aqua-teal">75.5g</div>
            <div className="text-[11px] text-muted-text mt-1">Goal: 140g (54%)</div>
          </div>
          <div className="bg-white/70 p-4 rounded-2xl border border-slate-200/60">
            <div className="text-xs font-semibold text-muted-text mb-1">Carbs</div>
            <div className="text-2xl font-extrabold text-purple-700">118g</div>
            <div className="text-[11px] text-muted-text mt-1">Goal: 220g (53%)</div>
          </div>
          <div className="bg-white/70 p-4 rounded-2xl border border-slate-200/60">
            <div className="text-xs font-semibold text-muted-text mb-1">Fats</div>
            <div className="text-2xl font-extrabold text-amber-600">40g</div>
            <div className="text-[11px] text-muted-text mt-1">Goal: 65g (61%)</div>
          </div>
        </div>
      </GlassCard>

      {/* Branded Product Intelligence Engine Feature */}
      <GlassCard variant="highlight">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-electric-blue/20 text-electric-blue">
                <Sparkles size={14} />
              </span>
              <h3 className="font-bold text-royal-navy text-sm">
                Branded Product Nutrition Intelligence
              </h3>
            </div>
            <p className="text-xs text-muted-text mt-0.5">
              Verified nutrition labels for packaged high-protein Indian foods (Pintola, Milky Mist, BigMuscles)
            </p>
          </div>

          <div className="w-full sm:w-64">
            <GlassInput
              placeholder="Search brand or product..."
              icon={Search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="!py-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 hover:border-electric-blue/40 shadow-sm transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-royal-navy px-2 py-0.5 rounded bg-pastel-blue/40">
                    {p.brand}
                  </span>
                  <h4 className="font-bold text-sm text-royal-navy mt-1">{p.name}</h4>
                  <p className="text-xs text-muted-text">{p.variant} • Per {p.serving}</p>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-electric-blue">{p.calories} kcal</div>
                  <div className="text-xs font-bold text-emerald-600">{p.protein}g Protein</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center text-[11px]">
                <div className="text-slate-500">Carbs: <strong className="text-royal-navy">{p.carbs}g</strong></div>
                <div className="text-slate-500">Fats: <strong className="text-royal-navy">{p.fats}g</strong></div>
                <div className="text-slate-500">Fiber: <strong className="text-royal-navy">{p.fiber}g</strong></div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-text">
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle size={12} /> {p.source}
                </span>
                <button
                  onClick={() => {
                    processCommand(`I had ${p.serving} of ${p.brand} ${p.name}`);
                  }}
                  className="text-electric-blue font-bold hover:underline"
                >
                  + Quick Log
                </button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Logged Meals */}
      <div className="space-y-4">
        <h3 className="font-bold text-royal-navy text-base">Today's Logged Meals</h3>
        {meals.map((meal) => (
          <GlassCard key={meal.id} variant="standard">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-royal-navy text-sm">{meal.type}</span>
                <span className="text-xs text-muted-text">• {meal.time}</span>
              </div>
              <GlassBadge variant="blue" size="sm">
                {meal.items.reduce((acc, i) => acc + i.calories, 0)} kcal
              </GlassBadge>
            </div>

            <div className="space-y-2">
              {meal.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1">
                  <div>
                    <span className="font-semibold text-main-text">{item.name}</span>
                    <span className="text-muted-text ml-2">({item.qty})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-600">{item.protein}g P</span>
                    <span className="text-muted-text">{item.calories} kcal</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Quick Add Food Modal */}
      <GlassModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title="Log Food or Meal"
        subtitle="Speak or enter food name and quantity"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-pastel-blue/20 text-xs text-royal-navy flex items-center gap-2">
            <Info size={16} className="text-electric-blue flex-shrink-0" />
            <span>Tip: You can say "I ate 100g Pintola oats with milk" to the AI Copilot to automatically calculate exact macros!</span>
          </div>

          <GlassInput label="Food Name" placeholder="e.g. Pintola Protein Oats" required />
          <div className="grid grid-cols-2 gap-3">
            <GlassInput label="Quantity / Serving" placeholder="e.g. 100g or 1 scoop" required />
            <GlassInput label="Meal Category" placeholder="Breakfast / Lunch / Dinner" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsLogModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={() => {
                alert('Food logged!');
                setIsLogModalOpen(false);
              }}
            >
              Save Meal
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
