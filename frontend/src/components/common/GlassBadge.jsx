import React from 'react';

export default function GlassBadge({
  children,
  variant = 'blue',
  size = 'md',
  className = '',
}) {
  const variants = {
    blue: 'bg-electric-blue/15 text-electric-blue border-electric-blue/30',
    aqua: 'bg-aqua-teal/20 text-royal-navy border-aqua-teal/40',
    lavender: 'bg-pastel-lavender/35 text-purple-900 border-pastel-lavender/60',
    mint: 'bg-pastel-mint/35 text-emerald-900 border-pastel-mint/60',
    rose: 'bg-rose-500/15 text-rose-700 border-rose-300/40',
    amber: 'bg-amber-500/15 text-amber-800 border-amber-300/40',
    neutral: 'bg-slate-200/60 text-slate-700 border-slate-300/50',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 rounded-md font-medium',
    md: 'text-xs px-2.5 py-1 rounded-lg font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border backdrop-blur-sm ${variants[variant] || variants.blue} ${
        sizes[size] || sizes.md
      } ${className}`}
    >
      {children}
    </span>
  );
}
