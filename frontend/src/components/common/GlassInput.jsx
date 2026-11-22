import React from 'react';

export default function GlassInput({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  icon: Icon,
  error,
  helperText,
  required = false,
  className = '',
  disabled = false,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-royal-navy mb-1.5 uppercase tracking-wider"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-muted-text pointer-events-none flex items-center justify-center">
            <Icon size={16} />
          </div>
        )}

        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`w-full py-2.5 text-sm glass-input text-main-text placeholder:text-slate-400 transition-all ${
            Icon ? 'pl-10 pr-3.5' : 'px-3.5'
          } ${error ? '!border-rose-400 !ring-rose-200' : ''} ${
            disabled ? 'opacity-60 cursor-not-allowed bg-slate-100/50' : ''
          }`}
          {...props}
        />
      </div>

      {error ? (
        <p className="mt-1 text-xs text-rose-500 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-muted-text">{helperText}</p>
      ) : null}
    </div>
  );
}
