import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function GlassSelect({
  label,
  id,
  value,
  onChange,
  options = [],
  error,
  required = false,
  className = '',
  disabled = false,
  ...props
}) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-royal-navy mb-1.5 uppercase tracking-wider"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <select
          id={selectId}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={`w-full py-2.5 px-3.5 pr-10 text-sm glass-input text-main-text appearance-none bg-white/80 cursor-pointer transition-all ${
            error ? '!border-rose-400' : ''
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          {...props}
        >
          {options.map((opt) => {
            const val = typeof opt === 'object' ? opt.value : opt;
            const lbl = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={val} value={val} className="text-main-text bg-white">
                {lbl}
              </option>
            );
          })}
        </select>
        <div className="absolute right-3.5 pointer-events-none text-muted-text">
          <ChevronDown size={16} />
        </div>
      </div>

      {error && <p className="mt-1 text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
}
