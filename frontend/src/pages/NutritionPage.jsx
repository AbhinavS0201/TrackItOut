import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Apple,
  Search,
  Plus,
  Flame,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Droplets,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Target,
  Edit2,
  Trash2,
  Info,
  RefreshCw,
  Clock,
  Layers,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import GlassCard from '../components/common/GlassCard';
import GlassButton from '../components/common/GlassButton';
import GlassInput from '../components/common/GlassInput';
import GlassModal from '../components/common/GlassModal';
import GlassBadge from '../components/common/GlassBadge';
import GlassSelect from '../components/common/GlassSelect';
import { useCopilot } from '../context/CopilotContext';
import apiClient from '../api/client';

export default function NutritionPage() {
  const { processCommand } = useCopilot();

  // ─── Selected Date State (Defaults to Today YYYY-MM-DD) ─────────────────────
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // ─── API Overview Data State ────────────────────────────────────────────────
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // ─── Modals State ───────────────────────────────────────────────────────────
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isWaterModalOpen, setIsWaterModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [isCustomFoodModalOpen, setIsCustomFoodModalOpen] = useState(false);

  // ─── Food Search State ──────────────────────────────────────────────────────
  const [catalogSearch, setCatalogSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // ─── Meal Log Draft State ───────────────────────────────────────────────────
  const [mealType, setMealType] = useState('Breakfast');
  const [draftItems, setDraftItems] = useState([]);
  const [mealNotes, setMealNotes] = useState('');
  const [selectedFoodForDraft, setSelectedFoodForDraft] = useState(null);
  const [draftQuantity, setDraftQuantity] = useState('100');
  const [draftUnit, setDraftUnit] = useState('g');
  const [isSubmittingMeal, setIsSubmittingMeal] = useState(false);

  // ─── Target Form State ──────────────────────────────────────────────────────
  const [targetForm, setTargetForm] = useState({
    daily_calorie_target: 2200,
    protein_target_g: 130,
    carbs_target_g: 240,
    fats_target_g: 65,
    fiber_target_g: 30,
    water_target_ml: 3000,
  });
  const [isSavingTargets, setIsSavingTargets] = useState(false);

  // ─── Custom Water Input State ───────────────────────────────────────────────
  const [customWaterMl, setCustomWaterMl] = useState('250');
  const [isLoggingWater, setIsLoggingWater] = useState(false);

  // ─── Custom Food Form State ─────────────────────────────────────────────────
  const [customFoodForm, setCustomFoodForm] = useState({
    brand_name: '',
    product_name: '',
    variant: '',
    preparation_state: 'Packaged',
    nutrition_basis: 'per_100g',
    serving_quantity: '1',
    serving_unit: 'serving',
    serving_weight_g: '100',
    calories: '',
    protein: '',
    carbohydrates: '',
    fats: '',
    fiber: '',
    sugar: '',
    sodium_mg: '',
  });
  const [isSavingCustomFood, setIsSavingCustomFood] = useState(false);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── 1. Fetch Daily Overview API ───────────────────────────────────────────
  const fetchDailyOverview = useCallback(async (date) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/v1/nutrition/overview?date=${date}`);
      setOverview(res.data);
      if (res.data.targets) {
        setTargetForm({
          daily_calorie_target: res.data.targets.daily_calorie_target || 2200,
          protein_target_g: parseFloat(res.data.targets.protein_target_g) || 130,
          carbs_target_g: parseFloat(res.data.targets.carbs_target_g) || 240,
          fats_target_g: parseFloat(res.data.targets.fats_target_g) || 65,
          fiber_target_g: parseFloat(res.data.targets.fiber_target_g) || 30,
          water_target_ml: res.data.targets.water_target_ml || 3000,
        });
      }
    } catch (err) {
      console.error('Error fetching nutrition overview:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load nutrition data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyOverview(selectedDate);
  }, [selectedDate, fetchDailyOverview]);

  // Listen for Copilot nutrition-updated broadcast event
  useEffect(() => {
    const handleCopilotUpdate = () => {
      fetchDailyOverview(selectedDate);
    };
    window.addEventListener('nutrition-updated', handleCopilotUpdate);
    return () => window.removeEventListener('nutrition-updated', handleCopilotUpdate);
  }, [selectedDate, fetchDailyOverview]);

  // ─── 2. Debounced Food Search API ──────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiClient.get(`/api/v1/nutrition/foods?q=${encodeURIComponent(catalogSearch)}`);
        setSearchResults(res.data);
      } catch (err) {
        console.error('Error searching catalog:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [catalogSearch]);

  // ─── Date Navigation Handlers ──────────────────────────────────────────────
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // ─── Water Logging API ─────────────────────────────────────────────────────
  const handleQuickAddWater = async (ml) => {
    setIsLoggingWater(true);
    try {
      await apiClient.post('/api/v1/nutrition/water', {
        date: selectedDate,
        water_ml: ml,
      });
      showToast(`Added ${ml} ml of water!`);
      setIsWaterModalOpen(false);
      fetchDailyOverview(selectedDate);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to log water', 'error');
    } finally {
      setIsLoggingWater(false);
    }
  };

  // ─── Live Macro Calculation Preview for Draft Item ─────────────────────────
  const calculatedDraftMacro = useMemo(() => {
    if (!selectedFoodForDraft) return null;
    const qty = parseFloat(draftQuantity);
    if (isNaN(qty) || qty <= 0) return null;

    const basis = selectedFoodForDraft.nutrition_basis;
    const density = selectedFoodForDraft.density_g_per_ml ? parseFloat(selectedFoodForDraft.density_g_per_ml) : null;
    const servWeight = selectedFoodForDraft.serving_weight_g ? parseFloat(selectedFoodForDraft.serving_weight_g) : null;
    const servVol = selectedFoodForDraft.serving_volume_ml ? parseFloat(selectedFoodForDraft.serving_volume_ml) : null;
    const servQty = selectedFoodForDraft.serving_quantity ? parseFloat(selectedFoodForDraft.serving_quantity) : 1;

    let scale = 0;
    const u = draftUnit.toLowerCase();

    if (basis === 'per_100g') {
      if (u === 'g') scale = qty / 100;
      else if (u === 'ml') {
        if (!density) return { error: 'Volume-to-mass conversion requires defined density' };
        scale = (qty * density) / 100;
      } else if (u === 'serving') {
        if (!servWeight) return { error: 'Serving conversion requires serving_weight_g' };
        scale = ((qty / servQty) * servWeight) / 100;
      }
    } else if (basis === 'per_100ml') {
      if (u === 'ml') scale = qty / 100;
      else if (u === 'g') {
        if (!density) return { error: 'Mass-to-volume conversion requires defined density' };
        scale = (qty / density) / 100;
      } else if (u === 'serving') {
        if (!servVol) return { error: 'Serving conversion requires serving_volume_ml' };
        scale = ((qty / servQty) * servVol) / 100;
      }
    } else if (basis === 'per_serving') {
      if (u === 'serving' || u === 'scoop') scale = qty / servQty;
      else if (u === 'g' && servWeight) scale = qty / servWeight;
      else if (u === 'ml' && servVol) scale = qty / servVol;
      else return { error: 'Unsupported unit for per_serving basis' };
    }

    const calc = (val) => (val !== null && val !== undefined ? parseFloat((parseFloat(val) * scale).toFixed(2)) : null);

    return {
      scale,
      calories: calc(selectedFoodForDraft.calories),
      protein: calc(selectedFoodForDraft.protein),
      carbohydrates: calc(selectedFoodForDraft.carbohydrates),
      fats: calc(selectedFoodForDraft.fats),
      fiber: calc(selectedFoodForDraft.fiber),
    };
  }, [selectedFoodForDraft, draftQuantity, draftUnit]);

  // Add Item to Current Meal Draft
  const handleAddItemToDraft = () => {
    if (!selectedFoodForDraft || !calculatedDraftMacro || calculatedDraftMacro.error) {
      alert(calculatedDraftMacro?.error || 'Please enter valid quantity and unit');
      return;
    }

    const item = {
      food_product_id: selectedFoodForDraft.id,
      product_name: selectedFoodForDraft.product_name,
      brand_name: selectedFoodForDraft.brand_name,
      logged_quantity: parseFloat(draftQuantity),
      logged_unit: draftUnit,
      calories: calculatedDraftMacro.calories,
      protein: calculatedDraftMacro.protein,
      carbohydrates: calculatedDraftMacro.carbohydrates,
      fats: calculatedDraftMacro.fats,
      fiber: calculatedDraftMacro.fiber,
      nutrient_status: selectedFoodForDraft.verification_status,
    };

    setDraftItems((prev) => [...prev, item]);
    setSelectedFoodForDraft(null);
    setDraftQuantity('100');
    setDraftUnit('g');
  };

  const handleRemoveDraftItem = (index) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Completed Meal API
  const handleSubmitMeal = async () => {
    if (draftItems.length === 0) {
      alert('Please add at least one food item to this meal');
      return;
    }

    setIsSubmittingMeal(true);
    try {
      await apiClient.post('/api/v1/nutrition/meals', {
        date: selectedDate,
        meal_type: mealType,
        items: draftItems,
        notes: mealNotes.trim() || undefined,
      });

      showToast(`Successfully logged ${mealType}!`);
      setIsLogModalOpen(false);
      setDraftItems([]);
      setMealNotes('');
      fetchDailyOverview(selectedDate);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to log meal', 'error');
    } finally {
      setIsSubmittingMeal(false);
    }
  };

  // ─── Target Update API ─────────────────────────────────────────────────────
  const handleSaveTargets = async (e) => {
    e.preventDefault();
    setIsSavingTargets(true);
    try {
      await apiClient.put('/api/v1/nutrition/targets', targetForm);
      showToast('Daily nutrition targets updated!');
      setIsTargetModalOpen(false);
      fetchDailyOverview(selectedDate);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update targets', 'error');
    } finally {
      setIsSavingTargets(false);
    }
  };

  // ─── Custom Food Creation API ──────────────────────────────────────────────
  const handleSaveCustomFood = async (e) => {
    e.preventDefault();
    setIsSavingCustomFood(true);
    try {
      const payload = {
        ...customFoodForm,
        serving_quantity: customFoodForm.serving_quantity ? parseFloat(customFoodForm.serving_quantity) : null,
        serving_weight_g: customFoodForm.serving_weight_g ? parseFloat(customFoodForm.serving_weight_g) : null,
        calories: customFoodForm.calories ? parseFloat(customFoodForm.calories) : null,
        protein: customFoodForm.protein ? parseFloat(customFoodForm.protein) : null,
        carbohydrates: customFoodForm.carbohydrates ? parseFloat(customFoodForm.carbohydrates) : null,
        fats: customFoodForm.fats ? parseFloat(customFoodForm.fats) : null,
        fiber: customFoodForm.fiber ? parseFloat(customFoodForm.fiber) : null,
      };

      await apiClient.post('/api/v1/nutrition/foods', payload);
      showToast('Custom food saved to your personal library!');
      setIsCustomFoodModalOpen(false);
      // Refresh food search list
      const res = await apiClient.get(`/api/v1/nutrition/foods?q=${encodeURIComponent(catalogSearch)}`);
      setSearchResults(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save custom food', 'error');
    } finally {
      setIsSavingCustomFood(false);
    }
  };

  // Safe nutrient display helper: returns '—' for NULL, never falsely turns NULL to 0
  const renderNutrient = (val, unit = 'g') => {
    if (val === null || val === undefined) {
      return <span className="text-slate-400 font-normal italic">Unreported</span>;
    }
    return `${val}${unit}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Verified':
        return <GlassBadge variant="emerald" size="sm"><CheckCircle size={10} className="inline mr-1" />Verified</GlassBadge>;
      case 'User_Approved':
        return <GlassBadge variant="blue" size="sm"><ShieldCheck size={10} className="inline mr-1" />User Approved</GlassBadge>;
      case 'Estimated':
        return <GlassBadge variant="purple" size="sm">Estimated</GlassBadge>;
      default:
        return <GlassBadge variant="amber" size="sm"><HelpCircle size={10} className="inline mr-1" />Unverified</GlassBadge>;
    }
  };

  const totals = overview?.totals || {};
  const targets = overview?.targets || {};
  const meals = overview?.meals || {};

  // Percentage Calculations
  const calPercent = targets.daily_calorie_target ? Math.min(100, Math.round(((totals.calories || 0) / targets.daily_calorie_target) * 100)) : 0;
  const pPercent = targets.protein_target_g ? Math.min(100, Math.round(((totals.protein || 0) / targets.protein_target_g) * 100)) : 0;
  const cPercent = targets.carbs_target_g ? Math.min(100, Math.round(((totals.carbohydrates || 0) / targets.carbs_target_g) * 100)) : 0;
  const fPercent = targets.fats_target_g ? Math.min(100, Math.round(((totals.fats || 0) / targets.fats_target_g) * 100)) : 0;
  const waterPercent = targets.water_target_ml ? Math.min(100, Math.round(((totals.water_ml || 0) / targets.water_target_ml) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg backdrop-blur border transition-all ${
          toast.type === 'error' ? 'bg-rose-500/90 text-white border-rose-400' : 'bg-emerald-600/90 text-white border-emerald-400'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Top Bar with Date Selector and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-royal-navy tracking-tight">Nutrition Intelligence</h2>
          <p className="text-xs text-muted-text mt-0.5">
            Log meals, verify packaging nutrition labels, and track exact macro targets with zero fabricated data.
          </p>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-2 bg-white/70 p-1.5 rounded-2xl border border-slate-200/80 shadow-sm">
          <GlassButton variant="ghost" size="sm" icon={ChevronLeft} onClick={handlePrevDay} />
          <div className="flex items-center gap-1.5 px-2">
            <Calendar size={14} className="text-electric-blue" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-royal-navy bg-transparent outline-none cursor-pointer"
            />
          </div>
          <GlassButton variant="ghost" size="sm" icon={ChevronRight} onClick={handleNextDay} />
          {selectedDate !== todayStr && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="text-[11px] font-bold text-electric-blue hover:underline px-2"
            >
              Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <GlassButton
            variant="outline"
            size="sm"
            icon={Target}
            onClick={() => setIsTargetModalOpen(true)}
          >
            <span>Edit Targets</span>
          </GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => {
              setMealType('Breakfast');
              setIsLogModalOpen(true);
            }}
          >
            <span>Log Meal</span>
          </GlassButton>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && !overview && (
        <div className="p-8 text-center bg-white/40 rounded-2xl border border-slate-200/60 animate-pulse">
          <RefreshCw className="animate-spin text-electric-blue mx-auto mb-2" size={24} />
          <p className="text-xs font-semibold text-royal-navy">Loading verified nutrition intelligence...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600" />
            <span>{error}</span>
          </div>
          <GlassButton size="sm" variant="outline" onClick={() => fetchDailyOverview(selectedDate)}>
            Retry
          </GlassButton>
        </div>
      )}

      {/* Daily Macro Breakdown Cards */}
      {overview && (
        <GlassCard variant="gradient">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-4">
            <div>
              <span className="text-xs font-bold text-electric-blue uppercase tracking-wider">
                Daily Summary ({selectedDate})
              </span>
              <h3 className="text-lg font-extrabold text-royal-navy">Macro & Calorie Intake</h3>
            </div>
            <GlassBadge variant="aqua" size="sm">
              Target: {targets.daily_calorie_target ? targets.daily_calorie_target.toLocaleString() : 2200} kcal
            </GlassBadge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
            {/* Calories */}
            <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-semibold text-muted-text">Calories</div>
                <div className="text-xl font-extrabold text-electric-blue mt-0.5">
                  {totals.calories !== null ? Math.round(totals.calories) : <span className="text-slate-400 italic">0</span>}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-text">
                Goal: {targets.daily_calorie_target || 2200} ({calPercent}%)
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div className="bg-electric-blue h-full rounded-full transition-all" style={{ width: `${calPercent}%` }} />
                </div>
              </div>
            </div>

            {/* Protein */}
            <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-semibold text-muted-text">Protein</div>
                <div className="text-xl font-extrabold text-emerald-600 mt-0.5">
                  {renderNutrient(totals.protein)}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-text">
                Goal: {targets.protein_target_g || 130}g ({pPercent}%)
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${pPercent}%` }} />
                </div>
              </div>
            </div>

            {/* Carbs */}
            <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-semibold text-muted-text">Carbohydrates</div>
                <div className="text-xl font-extrabold text-purple-700 mt-0.5">
                  {renderNutrient(totals.carbohydrates)}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-text">
                Goal: {targets.carbs_target_g || 240}g ({cPercent}%)
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div className="bg-purple-600 h-full rounded-full transition-all" style={{ width: `${cPercent}%` }} />
                </div>
              </div>
            </div>

            {/* Fats */}
            <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-semibold text-muted-text">Fats</div>
                <div className="text-xl font-extrabold text-amber-600 mt-0.5">
                  {renderNutrient(totals.fats)}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-text">
                Goal: {targets.fats_target_g || 65}g ({fPercent}%)
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${fPercent}%` }} />
                </div>
              </div>
            </div>

            {/* Fiber (Strict NULL preservation) */}
            <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-semibold text-muted-text flex items-center justify-center gap-1">
                  Fiber
                  {totals.fiber_missing_count > 0 && (
                    <span title="Some consumed items do not report fiber" className="text-amber-500 cursor-help">
                      <AlertCircle size={10} />
                    </span>
                  )}
                </div>
                <div className="text-xl font-extrabold text-teal-600 mt-0.5">
                  {renderNutrient(totals.fiber)}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-text">
                Goal: {targets.fiber_target_g || 30}g
                {totals.fiber_missing_count > 0 && <span className="block text-[9px] text-amber-600 font-medium">Partial data</span>}
              </div>
            </div>

            {/* Hydration */}
            <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-semibold text-muted-text flex items-center justify-center gap-1">
                  <Droplets size={12} className="text-electric-blue" /> Water
                </div>
                <div className="text-xl font-extrabold text-electric-blue mt-0.5">
                  {totals.water_ml || 0} <span className="text-xs font-normal">ml</span>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-text">
                Goal: {targets.water_target_ml || 3000} ml ({waterPercent}%)
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div className="bg-cyan-500 h-full rounded-full transition-all" style={{ width: `${waterPercent}%` }} />
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Hydration Quick-Add Widget */}
      <GlassCard variant="standard" className="!py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600">
              <Droplets size={20} />
            </span>
            <div>
              <h4 className="font-bold text-royal-navy text-sm">Quick Hydration Tracker</h4>
              <p className="text-xs text-muted-text">Log water throughout the day. Target: {targets.water_target_ml || 3000} ml.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <GlassButton
              variant="outline"
              size="sm"
              disabled={isLoggingWater}
              onClick={() => handleQuickAddWater(250)}
            >
              +250 ml
            </GlassButton>
            <GlassButton
              variant="outline"
              size="sm"
              disabled={isLoggingWater}
              onClick={() => handleQuickAddWater(500)}
            >
              +500 ml
            </GlassButton>
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => setIsWaterModalOpen(true)}
            >
              Custom ml
            </GlassButton>
          </div>
        </div>
      </GlassCard>

      {/* Branded Product Intelligence Catalog */}
      <GlassCard variant="highlight">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-electric-blue/20 text-electric-blue">
                <Sparkles size={14} />
              </span>
              <h3 className="font-bold text-royal-navy text-sm">
                Verified Food & Macro Intelligence
              </h3>
            </div>
            <p className="text-xs text-muted-text mt-0.5">
              Live catalog with deterministic conversions (BigMuscles, Pintola, Amul, USDA SR Legacy Chicken)
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-64">
              <GlassInput
                placeholder="Search catalog or custom foods..."
                icon={Search}
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="!py-1.5"
              />
            </div>
            <GlassButton
              variant="outline"
              size="sm"
              onClick={() => setIsCustomFoodModalOpen(true)}
            >
              + Custom Food
            </GlassButton>
          </div>
        </div>

        {isSearching ? (
          <div className="py-6 text-center text-xs text-muted-text animate-pulse">Searching catalog...</div>
        ) : searchResults.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-text">
            No matching food products found. Try searching for "chicken", "whey", "oats", "paneer", or add a custom food.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {searchResults.slice(0, 8).map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-2xl bg-white/85 border border-slate-200/80 hover:border-electric-blue/40 shadow-sm transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold text-royal-navy px-1.5 py-0.5 rounded bg-pastel-blue/40 truncate">
                      {p.brand_name}
                    </span>
                    {getStatusBadge(p.verification_status)}
                  </div>
                  <h4 className="font-bold text-xs text-royal-navy mt-1.5 line-clamp-1">{p.product_name}</h4>
                  <p className="text-[11px] text-muted-text">
                    {p.variant ? `${p.variant} • ` : ''}
                    {p.preparation_state} • {p.nutrition_basis.replace('per_', 'Per ')}
                  </p>
                  {(p.source_name || p.source_reference) && (
                    <p className="text-[10px] text-muted-text/75 mt-0.5 truncate" title={`${p.source_name || ''} ${p.source_reference || ''}`}>
                      {p.source_name} {p.source_reference ? `• ${p.source_reference}` : ''}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold text-electric-blue">{p.calories !== null ? `${p.calories} kcal` : '—'}</div>
                    <div className="text-[11px] font-bold text-emerald-600">{p.protein !== null ? `${p.protein}g Protein` : '—'}</div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFoodForDraft(p);
                      setIsLogModalOpen(true);
                    }}
                    className="text-xs font-bold text-electric-blue hover:underline bg-electric-blue/10 px-2.5 py-1 rounded-xl transition"
                  >
                    + Log
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Logged Meals Timeline */}
      <div className="space-y-4">
        <h3 className="font-bold text-royal-navy text-base flex items-center justify-between">
          <span>Logged Meals Timeline</span>
          <span className="text-xs font-normal text-muted-text">Date: {selectedDate}</span>
        </h3>

        {['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((mType) => {
          const mealList = meals[mType] || [];
          return (
            <GlassCard key={mType} variant="standard">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-royal-navy text-sm">{mType}</span>
                  <span className="text-xs text-muted-text">
                    ({mealList.length} {mealList.length === 1 ? 'entry' : 'entries'})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setMealType(mType);
                      setIsLogModalOpen(true);
                    }}
                    className="text-xs font-bold text-electric-blue hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Log {mType}
                  </button>
                </div>
              </div>

              {mealList.length === 0 ? (
                <div className="py-3 text-center text-xs text-slate-400 italic">
                  No {mType.toLowerCase()} logged yet for this date.
                </div>
              ) : (
                <div className="space-y-3">
                  {mealList.map((mealEntry) => (
                    <div key={mealEntry.id} className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100">
                      {mealEntry.notes && (
                        <p className="text-[11px] text-muted-text mb-2 italic">"{mealEntry.notes}"</p>
                      )}
                      <div className="space-y-1.5">
                        {mealEntry.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100/60 last:border-0">
                            <div>
                              <span className="font-semibold text-royal-navy">{item.food_name_snapshot}</span>
                              <span className="text-slate-400 ml-1.5">({item.logged_quantity} {item.logged_unit})</span>
                              <span className="ml-2">{getStatusBadge(item.nutrient_status)}</span>
                            </div>
                            <div className="flex items-center gap-3 text-right">
                              <span className="font-bold text-emerald-600">{renderNutrient(item.protein)} P</span>
                              <span className="text-slate-500">{renderNutrient(item.carbohydrates)} C</span>
                              <span className="text-slate-500">{renderNutrient(item.fats)} F</span>
                              <span className="font-extrabold text-electric-blue">{item.calories !== null ? `${item.calories} kcal` : '—'}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Subtotal */}
                      {mealEntry.meal_totals && (
                        <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-bold text-royal-navy">
                          <span>Subtotal:</span>
                          <span className="space-x-3 text-slate-600">
                            <span>{mealEntry.meal_totals.calories || 0} kcal</span>
                            <span className="text-emerald-700">{mealEntry.meal_totals.protein || 0}g Protein</span>
                            <span>{mealEntry.meal_totals.carbohydrates || 0}g Carbs</span>
                            <span>{mealEntry.meal_totals.fats || 0}g Fats</span>
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      {/* ─── Modal 1: Log Food / Meal ─────────────────────────────────────────── */}
      <GlassModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title={`Log Meal (${mealType})`}
        subtitle={`Adding food records for ${selectedDate}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <GlassSelect
              label="Meal Type"
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              options={[
                { value: 'Breakfast', label: 'Breakfast' },
                { value: 'Lunch', label: 'Lunch' },
                { value: 'Dinner', label: 'Dinner' },
                { value: 'Snacks', label: 'Snacks' },
              ]}
            />
            <GlassInput
              label="Selected Date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {/* Food Search Section */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-royal-navy">Search Food Product</label>
            <GlassInput
              placeholder="Search by product name or brand (e.g. Chicken, Pintola, Whey)..."
              icon={Search}
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
            />
            {searchResults.length > 0 && !selectedFoodForDraft && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-md divide-y divide-slate-100">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    data-testid="food-search-item"
                    data-food-id={item.id}
                    onClick={() => {
                      setSelectedFoodForDraft(item);
                      if (item.serving_unit) setDraftUnit(item.serving_unit);
                      else if (item.nutrition_basis === 'per_100ml') setDraftUnit('ml');
                      else setDraftUnit('g');
                    }}
                    className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-royal-navy">{item.product_name} <span className="font-normal text-muted-text">({item.brand_name})</span></div>
                      <div className="text-[10px] text-muted-text">{item.preparation_state} • {item.nutrition_basis}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-electric-blue">{item.calories !== null ? `${item.calories} kcal` : '—'}</span>
                      {getStatusBadge(item.verification_status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Food & Quantity Picker */}
          {selectedFoodForDraft && (
            <div className="p-3.5 rounded-2xl bg-white/90 border border-electric-blue/40 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-electric-blue uppercase">Selected Product</span>
                  <h4 className="font-extrabold text-sm text-royal-navy">{selectedFoodForDraft.product_name}</h4>
                  <p className="text-xs text-muted-text">{selectedFoodForDraft.brand_name} • {selectedFoodForDraft.preparation_state}</p>
                </div>
                <button
                  onClick={() => setSelectedFoodForDraft(null)}
                  className="text-xs text-slate-400 hover:text-rose-600 font-semibold"
                >
                  Change
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <GlassInput
                  label="Quantity"
                  type="number"
                  min="0.1"
                  step="any"
                  value={draftQuantity}
                  onChange={(e) => setDraftQuantity(e.target.value)}
                />
                <GlassSelect
                  label="Unit"
                  value={draftUnit}
                  onChange={(e) => setDraftUnit(e.target.value)}
                  options={[
                    { value: 'g', label: 'Grams (g)' },
                    { value: 'ml', label: 'Millilitres (ml)' },
                    { value: 'serving', label: 'Serving' },
                    ...(selectedFoodForDraft.serving_unit ? [{ value: selectedFoodForDraft.serving_unit, label: selectedFoodForDraft.serving_unit }] : [])
                  ]}
                />
              </div>

              {/* Calculated Macros Preview */}
              {calculatedDraftMacro && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  {calculatedDraftMacro.error ? (
                    <div className="text-rose-600 flex items-center gap-1">
                      <AlertCircle size={12} /> {calculatedDraftMacro.error}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div><span className="text-slate-400 block text-[10px]">Calories</span><strong className="text-electric-blue">{calculatedDraftMacro.calories || '—'}</strong></div>
                      <div><span className="text-slate-400 block text-[10px]">Protein</span><strong className="text-emerald-600">{calculatedDraftMacro.protein || '—'}g</strong></div>
                      <div><span className="text-slate-400 block text-[10px]">Carbs</span><strong className="text-purple-700">{calculatedDraftMacro.carbohydrates || '—'}g</strong></div>
                      <div><span className="text-slate-400 block text-[10px]">Fats</span><strong className="text-amber-600">{calculatedDraftMacro.fats || '—'}g</strong></div>
                    </div>
                  )}
                </div>
              )}

              <GlassButton
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={handleAddItemToDraft}
                disabled={!calculatedDraftMacro || !!calculatedDraftMacro.error}
              >
                + Add Item to Meal Draft
              </GlassButton>
            </div>
          )}

          {/* Items Currently in Draft */}
          {draftItems.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <span className="text-xs font-bold text-royal-navy">Meal Items ({draftItems.length})</span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {draftItems.map((item, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-royal-navy">{item.product_name}</span>
                      <span className="text-muted-text ml-1.5">({item.logged_quantity} {item.logged_unit})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600">{item.protein || '—'}g P</span>
                      <span className="font-extrabold text-electric-blue">{item.calories || '—'} kcal</span>
                      <button
                        onClick={() => handleRemoveDraftItem(idx)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <GlassInput
            label="Meal Notes (Optional)"
            placeholder="e.g. Post-workout dinner with family"
            value={mealNotes}
            onChange={(e) => setMealNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsLogModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              disabled={draftItems.length === 0 || isSubmittingMeal}
              onClick={handleSubmitMeal}
            >
              {isSubmittingMeal ? 'Saving...' : `Save ${mealType}`}
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ─── Modal 2: Custom Water Logging ─────────────────────────────────────── */}
      <GlassModal
        isOpen={isWaterModalOpen}
        onClose={() => setIsWaterModalOpen(false)}
        title="Custom Water Intake"
        subtitle={`Log hydration for ${selectedDate}`}
      >
        <div className="space-y-4">
          <GlassInput
            label="Water Quantity (ml)"
            type="number"
            min="50"
            step="50"
            value={customWaterMl}
            onChange={(e) => setCustomWaterMl(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsWaterModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              disabled={isLoggingWater || !customWaterMl}
              onClick={() => handleQuickAddWater(parseInt(customWaterMl, 10))}
            >
              {isLoggingWater ? 'Logging...' : 'Save Water'}
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ─── Modal 3: Edit Nutrition Targets ───────────────────────────────────── */}
      <GlassModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        title="Edit Nutrition & Macro Targets"
        subtitle="Set your personal daily targets"
      >
        <form onSubmit={handleSaveTargets} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <GlassInput
              label="Daily Calories (kcal)"
              type="number"
              value={targetForm.daily_calorie_target}
              onChange={(e) => setTargetForm({ ...targetForm, daily_calorie_target: parseInt(e.target.value, 10) || 0 })}
              required
            />
            <GlassInput
              label="Water Target (ml)"
              type="number"
              value={targetForm.water_target_ml}
              onChange={(e) => setTargetForm({ ...targetForm, water_target_ml: parseInt(e.target.value, 10) || 0 })}
              required
            />
            <GlassInput
              label="Protein (g)"
              type="number"
              step="any"
              value={targetForm.protein_target_g}
              onChange={(e) => setTargetForm({ ...targetForm, protein_target_g: parseFloat(e.target.value) || 0 })}
              required
            />
            <GlassInput
              label="Carbohydrates (g)"
              type="number"
              step="any"
              value={targetForm.carbs_target_g}
              onChange={(e) => setTargetForm({ ...targetForm, carbs_target_g: parseFloat(e.target.value) || 0 })}
              required
            />
            <GlassInput
              label="Fats (g)"
              type="number"
              step="any"
              value={targetForm.fats_target_g}
              onChange={(e) => setTargetForm({ ...targetForm, fats_target_g: parseFloat(e.target.value) || 0 })}
              required
            />
            <GlassInput
              label="Fiber (g)"
              type="number"
              step="any"
              value={targetForm.fiber_target_g}
              onChange={(e) => setTargetForm({ ...targetForm, fiber_target_g: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" type="button" onClick={() => setIsTargetModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton variant="primary" size="sm" type="submit" disabled={isSavingTargets}>
              {isSavingTargets ? 'Saving...' : 'Update Targets'}
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* ─── Modal 4: Create Custom Food ───────────────────────────────────────── */}
      <GlassModal
        isOpen={isCustomFoodModalOpen}
        onClose={() => setIsCustomFoodModalOpen(false)}
        title="Add Custom Food Product"
        subtitle="Saved to your private food library"
      >
        <form onSubmit={handleSaveCustomFood} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <GlassInput
              label="Product Name"
              placeholder="e.g. Sattu Drink"
              value={customFoodForm.product_name}
              onChange={(e) => setCustomFoodForm({ ...customFoodForm, product_name: e.target.value })}
              required
            />
            <GlassInput
              label="Brand / Source"
              placeholder="e.g. Homemade"
              value={customFoodForm.brand_name}
              onChange={(e) => setCustomFoodForm({ ...customFoodForm, brand_name: e.target.value })}
              required
            />
            <GlassSelect
              label="Preparation State"
              value={customFoodForm.preparation_state}
              onChange={(e) => setCustomFoodForm({ ...customFoodForm, preparation_state: e.target.value })}
              options={[
                { value: 'Packaged', label: 'Packaged' },
                { value: 'Cooked', label: 'Cooked' },
                { value: 'Raw', label: 'Raw' },
                { value: 'Boiled', label: 'Boiled' },
                { value: 'Roasted', label: 'Roasted' },
                { value: 'Grilled', label: 'Grilled' },
              ]}
            />
            <GlassSelect
              label="Nutrition Basis"
              value={customFoodForm.nutrition_basis}
              onChange={(e) => setCustomFoodForm({ ...customFoodForm, nutrition_basis: e.target.value })}
              options={[
                { value: 'per_100g', label: 'Per 100g' },
                { value: 'per_100ml', label: 'Per 100ml' },
                { value: 'per_serving', label: 'Per Serving' },
              ]}
            />
            <GlassInput
              label="Calories (kcal)"
              type="number"
              step="any"
              placeholder="e.g. 250"
              value={customFoodForm.calories}
              onChange={(e) => setCustomFoodForm({ ...customFoodForm, calories: e.target.value })}
            />
            <GlassInput
              label="Protein (g)"
              type="number"
              step="any"
              placeholder="e.g. 15.5"
              value={customFoodForm.protein}
              onChange={(e) => setCustomFoodForm({ ...customFoodForm, protein: e.target.value })}
            />
            <GlassInput
              label="Carbohydrates (g)"
              type="number"
              step="any"
              placeholder="e.g. 30.0"
              value={customFoodForm.carbohydrates}
              onChange={(e) => setCustomFoodForm({ ...customFoodForm, carbohydrates: e.target.value })}
            />
            <GlassInput
              label="Fats (g)"
              type="number"
              step="any"
              placeholder="e.g. 5.0"
              value={customFoodForm.fats}
              onChange={(e) => setCustomFoodForm({ ...customFoodForm, fats: e.target.value })}
            />
            <GlassInput
              label="Fiber (g)"
              type="number"
              step="any"
              placeholder="Optional"
              value={customFoodForm.fiber}
              onChange={(e) => setCustomFoodForm({ ...customFoodForm, fiber: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" type="button" onClick={() => setIsCustomFoodModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton variant="primary" size="sm" type="submit" disabled={isSavingCustomFood}>
              {isSavingCustomFood ? 'Saving...' : 'Save to Library'}
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  );
}
