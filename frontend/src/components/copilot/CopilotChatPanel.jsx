import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Send,
  X,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { useCopilot } from '../../context/CopilotContext';
import VoiceWaveform from './VoiceWaveform';
import GlassButton from '../common/GlassButton';
import GlassBadge from '../common/GlassBadge';

export default function CopilotChatPanel() {
  const {
    isOpen,
    setIsOpen,
    isListening,
    transcript,
    messages,
    isProcessing,
    pendingAction,
    toggleVoiceListening,
    stopVoiceListeningAndSend,
    processCommand,
    confirmPendingAction,
    cancelPendingAction,
  } = useCopilot();

  const [input, setInput] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, transcript]);

  const handleSend = (e) => {
    e.preventDefault();
    if (input.trim()) {
      processCommand(input);
      setInput('');
    }
  };

  const samplePrompts = [
    'I spent ₹150 on lunch',
    'I ate 100g Pintola oats with milk',
    'Bench press 40kg 3 sets of 12',
    'Drank 500 ml water',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] md:w-[460px] flex flex-col glass-sidebar shadow-glass-lg border-l border-white/20 text-white animate-fade-in">
      {/* Copilot Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-midnight-navy/70 backdrop-blur-deep">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-royal-navy via-electric-blue to-aqua-teal flex items-center justify-center shadow-aqua-glow">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-white">TrackItOut Copilot</h3>
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[11px] text-pastel-blue">Personal Intelligence Assistant</p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(false)}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition"
          aria-label="Close Copilot Panel"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
              {msg.sender === 'user' ? (
                <>
                  <span>You</span>
                  <User size={12} />
                </>
              ) : (
                <>
                  <Bot size={12} className="text-aqua-teal" />
                  <span>Copilot</span>
                </>
              )}
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-electric-blue text-white rounded-tr-none shadow-md'
                  : 'bg-white/10 backdrop-blur-md text-slate-100 border border-white/15 rounded-tl-none shadow-sm'
              }`}
            >
              {msg.text}
            </div>

            {/* If message has an action card, render glass confirmation card */}
            {msg.action && (
              <div className="mt-2.5 w-full max-w-[90%] bg-gradient-to-br from-royal-navy/80 to-midnight-navy/90 border border-aqua-teal/40 rounded-2xl p-3.5 shadow-aqua-glow backdrop-blur-md">
                <div className="flex items-center justify-between mb-2">
                  <GlassBadge variant="aqua" size="sm">
                    {msg.action.module}
                  </GlassBadge>
                  <span className="text-xs text-aqua-teal font-semibold">
                    {msg.action.type}
                  </span>
                </div>

                {msg.action.module === 'Finance' && (
                  <div className="text-xs text-slate-200 space-y-1 mb-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Amount:</span>
                      <span className="font-bold text-emerald-300">₹{msg.action.amount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Category:</span>
                      <span>{msg.action.category}</span>
                    </div>
                  </div>
                )}

                {msg.action.module === 'Nutrition' && (
                  <div className="text-xs text-slate-200 space-y-1 mb-3">
                    <div className="font-semibold text-white">
                      {msg.action.productName || (msg.action.type === 'Water' ? `Water Intake: ${msg.action.water_ml} ml` : 'Meal')}
                    </div>
                    {msg.action.type !== 'Water' && (
                      <div className="grid grid-cols-4 gap-1.5 text-center mt-2 text-[10px]">
                        <div className="bg-white/10 p-1.5 rounded-lg">
                          <div className="text-electric-blue font-bold">{msg.action.calories || '—'}</div>
                          <div className="text-slate-400">kcal</div>
                        </div>
                        <div className="bg-white/10 p-1.5 rounded-lg">
                          <div className="text-aqua-teal font-bold">{msg.action.protein || '—'}g</div>
                          <div className="text-slate-400">Protein</div>
                        </div>
                        <div className="bg-white/10 p-1.5 rounded-lg">
                          <div className="text-pastel-lavender font-bold">{msg.action.carbs || '—'}g</div>
                          <div className="text-slate-400">Carbs</div>
                        </div>
                        <div className="bg-white/10 p-1.5 rounded-lg">
                          <div className="text-amber-400 font-bold">{msg.action.fats || '—'}g</div>
                          <div className="text-slate-400">Fats</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {msg.action.module === 'Fitness' && (
                  <div className="text-xs text-slate-200 mb-3 space-y-1">
                    <div className="font-semibold text-white">
                      {msg.action.title || msg.action.exercise_name || msg.action.exercise}
                    </div>
                    {msg.action.type === 'Confirmed 1RM' && (
                      <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[11px] font-semibold flex items-center gap-1.5 mt-1.5">
                        <span>⚠️ Official Personal Record Confirmation</span>
                      </div>
                    )}
                    {msg.action.weight_kg && (
                      <div className="text-slate-300 mt-1">
                        {msg.action.sets_count ? `${msg.action.sets_count} sets × ` : ''}
                        {msg.action.reps} reps @ <span className="font-bold text-aqua-teal">{msg.action.weight_kg} kg</span>
                      </div>
                    )}
                    {msg.action.duration_minutes && (
                      <div className="text-slate-300">
                        Duration: {msg.action.duration_minutes} mins {msg.action.incline_pct ? `(${msg.action.incline_pct}% incline @ ${msg.action.speed_kmh} km/h)` : ''}
                      </div>
                    )}
                    {msg.action.newDate && (
                      <div className="text-slate-300">
                        Reschedule to: <span className="font-semibold text-aqua-teal">{msg.action.newDate}</span>
                      </div>
                    )}
                  </div>
                )}

                {msg.action.module === 'Habits' && (
                  <div className="text-xs text-slate-200 mb-3">
                    <div className="font-semibold text-white">{msg.action.habitName}</div>
                    <div className="text-emerald-400 text-[11px] mt-1">
                      ✓ Streak updated for today
                    </div>
                  </div>
                )}

                {/* Confirm/Cancel actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                  <button
                    onClick={() => confirmPendingAction(msg.action)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-midnight-navy font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <CheckCircle2 size={14} />
                    <span>Confirm & Save</span>
                  </button>
                  <button
                    onClick={cancelPendingAction}
                    className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isListening && <VoiceWaveform isListening={isListening} />}

        {transcript && (
          <div className="p-3 bg-white/10 border border-aqua-teal/50 rounded-2xl text-xs text-aqua-teal animate-pulse">
            <span className="font-semibold text-white">Transcribing: </span>
            "{transcript}"
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-electric-blue animate-ping" />
            <span>Analyzing intent and preparing action...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Suggested prompts */}
      <div className="px-4 py-2 border-t border-white/10 bg-midnight-navy/40">
        <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-slate-400">
          <HelpCircle size={12} />
          <span>Quick Commands:</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => processCommand(p)}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar with Voice Button */}
      <form
        onSubmit={handleSend}
        className="p-4 border-t border-white/10 bg-midnight-navy/90 backdrop-blur-md flex items-center gap-2"
      >
        <button
          type="button"
          onClick={toggleVoiceListening}
          className={`p-2.5 rounded-xl transition ${
            isListening
              ? 'bg-aqua-teal text-midnight-navy shadow-aqua-glow'
              : 'bg-white/10 text-slate-300 hover:text-white hover:bg-white/20'
          }`}
          title={isListening ? 'Stop listening' : 'Start voice input'}
        >
          <Mic size={18} className={isListening ? 'animate-pulse' : ''} />
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? 'Listening to speech...' : 'Type a command or question...'}
          className="flex-1 py-2 px-3.5 bg-white/10 border border-white/15 rounded-xl text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-electric-blue focus:ring-2 focus:ring-electric-blue/30"
        />

        <button
          type="submit"
          disabled={!input.trim()}
          className="p-2.5 rounded-xl bg-electric-blue text-white hover:bg-royal-navy disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
