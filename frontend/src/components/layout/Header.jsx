import React from 'react';
import { Menu, Sparkles, Bell, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCopilot } from '../../context/CopilotContext';
import GlassButton from '../common/GlassButton';

export default function Header({ onMenuClick, title = 'Overview' }) {
  const { user } = useAuth();
  const { setIsOpen: setCopilotOpen } = useCopilot();

  const todayStr = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 w-full px-4 sm:px-6 py-3.5 glass-card !rounded-none !border-x-0 !border-t-0 !shadow-sm flex items-center justify-between">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-royal-navy hover:bg-slate-100 transition"
          aria-label="Open sidebar navigation"
        >
          <Menu size={20} />
        </button>

        <div>
          <h2 className="text-lg sm:text-xl font-bold text-royal-navy tracking-tight">{title}</h2>
          <div className="flex items-center gap-1.5 text-xs text-muted-text">
            <Calendar size={12} className="text-electric-blue" />
            <span>{todayStr}</span>
          </div>
        </div>
      </div>

      {/* Right: AI Copilot trigger pill & Quick profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <GlassButton
          variant="gradient"
          size="sm"
          icon={Sparkles}
          onClick={() => setCopilotOpen(true)}
          className="hidden sm:inline-flex shadow-sm hover:shadow-aqua-glow"
        >
          <span>Ask AI Copilot</span>
        </GlassButton>

        {/* User initials bubble */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-electric-blue to-aqua-teal text-white font-bold flex items-center justify-center text-xs shadow-sm">
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <span className="hidden md:inline-block text-xs font-semibold text-royal-navy">
            {user?.name?.split(' ')[0] || 'User'}
          </span>
        </div>
      </div>
    </header>
  );
}
