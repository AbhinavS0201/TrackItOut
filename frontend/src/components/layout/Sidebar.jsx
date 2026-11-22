import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  Apple,
  Dumbbell,
  CheckSquare,
  LineChart,
  Sparkles,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCopilot } from '../../context/CopilotContext';

export default function Sidebar({ isMobileOpen, setIsMobileOpen }) {
  const { user, logout } = useAuth();
  const { setIsOpen: setCopilotOpen } = useCopilot();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Finance', path: '/finance', icon: Wallet },
    { name: 'Nutrition', path: '/nutrition', icon: Apple },
    { name: 'Fitness', path: '/fitness', icon: Dumbbell },
    { name: 'Habits', path: '/habits', icon: CheckSquare },
    { name: 'Analytics', path: '/analytics', icon: LineChart },
    { name: 'AI Copilot', action: () => setCopilotOpen(true), icon: Sparkles, badge: 'AI' },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMobile = () => {
    if (setIsMobileOpen) setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-midnight-navy/60 backdrop-blur-sm lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 glass-sidebar text-white flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Logo & Brand */}
        <div>
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-electric-blue via-royal-navy to-aqua-teal flex items-center justify-center shadow-aqua-glow">
                <span className="font-extrabold text-xl text-white tracking-tighter">T</span>
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight text-white">
                  Track<span className="text-aqua-teal">It</span>Out
                </h1>
                <p className="text-[10px] text-pastel-lavender font-medium uppercase tracking-wider">
                  Life Copilot
                </p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={closeMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>

          {/* Nav List */}
          <nav className="px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;

              if (item.action) {
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      item.action();
                      closeMobile();
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        size={18}
                        className="text-aqua-teal group-hover:scale-110 transition-transform"
                      />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-electric-blue to-aqua-teal text-midnight-navy shadow-sm">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              }

              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-electric-blue to-royal-navy text-white shadow-md shadow-electric-blue/20 font-semibold border border-white/20'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} />
                    <span>{item.name}</span>
                  </div>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout Footer */}
        <div className="p-4 border-t border-white/10 bg-midnight-navy/60">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 mb-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pastel-lavender to-pastel-blue text-midnight-navy font-bold flex items-center justify-center text-xs flex-shrink-0">
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.name || 'TrackItOut User'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email || ''}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
            >
              <LogOut size={16} />
            </button>
          </div>

          <div className="text-center">
            <p className="text-[10px] text-slate-400">TrackItOut v2.0 • Premium</p>
          </div>
        </div>
      </aside>
    </>
  );
}
