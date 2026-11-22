import React from 'react';

export default function VoiceWaveform({ isListening }) {
  if (!isListening) return null;

  return (
    <div className="flex items-center justify-center gap-1.5 py-3 px-4 bg-royal-navy/40 backdrop-blur-md rounded-2xl border border-electric-blue/40 shadow-aqua-glow animate-pulse-subtle">
      <div className="w-1.5 bg-aqua-teal rounded-full animate-waveform h-3" style={{ animationDelay: '0.1s' }} />
      <div className="w-1.5 bg-electric-blue rounded-full animate-waveform h-6" style={{ animationDelay: '0.3s' }} />
      <div className="w-1.5 bg-pastel-lavender rounded-full animate-waveform h-8" style={{ animationDelay: '0.2s' }} />
      <div className="w-1.5 bg-aqua-teal rounded-full animate-waveform h-5" style={{ animationDelay: '0.4s' }} />
      <div className="w-1.5 bg-pastel-mint rounded-full animate-waveform h-4" style={{ animationDelay: '0.15s' }} />
      <span className="ml-2 text-xs font-semibold text-aqua-teal uppercase tracking-wider">
        Listening...
      </span>
    </div>
  );
}
