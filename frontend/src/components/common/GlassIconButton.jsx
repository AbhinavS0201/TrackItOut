import React from 'react';

export default function GlassIconButton({
  icon: Icon,
  label,
  variant = 'icon',
  size = 'md',
  className = '',
  onClick,
  ...props
}) {
  const sizes = {
    sm: 'p-1.5 rounded-lg',
    md: 'p-2 rounded-xl',
    lg: 'p-3 rounded-2xl',
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex items-center justify-center bg-white/70 hover:bg-white text-royal-navy border border-slate-200/80 shadow-sm hover:shadow-md hover:border-electric-blue/40 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={iconSizes[size]} />}
    </button>
  );
}
