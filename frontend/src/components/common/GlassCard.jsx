import React from 'react';

/**
 * Reusable GlassCard component supporting 5 variants:
 * - standard: clean white translucent surface with soft blur
 * - gradient: subtle pastel/blue gradient glass
 * - highlight: electric blue & aqua glowing border
 * - interactive: hover lift and enhanced shadow
 * - dark: deep midnight navy glass surface
 */
export default function GlassCard({
  children,
  variant = 'standard',
  className = '',
  onClick,
  ...props
}) {
  const variantClasses = {
    standard: 'glass-card',
    gradient: 'glass-card-gradient',
    highlight: 'glass-card-highlight',
    interactive: 'glass-card-interactive cursor-pointer',
    dark: 'glass-card-dark',
  };

  const selectedClass = variantClasses[variant] || variantClasses.standard;

  return (
    <div
      className={`${selectedClass} p-5 sm:p-6 transition-all duration-200 ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}
