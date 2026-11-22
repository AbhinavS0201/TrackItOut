import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import GlassIconButton from './GlassIconButton';

export default function GlassModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
      {/* Translucent backdrop */}
      <div
        className="fixed inset-0 glass-modal-backdrop transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidth} glass-card-gradient shadow-glass-lg border border-white/80 p-6 z-10 my-8 transition-transform duration-300 transform scale-100`}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200/60 mb-5">
          <div>
            <h3 className="text-xl font-bold text-royal-navy tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-muted-text mt-0.5">{subtitle}</p>}
          </div>
          <GlassIconButton icon={X} label="Close modal" size="sm" onClick={onClose} />
        </div>

        {/* Content */}
        <div className="modal-body max-h-[75vh] overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}
