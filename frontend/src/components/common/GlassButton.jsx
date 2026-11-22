import React from 'react';

/**
 * Reusable GlassButton supporting 7 variants:
 * - primary: Royal Navy to Electric Blue solid glass
 * - secondary: Pastel blue/mint soft translucent surface
 * - gradient: Electric blue to Aqua glow gradient
 * - outline: Translucent with electric blue border
 * - ghost: Minimal hover effect, clear glass
 * - destructive: Rose/red warning glass
 * - icon: Round/square icon container
 */
export default function GlassButton({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
  ...props
}) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-xl font-medium',
    md: 'px-4 py-2 text-sm rounded-xl font-medium',
    lg: 'px-6 py-3 text-base rounded-2xl font-semibold',
    icon: 'p-2.5 rounded-xl',
  };

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-royal-navy to-electric-blue text-white shadow-md hover:shadow-lg hover:shadow-electric-blue/25 hover:-translate-y-0.5 active:translate-y-0 border border-white/20',
    secondary:
      'bg-pastel-blue/30 hover:bg-pastel-blue/50 text-royal-navy border border-pastel-blue/60 backdrop-blur-md hover:-translate-y-0.5',
    gradient:
      'bg-gradient-to-r from-electric-blue via-royal-navy to-aqua-teal text-white shadow-md hover:shadow-aqua-glow hover:-translate-y-0.5 border border-white/30',
    outline:
      'bg-white/40 hover:bg-white/80 text-royal-navy border border-electric-blue/40 hover:border-electric-blue backdrop-blur-md hover:-translate-y-0.5',
    ghost:
      'bg-transparent hover:bg-slate-100/60 text-muted-text hover:text-main-text border border-transparent backdrop-blur-sm',
    destructive:
      'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-300/40 hover:border-rose-400',
    icon:
      'bg-white/60 hover:bg-white text-royal-navy border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 backdrop-blur-md',
  };

  const isIconOnly = variant === 'icon' || (!children && Icon);
  const currentSize = isIconOnly ? sizeClasses.icon : (sizeClasses[size] || sizeClasses.md);
  const currentVariant = variantClasses[variant] || variantClasses.primary;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-200 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${currentSize} ${currentVariant} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
          {children}
          {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
        </>
      )}
    </button>
  );
}
