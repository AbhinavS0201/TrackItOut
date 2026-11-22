import React, { useState, useEffect, useCallback } from 'react';
import {
  Dumbbell,
  Flame,
  TrendingUp,
  Plus,
  Calendar,
  CheckCircle2,
  Award,
  Clock,
  RotateCw,
  Activity,
  AlertTriangle,
  ChevronRight,
  Trash2,
  Edit2,
  Heart,
  Scale,
  Sparkles,
  Zap,
  Info,
} from 'lucide-react';
import apiClient from '../api/client';
import GlassCard from '../components/common/GlassCard';
import GlassButton from '../components/common/GlassButton';
import GlassInput from '../components/common/GlassInput';
import GlassModal from '../components/common/GlassModal';
import GlassBadge from '../components/common/GlassBadge';

export default function FitnessPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [overview, setOverview] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateDetail, setSelectedTemplateDetail] = useState(null);
  const [personalRecords, setPersonalRecords] = useState([]);
  const [bodyMetrics, setBodyMetrics] = useState([]);
  const [exercisesList, setExercisesList] = useState([]);
  const [tdeeCalibration, setTdeeCalibration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Tab: 'dashboard' | 'rotation' | 'templates' | 'prs' | 'energy'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Modals
  const [isLogWorkoutModalOpen, setIsLogWorkoutModalOpen] = useState(false);
  const [isWeighInModalOpen, setIsWeighInModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleSessionId, setRescheduleSessionId] = useState(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');
  const [is1RMConfirmModalOpen, setIs1RMConfirmModalOpen] = useState(false);
  const [pending1RMData, setPending1RMData] = useState(null);

  // Form State: New Session / Custom Workout
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionTemplateId, setNewSessionTemplateId] = useState('');
  const [newSessionSets, setNewSessionSets] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State: Weigh-In
  const [weighInWeight, setWeighInWeight] = useState('');
  const [weighInFatPct, setWeighInFatPct] = useState('');
  const [weighInNotes, setWeighInNotes] = useState('');

  // Fetch all fitness data for selected date
  const fetchFitnessData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, templatesRes, prsRes, metricsRes, exercisesRes, calibRes] = await Promise.all([
        apiClient.get(`/api/v1/fitness/overview?date=${selectedDate}`),
        apiClient.get('/api/v1/fitness/templates'),
        apiClient.get('/api/v1/fitness/personal-records'),
        apiClient.get('/api/v1/fitness/body-metrics?days=30'),
        apiClient.get('/api/v1/fitness/exercises'),
        apiClient.get('/api/v1/fitness/energy/calibration/trend'),
      ]);

      setOverview(overviewRes.data?.data || null);
      setTemplates(templatesRes.data?.data || []);
      setPersonalRecords(prsRes.data?.data || []);
      setBodyMetrics(metricsRes.data?.data || []);
      setExercisesList(exercisesRes.data?.data || []);
      setTdeeCalibration(calibRes.data?.data || null);
    } catch (err) {
      console.error('Failed to load fitness dashboard:', err);
      setError('Unable to connect to fitness services. Please verify backend connection.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchFitnessData();
  }, [fetchFitnessData]);

  // Listen for Copilot live events
  useEffect(() => {
    const handleCopilotUpdate = () => {
      fetchFitnessData();
    };
    window.addEventListener('fitness-updated', handleCopilotUpdate);
    return () => window.removeEventListener('fitness-updated', handleCopilotUpdate);
  }, [fetchFitnessData]);

  // View template details
  const handleViewTemplate = async (templateId) => {
    try {
      const res = await apiClient.get(`/api/v1/fitness/templates/${templateId}`);
      setSelectedTemplateDetail(res.data?.data || null);
    } catch (err) {
      console.error('Error fetching template details:', err);
    }
  };

  // Start a workout from template
  const handleStartWorkoutFromTemplate = async (template) => {
    try {
      setIsSubmitting(true);
      const res = await apiClient.post('/api/v1/fitness/sessions', {
        template_id: template.id,
        rotation_code: template.routine_code || null,
        title: template.name,
        planned_date: selectedDate,
        status: 'planned',
        advances_rotation: template.routine_code ? 1 : 0,
      });
      await fetchFitnessData();
      alert(`Workout "${template.name}" activated for ${selectedDate}!`);
    } catch (err) {
      alert(`Error starting workout: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reschedule session
  const handleExecuteReschedule = async () => {
    if (!rescheduleSessionId || !newRescheduleDate) return;
    try {
      setIsSubmitting(true);
      await apiClient.post(`/api/v1/fitness/sessions/${rescheduleSessionId}/reschedule`, {
        newDate: newRescheduleDate,
      });
      setIsRescheduleModalOpen(false);
      await fetchFitnessData();
      alert(`Session rescheduled to ${newRescheduleDate}!`);
    } catch (err) {
      alert(`Reschedule error: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete workout session
  const handleCompleteSession = async (session, isPartial = false) => {
    try {
      setIsSubmitting(true);
      await apiClient.post(`/api/v1/fitness/sessions/${session.id}/complete`, {
        actual_date: selectedDate,
        duration_minutes: session.duration_minutes || 50,
        is_partial: isPartial ? 1 : 0,
      });
      await fetchFitnessData();
      alert(`Workout completed! Rotation state evaluated.`);
    } catch (err) {
      alert(`Error completing session: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete workout session
  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Delete this workout session? Any associated PRs will be recalculated.')) return;
    try {
      await apiClient.delete(`/api/v1/fitness/sessions/${sessionId}`);
      await fetchFitnessData();
    } catch (err) {
      alert(`Error deleting session: ${err.response?.data?.message || err.message}`);
    }
  };

  // Save new weigh-in
  const handleSaveWeighIn = async (e) => {
    e.preventDefault();
    const w = parseFloat(weighInWeight);
    if (isNaN(w) || w <= 0) {
      alert('Please enter a valid weight measurement in kg.');
      return;
    }
    try {
      setIsSubmitting(true);
      await apiClient.post('/api/v1/fitness/body-metrics', {
        recorded_date: selectedDate,
        weight_kg: w,
        body_fat_pct: weighInFatPct ? parseFloat(weighInFatPct) : null,
        notes: weighInNotes || null,
      });
      setIsWeighInModalOpen(false);
      setWeighInWeight('');
      setWeighInFatPct('');
      setWeighInNotes('');
      await fetchFitnessData();
      alert('Body weight recorded successfully!');
    } catch (err) {
      alert(`Error saving weigh-in: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add set to session draft
  const handleAddSetToDraft = () => {
    setNewSessionSets((prev) => [
      ...prev,
      {
        exercise_id: exercisesList[0]?.id || 1,
        set_type: 'normal',
        weight_kg: 40,
        reps: 10,
        added_weight_kg: 0,
        is_confirmed_1rm: false,
      },
    ]);
  };

  // Submit complete workout logger
  const handleSaveWorkoutDraft = async () => {
    if (!newSessionTitle.trim()) {
      alert('Please provide a workout title.');
      return;
    }
    try {
      setIsSubmitting(true);
      await apiClient.post('/api/v1/fitness/sessions', {
        template_id: newSessionTemplateId ? parseInt(newSessionTemplateId, 10) : null,
        title: newSessionTitle.trim(),
        planned_date: selectedDate,
        actual_date: selectedDate,
        status: 'completed',
        duration_minutes: 50,
        advances_rotation: 0,
        sets: newSessionSets,
      });
      setIsLogWorkoutModalOpen(false);
      setNewSessionTitle('');
      setNewSessionSets([]);
      await fetchFitnessData();
      alert('Workout logged successfully!');
    } catch (err) {
      alert(`Error saving workout: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Treadmill 20-min routine directly to today's session
  const handleAddTreadmillRoutine = async () => {
    try {
      setIsSubmitting(true);
      const treadmillTemplate = templates.find((t) => t.template_key === 'tmpl_cardio_treadmill_incline_20m');
      const treadmillEx = exercisesList.find((e) => e.seed_key === 'seed_ex_treadmill_incline_walk');

      await apiClient.post('/api/v1/fitness/sessions', {
        template_id: treadmillTemplate ? treadmillTemplate.id : null,
        title: '20-Min Post-Workout Incline Treadmill Walk',
        planned_date: selectedDate,
        actual_date: selectedDate,
        status: 'completed',
        duration_minutes: 20,
        advances_rotation: 0,
        sets: [
          { exercise_id: treadmillEx?.id || 41, duration_seconds: 180, incline_pct: 0.0, speed_kmh: 3.0, notes: 'Stage 1 Warmup' },
          { exercise_id: treadmillEx?.id || 41, duration_seconds: 240, incline_pct: 8.0, speed_kmh: 3.5, notes: 'Stage 2 Moderate climb' },
          { exercise_id: treadmillEx?.id || 41, duration_seconds: 360, incline_pct: 12.0, speed_kmh: 3.5, notes: 'Stage 3 Steep climb' },
          { exercise_id: treadmillEx?.id || 41, duration_seconds: 240, incline_pct: 10.0, speed_kmh: 4.0, notes: 'Stage 4 High-tempo climb' },
          { exercise_id: treadmillEx?.id || 41, duration_seconds: 180, incline_pct: 0.0, speed_kmh: 3.0, notes: 'Stage 5 Cool-down' },
        ],
      });
      await fetchFitnessData();
      alert('20-Minute Incline Treadmill Protocol logged for today!');
    } catch (err) {
      alert(`Error logging cardio: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const rotation = overview?.rotation;
  const sessions = overview?.sessions || [];
  const latestWeight = overview?.latestWeightKg;
  const energySummary = overview?.energySummary;

  return (
    <div className="space-y-6">
      {/* ─── Top Banner & Date Picker ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-royal-navy tracking-tight flex items-center gap-2">
            <span>Fitness & Strength</span>
            <span className="p-1.5 rounded-xl bg-electric-blue/15 text-electric-blue">
              <Dumbbell size={20} />
            </span>
          </h2>
          <p className="text-xs text-muted-text mt-0.5">
            A/B/C/D split rotations, gym logging, ACSM cardio protocols, and scientific energy expenditure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Selector */}
          <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-glass-sm">
            <Calendar size={14} className="text-electric-blue" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-royal-navy focus:outline-none"
            />
          </div>

          <GlassButton
            variant="ghost"
            size="sm"
            icon={Scale}
            onClick={() => setIsWeighInModalOpen(true)}
          >
            <span>Weigh-In</span>
          </GlassButton>

          <GlassButton
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => {
              setNewSessionTitle('');
              setNewSessionSets([
                {
                  exercise_id: exercisesList[0]?.id || 1,
                  set_type: 'normal',
                  weight_kg: 40,
                  reps: 10,
                  is_confirmed_1rm: false,
                },
              ]);
              setIsLogWorkoutModalOpen(true);
            }}
          >
            <span>Log Workout</span>
          </GlassButton>
        </div>
      </div>

      {/* ─── Rotation Split Status Hero Card ─────────────────────────────────── */}
      <GlassCard variant="gradient" className="relative overflow-hidden border border-electric-blue/20">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <GlassBadge variant="aqua" size="md">
                Active Rotation: Routine {rotation?.current_position || 'A'}
              </GlassBadge>
              <GlassBadge variant="neutral" size="sm">
                Queue: A → B → C → D
              </GlassBadge>
            </div>

            <h3 className="text-xl font-extrabold text-royal-navy">
              {rotation?.template_name || 'Workout A: Chest + Shoulders + Abs'}
            </h3>
            <p className="text-xs text-muted-text max-w-2xl leading-relaxed">
              {rotation?.template_description ||
                'Flexible queue advances ONLY upon completing your scheduled split routine. Custom, ad-hoc workouts and rest days preserve your queue position.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {rotation && (
              <GlassButton
                variant="primary"
                size="sm"
                icon={Zap}
                disabled={isSubmitting}
                onClick={() => {
                  const tmpl = templates.find((t) => t.routine_code === rotation.current_position);
                  if (tmpl) handleStartWorkoutFromTemplate(tmpl);
                }}
              >
                <span>Start Routine {rotation.current_position}</span>
              </GlassButton>
            )}

            <GlassButton
              variant="secondary"
              size="sm"
              icon={Activity}
              onClick={handleAddTreadmillRoutine}
              disabled={isSubmitting}
            >
              <span>+ 20m Incline Cardio</span>
            </GlassButton>
          </div>
        </div>
      </GlassCard>

      {/* ─── Metric Cards Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Latest Body Weight */}
        <GlassCard variant="standard">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-text uppercase">Body Weight</span>
            <div className="p-2 rounded-xl bg-electric-blue/15 text-electric-blue">
              <Scale size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-royal-navy">
            {latestWeight !== null ? `${latestWeight} kg` : '—'}
          </div>
          <p className="text-[11px] text-muted-text mt-1">
            {latestWeight !== null ? 'Latest recorded weigh-in' : 'No weigh-in logged yet'}
          </p>
        </GlassCard>

        {/* Metric 2: Session Active Calorie Expenditure */}
        <GlassCard variant="standard">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-text uppercase">Session Active Burn</span>
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-500">
              <Flame size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-royal-navy">
            {energySummary?.gymActiveKcal || energySummary?.walkingActiveKcal
              ? `${Math.round((energySummary.gymActiveKcal || 0) + (energySummary.walkingActiveKcal || 0))} kcal`
              : '0 kcal'}
          </div>
          <p className="text-[11px] text-muted-text mt-1">
            Session-level MET & ACSM Net Active
          </p>
        </GlassCard>

        {/* Metric 3: Estimated Resting Energy (REE/RMR) */}
        <GlassCard variant="standard">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-text uppercase">Estimated REE (Mifflin)</span>
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-600">
              <Heart size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-royal-navy">
            {energySummary?.reeKcal ? `${Math.round(energySummary.reeKcal)} kcal` : '—'}
          </div>
          <p className="text-[11px] text-muted-text mt-1">
            {energySummary?.reeKcal ? 'Resting expenditure baseline' : 'Awaiting weight/biometrics'}
          </p>
        </GlassCard>

        {/* Metric 4: Synthesized Total Daily TDEE */}
        <GlassCard variant="standard">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-text uppercase">Estimated TDEE</span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600">
              <Award size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-royal-navy">
            {energySummary?.totalEstimatedTdeeKcal
              ? `${Math.round(energySummary.totalEstimatedTdeeKcal)} kcal`
              : '—'}
          </div>
          <p className="text-[11px] text-muted-text mt-1">
            REE + Gym + Cardio + NEAT + TEF
          </p>
        </GlassCard>
      </div>

      {/* ─── Navigation Tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'dashboard', label: "Today's Workouts" },
          { id: 'templates', label: 'My Split Routines (A/B/C/D)' },
          { id: 'treadmill', label: '20-Min Incline Protocol' },
          { id: 'prs', label: 'Personal Records (PRs)' },
          { id: 'energy', label: 'Scientific Energy Engine' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-royal-navy text-white shadow-sm'
                : 'text-muted-text hover:text-royal-navy hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1: TODAY'S WORKOUTS ─────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-royal-navy text-base">
              Workouts for {selectedDate} ({sessions.length})
            </h3>
            <span className="text-xs text-muted-text">
              Actual completion dates and planned dates are preserved independently.
            </span>
          </div>

          {sessions.length === 0 ? (
            <GlassCard variant="standard" className="text-center py-10">
              <Dumbbell size={36} className="mx-auto text-slate-300 mb-3" />
              <h4 className="font-bold text-royal-navy text-sm">No workout scheduled for this date</h4>
              <p className="text-xs text-muted-text max-w-md mx-auto mt-1 mb-4">
                You can start your queued Routine ({rotation?.current_position || 'A'}), attach the 20-min treadmill protocol, or log a custom session.
              </p>
              <div className="flex justify-center gap-2">
                {rotation && (
                  <GlassButton
                    variant="primary"
                    size="sm"
                    icon={PlayCircleIcon}
                    onClick={() => {
                      const tmpl = templates.find((t) => t.routine_code === rotation.current_position);
                      if (tmpl) handleStartWorkoutFromTemplate(tmpl);
                    }}
                  >
                    <span>Start Routine {rotation.current_position}</span>
                  </GlassButton>
                )}
                <GlassButton
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setIsLogWorkoutModalOpen(true)}
                >
                  <span>Custom Workout</span>
                </GlassButton>
              </div>
            </GlassCard>
          ) : (
            sessions.map((sess) => (
              <GlassCard key={sess.id} variant="standard" className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-royal-navy text-base">{sess.title}</h4>
                      {sess.rotation_code && (
                        <GlassBadge variant="aqua" size="sm">
                          Routine {sess.rotation_code}
                        </GlassBadge>
                      )}
                      <GlassBadge
                        variant={
                          sess.status === 'completed'
                            ? 'mint'
                            : sess.status === 'planned'
                            ? 'blue'
                            : sess.status === 'postponed'
                            ? 'amber'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {sess.status.toUpperCase()}
                      </GlassBadge>
                      {sess.is_partial === 1 && (
                        <GlassBadge variant="lavender" size="sm">
                          Partial Workout
                        </GlassBadge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-text mt-1">
                      <span>Planned: {sess.planned_date?.substring(0, 10)}</span>
                      {sess.actual_date && <span>• Actual: {sess.actual_date?.substring(0, 10)}</span>}
                      {sess.duration_minutes && <span>• {sess.duration_minutes} mins</span>}
                      {sess.session_net_active_kcal > 0 && (
                        <span className="text-rose-600 font-semibold">
                          • {Math.round(sess.session_net_active_kcal)} active kcal
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {sess.status === 'planned' && (
                      <>
                        <GlassButton
                          variant="primary"
                          size="sm"
                          icon={CheckCircle2}
                          onClick={() => handleCompleteSession(sess, false)}
                        >
                          <span>Complete</span>
                        </GlassButton>
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCompleteSession(sess, true)}
                        >
                          <span>Partial</span>
                        </GlassButton>
                        <GlassButton
                          variant="secondary"
                          size="sm"
                          icon={Calendar}
                          onClick={() => {
                            setRescheduleSessionId(sess.id);
                            setNewRescheduleDate('');
                            setIsRescheduleModalOpen(true);
                          }}
                        >
                          <span>Reschedule</span>
                        </GlassButton>
                      </>
                    )}
                    <button
                      onClick={() => handleDeleteSession(sess.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Delete workout session"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Volume (Strength)</span>
                    <span className="font-bold text-royal-navy text-sm">
                      {parseFloat(sess.total_strength_volume_kg) > 0 ? `${sess.total_strength_volume_kg} kg` : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Bodyweight Reps</span>
                    <span className="font-bold text-royal-navy text-sm">
                      {sess.total_bodyweight_reps > 0 ? `${sess.total_bodyweight_reps} reps` : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Cardio Duration</span>
                    <span className="font-bold text-royal-navy text-sm">
                      {sess.total_cardio_duration_sec > 0
                        ? `${Math.round(sess.total_cardio_duration_sec / 60)} mins`
                        : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Rotation Impact</span>
                    <span className="font-bold text-royal-navy text-sm">
                      {sess.advances_rotation ? 'Advances Rotation' : 'Non-advancing'}
                    </span>
                  </div>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      )}

      {/* ─── TAB 2: MY 4-DAY SPLIT ROUTINES (A/B/C/D) ───────────────────────── */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-royal-navy text-base">Personalized 4-Day Workout Split</h3>
            <span className="text-xs text-muted-text">A/B/C/D rotation configured exclusively for your account</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates
              .filter((t) => t.routine_code)
              .map((tmpl) => (
                <GlassCard key={tmpl.id} variant="standard" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-royal-navy text-white font-extrabold text-sm flex items-center justify-center">
                        {tmpl.routine_code}
                      </span>
                      <div>
                        <h4 className="font-bold text-royal-navy text-sm">{tmpl.name}</h4>
                        <span className="text-xs text-muted-text">{tmpl.target_duration_minutes} mins target</span>
                      </div>
                    </div>
                    {rotation?.current_position === tmpl.routine_code && (
                      <GlassBadge variant="aqua" size="sm">
                        Current Queue Target
                      </GlassBadge>
                    )}
                  </div>

                  <p className="text-xs text-muted-text leading-relaxed">{tmpl.description}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleViewTemplate(tmpl.id)}
                      className="text-xs font-semibold text-electric-blue hover:underline flex items-center gap-1"
                    >
                      <span>View Exercises ({tmpl.exercise_count})</span>
                      <ChevronRight size={14} />
                    </button>

                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => handleStartWorkoutFromTemplate(tmpl)}
                    >
                      <span>Schedule Workout</span>
                    </GlassButton>
                  </div>
                </GlassCard>
              ))}
          </div>

          {/* Template Detail Drawer / Modal View */}
          {selectedTemplateDetail && (
            <GlassCard variant="standard" className="mt-4 border-2 border-electric-blue/30 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-bold text-royal-navy text-sm">
                  Exercises in {selectedTemplateDetail.name} ({selectedTemplateDetail.exercises?.length})
                </h4>
                <button
                  onClick={() => setSelectedTemplateDetail(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {selectedTemplateDetail.exercises?.map((ex, idx) => (
                  <div
                    key={ex.id || idx}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-royal-navy">{ex.exercise_name}</span>
                      <div className="text-[11px] text-muted-text mt-0.5">
                        {ex.primary_muscle} • {ex.equipment} • {ex.movement_pattern}
                      </div>
                    </div>
                    <GlassBadge variant="neutral" size="sm">
                      {ex.default_met} MET
                    </GlassBadge>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* ─── TAB 3: 20-MIN INCLINE PROTOCOL (ACSM) ───────────────────────────── */}
      {activeTab === 'treadmill' && (
        <div className="space-y-4">
          <GlassCard variant="gradient" className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <GlassBadge variant="aqua" size="sm">
                  ACSM Metabolic Equation
                </GlassBadge>
                <h3 className="text-lg font-bold text-royal-navy mt-1">
                  20-Min Post-Workout Incline Walking Protocol
                </h3>
                <p className="text-xs text-muted-text">
                  Standalone reusable fat burn protocol: VO2 = (0.1 × S) + (1.8 × S × G) + 3.5. Stage-by-stage Net Active calories.
                </p>
              </div>

              <GlassButton
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={handleAddTreadmillRoutine}
              >
                <span>Add to Today's Log</span>
              </GlassButton>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-2">
              {[
                { stage: 1, time: '0–3 min', incline: '0%', speed: '3.0 km/h', desc: 'Warmup walk' },
                { stage: 2, time: '3–7 min', incline: '8%', speed: '3.5 km/h', desc: 'Moderate climb' },
                { stage: 3, time: '7–13 min', incline: '12%', speed: '3.5 km/h', desc: 'Steep climb endurance' },
                { stage: 4, time: '13–17 min', incline: '10%', speed: '4.0 km/h', desc: 'High-tempo brisk climb' },
                { stage: 5, time: '17–20 min', incline: '0%', speed: '3.0 km/h', desc: 'Cool-down walk' },
              ].map((st) => (
                <div key={st.stage} className="p-3 rounded-2xl bg-white/70 border border-slate-200 shadow-sm text-center">
                  <div className="text-[10px] font-bold text-electric-blue uppercase">Stage {st.stage}</div>
                  <div className="text-sm font-extrabold text-royal-navy mt-0.5">{st.time}</div>
                  <div className="text-xs font-semibold text-emerald-700 mt-1">{st.incline} @ {st.speed}</div>
                  <div className="text-[11px] text-muted-text mt-0.5">{st.desc}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ─── TAB 4: PERSONAL RECORDS (PRS) ──────────────────────────────────── */}
      {activeTab === 'prs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-royal-navy text-base">Verified Personal Records</h3>
            <span className="text-xs text-muted-text">
              Actual Confirmed 1RMs and Epley estimated 1RMs tracked deterministically.
            </span>
          </div>

          {personalRecords.length === 0 ? (
            <GlassCard variant="standard" className="text-center py-10">
              <Award size={36} className="mx-auto text-slate-300 mb-2" />
              <h4 className="font-bold text-royal-navy text-sm">No personal records logged yet</h4>
              <p className="text-xs text-muted-text max-w-sm mx-auto mt-1">
                Complete workout sessions with working sets or confirmed maximal lifts to populate your official records.
              </p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {personalRecords.map((pr) => (
                <GlassCard key={pr.id} variant="standard" className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-royal-navy">{pr.exercise_name}</span>
                    <GlassBadge
                      variant={
                        pr.record_type === 'actual_1rm'
                          ? 'rose'
                          : pr.record_type === 'estimated_1rm'
                          ? 'lavender'
                          : 'blue'
                      }
                      size="sm"
                    >
                      {pr.record_type.replace('_', ' ').toUpperCase()}
                    </GlassBadge>
                  </div>
                  <div className="text-2xl font-extrabold text-royal-navy">
                    {pr.numeric_value} {pr.record_type.includes('pace') ? 'min/km' : pr.record_type.includes('duration') ? 's' : 'kg'}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-text border-t border-slate-100 pt-1.5">
                    <span>{pr.reps_performed ? `${pr.reps_performed} reps` : 'Max effort'}</span>
                    <span>Achieved: {pr.achieved_date?.substring(0, 10)}</span>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: SCIENTIFIC ENERGY EXPENDITURE ENGINE ─────────────────────── */}
      {activeTab === 'energy' && (
        <div className="space-y-4">
          <GlassCard variant="standard" className="space-y-4">
            <div>
              <h3 className="font-bold text-royal-navy text-base flex items-center gap-2">
                <Flame size={18} className="text-rose-500" />
                <span>Daily Energy Expenditure Breakdown ({selectedDate})</span>
              </h3>
              <p className="text-xs text-muted-text mt-0.5">
                Resting metabolism and activity components are synthesized without double-counting resting VO2.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-100">
                <span className="text-purple-700 block font-bold text-[10px] uppercase">1. Resting Energy (REE)</span>
                <span className="text-lg font-extrabold text-royal-navy">
                  {energySummary?.reeKcal ? `${Math.round(energySummary.reeKcal)} kcal` : '—'}
                </span>
                <span className="text-[10px] text-purple-600 block mt-0.5">Mifflin-St Jeor formula</span>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-100">
                <span className="text-rose-700 block font-bold text-[10px] uppercase">2. Net Gym Resistance</span>
                <span className="text-lg font-extrabold text-royal-navy">
                  {energySummary?.gymActiveKcal ? `${Math.round(energySummary.gymActiveKcal)} kcal` : '0 kcal'}
                </span>
                <span className="text-[10px] text-rose-600 block mt-0.5">Session MET above resting</span>
              </div>

              <div className="p-3 rounded-xl bg-teal-50/80 border border-teal-100">
                <span className="text-teal-700 block font-bold text-[10px] uppercase">3. Net Cardio / Walking</span>
                <span className="text-lg font-extrabold text-royal-navy">
                  {energySummary?.walkingActiveKcal ? `${Math.round(energySummary.walkingActiveKcal)} kcal` : '0 kcal'}
                </span>
                <span className="text-[10px] text-teal-600 block mt-0.5">ACSM Speed & Incline VO2</span>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-100">
                <span className="text-amber-700 block font-bold text-[10px] uppercase">4. Thermic Effect (TEF)</span>
                <span className="text-lg font-extrabold text-royal-navy">
                  {energySummary?.tefEstimatedKcal != null ? `${Math.round(energySummary.tefEstimatedKcal)} kcal` : 'Unrecorded'}
                </span>
                <span className="text-[10px] text-amber-600 block mt-0.5">
                  {energySummary?.tefEstimatedKcal != null ? 'P 25%, C 7.5%, F 1.5%' : 'Awaiting meal logs (not assumed 0)'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-100">
                <span className="text-emerald-700 block font-bold text-[10px] uppercase">Total Estimated TDEE</span>
                <span className="text-lg font-extrabold text-royal-navy">
                  {energySummary?.totalEstimatedTdeeKcal ? `${Math.round(energySummary.totalEstimatedTdeeKcal)} kcal` : '—'}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5">±8% physiological margin</span>
              </div>
            </div>

            {/* OLS Calibration Status Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-royal-navy text-sm flex items-center gap-1.5">
                  <TrendingUp size={16} className="text-electric-blue" />
                  <span>14–21 Day OLS Trend Calibration</span>
                </span>
                <GlassBadge
                  variant={tdeeCalibration?.status === 'SUCCESS' ? 'mint' : 'amber'}
                  size="sm"
                >
                  {tdeeCalibration?.status === 'SUCCESS' ? 'CALIBRATED' : 'INSUFFICIENT DATA'}
                </GlassBadge>
              </div>

              {tdeeCalibration?.status === 'SUCCESS' ? (
                <div className="space-y-1 text-slate-700">
                  <div>
                    Observed Calibrated TDEE: <strong className="text-royal-navy">{tdeeCalibration.calibrated_tdee_kcal} kcal/day</strong> (Uncertainty Range: {tdeeCalibration.uncertainty_range_kcal[0]}–{tdeeCalibration.uncertainty_range_kcal[1]} kcal)
                  </div>
                  <div>
                    Average Intake: {tdeeCalibration.avg_daily_intake_kcal} kcal/day • Weight Slope: {tdeeCalibration.weight_slope_kg_per_day} kg/day over {tdeeCalibration.elapsed_days} elapsed days.
                  </div>
                </div>
              ) : (
                <p className="text-muted-text">
                  {tdeeCalibration?.reason ||
                    'Requires a minimum of 14 elapsed days and at least 6 distinct weigh-ins with >= 80% meal logging completeness to eliminate acute glycogen/water shifts.'}
                </p>
              )}

              <div className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-200">
                Note: 7,700 kcal/kg (3,500 kcal/lb) is an accepted physiological approximation. Formula-derived estimates are preserved independently and never silently overwritten.
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ─── MODAL 1: LOG WORKOUT ────────────────────────────────────────────── */}
      <GlassModal
        isOpen={isLogWorkoutModalOpen}
        onClose={() => setIsLogWorkoutModalOpen(false)}
        title="Log Workout Session"
        subtitle="Record exercise sets, weight lifted, and cardio"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <GlassInput
            label="Workout Title"
            placeholder="e.g. Chest & Shoulders Hypertrophy"
            value={newSessionTitle}
            onChange={(e) => setNewSessionTitle(e.target.value)}
            required
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-royal-navy">Working Sets</span>
              <button
                type="button"
                onClick={handleAddSetToDraft}
                className="text-xs font-semibold text-electric-blue hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Add Set
              </button>
            </div>

            {newSessionSets.map((s, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-royal-navy">Set #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => setNewSessionSets((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    Remove
                  </button>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-text block mb-1">Exercise</label>
                  <select
                    value={s.exercise_id}
                    onChange={(e) => {
                      const id = parseInt(e.target.value, 10);
                      setNewSessionSets((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, exercise_id: id } : item))
                      );
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-royal-navy focus:outline-none"
                  >
                    {exercisesList.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name} ({ex.primary_muscle})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-text block mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={s.weight_kg || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setNewSessionSets((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, weight_kg: val } : item))
                        );
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-royal-navy"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-text block mb-1">Reps</label>
                    <input
                      type="number"
                      value={s.reps || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setNewSessionSets((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, reps: val } : item))
                        );
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-royal-navy"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-text block mb-1">Set Type</label>
                    <select
                      value={s.set_type}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewSessionSets((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, set_type: val } : item))
                        );
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs text-royal-navy"
                    >
                      <option value="normal">Normal</option>
                      <option value="warmup">Warmup</option>
                      <option value="dropset">Dropset</option>
                      <option value="failure">Failure</option>
                    </select>
                  </div>
                </div>

                {/* Confirmed 1RM Toggle */}
                {s.reps === 1 && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id={`confirmed-1rm-${idx}`}
                      checked={s.is_confirmed_1rm}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          setPending1RMData({ setIndex: idx, weight: s.weight_kg });
                          setIs1RMConfirmModalOpen(true);
                        } else {
                          setNewSessionSets((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, is_confirmed_1rm: false } : item))
                          );
                        }
                      }}
                    />
                    <label htmlFor={`confirmed-1rm-${idx}`} className="text-[11px] font-bold text-amber-700">
                      Confirmed Actual 1RM Lift
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsLogWorkoutModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              onClick={handleSaveWorkoutDraft}
            >
              <span>Save Completed Workout</span>
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ─── MODAL 2: WEIGH-IN ──────────────────────────────────────────────── */}
      <GlassModal
        isOpen={isWeighInModalOpen}
        onClose={() => setIsWeighInModalOpen(false)}
        title="Record Body Weight"
        subtitle={`Log measurement for ${selectedDate}`}
      >
        <form onSubmit={handleSaveWeighIn} className="space-y-4">
          <GlassInput
            label="Weight (kg)"
            type="number"
            step="0.1"
            placeholder="e.g. 72.5"
            value={weighInWeight}
            onChange={(e) => setWeighInWeight(e.target.value)}
            required
          />

          <GlassInput
            label="Body Fat % (Optional)"
            type="number"
            step="0.1"
            placeholder="e.g. 15.5"
            value={weighInFatPct}
            onChange={(e) => setWeighInFatPct(e.target.value)}
          />

          <GlassInput
            label="Notes"
            placeholder="e.g. Morning fasted"
            value={weighInNotes}
            onChange={(e) => setWeighInNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" type="button" onClick={() => setIsWeighInModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton variant="primary" size="sm" type="submit" disabled={isSubmitting}>
              <span>Save Measurement</span>
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* ─── MODAL 3: RESCHEDULE WORKOUT ────────────────────────────────────── */}
      <GlassModal
        isOpen={isRescheduleModalOpen}
        onClose={() => setIsRescheduleModalOpen(false)}
        title="Reschedule Workout"
        subtitle="Select a new date without disrupting rotation history"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-royal-navy block mb-1">New Planned Date</label>
            <input
              type="date"
              value={newRescheduleDate}
              onChange={(e) => setNewRescheduleDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-royal-navy focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton variant="ghost" size="sm" onClick={() => setIsRescheduleModalOpen(false)}>
              Cancel
            </GlassButton>
            <GlassButton variant="primary" size="sm" disabled={isSubmitting} onClick={handleExecuteReschedule}>
              <span>Confirm Reschedule</span>
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ─── MODAL 4: 1RM CONFIRMATION GATE ──────────────────────────────────── */}
      <GlassModal
        isOpen={is1RMConfirmModalOpen}
        onClose={() => setIs1RMConfirmModalOpen(false)}
        title="Confirm Actual One-Rep Maximum"
        subtitle="Verification required before writing to official PR ledger"
      >
        <div className="space-y-3 text-xs text-slate-700">
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-300 text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle size={16} className="text-amber-600" />
              <span>Official PR Ledger Confirmation</span>
            </div>
            <p>
              You are designating this <strong>{pending1RMData?.weight} kg</strong> single repetition as an <strong>Actual Confirmed 1RM</strong>.
              Ordinary sets of 1 rep are not automatically tagged as maximal PRs unless verified.
            </p>
          </div>

          <p>
            Do you confirm that this repetition was an all-out confirmed maximal lift?
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setIs1RMConfirmModalOpen(false);
                setPending1RMData(null);
              }}
            >
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={() => {
                if (pending1RMData) {
                  setNewSessionSets((prev) =>
                    prev.map((item, i) =>
                      i === pending1RMData.setIndex ? { ...item, is_confirmed_1rm: true } : item
                    )
                  );
                }
                setIs1RMConfirmModalOpen(false);
                setPending1RMData(null);
              }}
            >
              <span>Confirm Verified 1RM</span>
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}

function PlayCircleIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  );
}
