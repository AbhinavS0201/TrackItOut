import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/common/GlassCard';
import GlassButton from '../components/common/GlassButton';
import GlassInput from '../components/common/GlassInput';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        await register(formData);
      } else {
        await login(formData.email, formData.password);
      }
      navigate('/dashboard');
    } catch (err) {
      console.error('Auth error:', err);
      const msg = err.response?.data?.message || err.message || 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#071B3A] via-[#103B78] to-[#1E293B] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative ambient glass glowing orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-electric-blue/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-aqua-teal/20 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[350px] h-[350px] rounded-full bg-pastel-lavender/15 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden shadow-2xl border border-white/20 backdrop-blur-2xl bg-white/10 relative z-10">
        {/* Left Side: Brand & Visuals */}
        <div className="lg:col-span-5 p-8 sm:p-10 flex flex-col justify-between bg-gradient-to-b from-midnight-navy/90 to-royal-navy/90 text-white border-b lg:border-b-0 lg:border-r border-white/10">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-electric-blue via-royal-navy to-aqua-teal flex items-center justify-center shadow-aqua-glow">
                <span className="font-extrabold text-2xl text-white">T</span>
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-white">
                  Track<span className="text-aqua-teal">It</span>Out
                </h1>
                <p className="text-[11px] text-pastel-lavender font-semibold uppercase tracking-wider">
                  Your Personal Life Copilot
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-aqua-teal text-xs font-semibold border border-aqua-teal/30">
                <Sparkles size={12} /> Unified Life Intelligence
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight text-white">
                Track everything. <br />
                <span className="bg-gradient-to-r from-aqua-teal via-pastel-blue to-pastel-lavender bg-clip-text text-transparent">
                  Understand yourself.
                </span> <br />
                Improve every day.
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Connect your finances, nutrition, fitness and daily habits into one intelligent AI platform.
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                <div className="text-base font-bold text-aqua-teal">4-in-1</div>
                <div className="text-[10px] text-slate-400">Integrated</div>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                <div className="text-base font-bold text-pastel-lavender">Voice</div>
                <div className="text-[10px] text-slate-400">AI Copilot</div>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                <div className="text-base font-bold text-pastel-mint">100%</div>
                <div className="text-[10px] text-slate-400">Private</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="lg:col-span-7 p-8 sm:p-10 bg-white/85 backdrop-blur-deep flex flex-col justify-center">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-royal-navy tracking-tight">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h3>
            <p className="text-xs sm:text-sm text-muted-text mt-1">
              {isSignUp
                ? 'Sign up to start tracking your finance, nutrition, and life goals.'
                : 'Log in to access your personal dashboard and AI Copilot.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold flex items-center justify-between">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <GlassInput
                  label="Full Name"
                  name="name"
                  type="text"
                  placeholder="Abhinav Rama"
                  icon={User}
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
                <GlassInput
                  label="Phone (Optional)"
                  name="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  icon={Phone}
                  value={formData.phone}
                  onChange={handleChange}
                />
              </>
            )}

            <GlassInput
              label="Email Address"
              name="email"
              type="email"
              placeholder="you@example.com"
              icon={Mail}
              value={formData.email}
              onChange={handleChange}
              required
            />

            <GlassInput
              label="Password"
              name="password"
              type="password"
              placeholder="At least 6 characters"
              icon={Lock}
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
            />

            <GlassButton
              type="submit"
              variant="gradient"
              size="lg"
              loading={loading}
              className="w-full mt-2 shadow-lg hover:shadow-aqua-glow"
              icon={ArrowRight}
              iconPosition="right"
            >
              {isSignUp ? 'Create Account' : 'Sign In to TrackItOut'}
            </GlassButton>
          </form>

          <div className="mt-6 text-center text-xs text-muted-text">
            {isSignUp ? 'Already have an account? ' : "Don't have an account yet? "}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-electric-blue hover:text-royal-navy font-bold transition"
            >
              {isSignUp ? 'Log in' : 'Create one now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
