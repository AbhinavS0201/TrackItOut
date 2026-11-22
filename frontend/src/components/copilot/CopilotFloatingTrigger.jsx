import React from 'react';
import { Mic, Sparkles } from 'lucide-react';
import { useCopilot } from '../../context/CopilotContext';

export default function CopilotFloatingTrigger() {
  const { isOpen, setIsOpen, isListening, toggleVoiceListening } = useCopilot();

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
      {/* Speech prompt pill on desktop */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="hidden md:flex items-center gap-2 px-3.5 py-2 glass-card-interactive shadow-glass-hover text-xs font-semibold text-royal-navy border border-electric-blue/30 hover:border-electric-blue"
        >
          <Sparkles size={14} className="text-electric-blue" />
          <span>Ask TrackItOut Copilot</span>
        </button>
      )}

      {/* Main Floating Glass Microphone Action Button */}
      <button
        type="button"
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
            toggleVoiceListening();
          } else {
            toggleVoiceListening();
          }
        }}
        aria-label="Open AI Copilot Voice Assistant"
        className={`copilot-fab relative flex items-center justify-center w-14 h-14 rounded-full text-white cursor-pointer select-none ${
          isListening ? 'ring-4 ring-aqua-teal ring-offset-2 ring-offset-midnight-navy' : ''
        }`}
      >
        {isListening ? (
          <span className="relative flex h-6 w-6 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aqua-teal opacity-75" />
            <Mic size={22} className="relative z-10 text-white" />
          </span>
        ) : (
          <Mic size={24} className="text-white drop-shadow" />
        )}

        {/* Small floating AI badge */}
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pastel-lavender opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-aqua-teal text-[8px] font-bold text-midnight-navy items-center justify-center">
            ✦
          </span>
        </span>
      </button>
    </div>
  );
}
