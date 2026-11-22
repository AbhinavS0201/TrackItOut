import React, { useState } from 'react';
import { User, Bell, Shield, Globe, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/common/GlassCard';
import GlassButton from '../components/common/GlassButton';
import GlassInput from '../components/common/GlassInput';

export default function SettingsPage() {
  const { user, updateUserProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currency] = useState('INR (₹)');
  const [timezone] = useState('Asia/Kolkata');
  const [calorieGoal, setCalorieGoal] = useState('2200');
  const [proteinGoal, setProteinGoal] = useState('140');
  const [waterGoal, setWaterGoal] = useState('3000');

  const handleSave = (e) => {
    e.preventDefault();
    updateUserProfile({ name, phone });
    alert('Settings saved successfully!');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-royal-navy tracking-tight">Settings & Preferences</h2>
        <p className="text-xs text-muted-text mt-0.5">
          Configure your personal profile, regional currency, timezone, and daily health targets.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Card */}
        <GlassCard variant="standard">
          <h3 className="font-bold text-royal-navy text-base mb-4 pb-2 border-b border-slate-100">
            Personal Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <GlassInput
              label="Email Address"
              value={email}
              disabled
              helperText="Email is bound to your account login."
            />
            <GlassInput
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </GlassCard>

        {/* Regional Preferences */}
        <GlassCard variant="standard">
          <h3 className="font-bold text-royal-navy text-base mb-4 pb-2 border-b border-slate-100">
            Regional & Localization
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              label="Default Currency"
              value={currency}
              disabled
              helperText="TrackItOut default currency is INR (₹)"
            />
            <GlassInput
              label="Default Timezone"
              value={timezone}
              disabled
              helperText="Asia/Kolkata (IST)"
            />
          </div>
        </GlassCard>

        {/* Nutrition Targets */}
        <GlassCard variant="standard">
          <h3 className="font-bold text-royal-navy text-base mb-4 pb-2 border-b border-slate-100">
            Daily Health & Lifestyle Goals
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GlassInput
              label="Daily Calories (kcal)"
              type="number"
              value={calorieGoal}
              onChange={(e) => setCalorieGoal(e.target.value)}
            />
            <GlassInput
              label="Daily Protein Target (g)"
              type="number"
              value={proteinGoal}
              onChange={(e) => setProteinGoal(e.target.value)}
            />
            <GlassInput
              label="Water Target (ml)"
              type="number"
              value={waterGoal}
              onChange={(e) => setWaterGoal(e.target.value)}
            />
          </div>
        </GlassCard>

        <div className="flex justify-end">
          <GlassButton type="submit" variant="primary" icon={Save}>
            Save Preferences
          </GlassButton>
        </div>
      </form>
    </div>
  );
}
