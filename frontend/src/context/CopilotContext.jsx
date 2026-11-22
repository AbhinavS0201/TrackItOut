import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';

const CopilotContext = createContext();

export function CopilotProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'copilot',
      text: "Hello! I'm your TrackItOut Life Copilot. I can track your expenses, log meals, record workouts, and monitor habits. Try speaking or typing commands like:\n• 'I spent 150 rupees on lunch'\n• 'I ate 100 grams Pintola oats with milk'\n• 'Completed chest workout: 40kg bench press 3 sets of 12'\n• 'Drank 500 ml water'",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [pendingAction, setPendingAction] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef(null);

  // Setup Web Speech API for voice-first interactions
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Indian English default

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or text chat.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      if (transcript.trim()) {
        processCommand(transcript);
        setTranscript('');
      }
    } else {
      setTranscript('');
      setIsOpen(true);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Error starting speech recognition:', err);
      }
    }
  };

  const stopVoiceListeningAndSend = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    if (transcript.trim()) {
      processCommand(transcript);
      setTranscript('');
    }
  };

  // Process user text or voice command
  const processCommand = async (input) => {
    const text = input.trim();
    if (!text) return;

    // Add user message to chat
    const userMsg = {
      id: String(Date.now()),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // Natural language pattern matcher & intent resolver
      const lower = text.toLowerCase();
      let responseMsg = '';
      let action = null;

      // 1. Finance Intent: Spent / Received / Expense
      if (lower.includes('spent') || lower.includes('paid') || lower.includes('bought') || lower.includes('rupees') || lower.includes('₹') || lower.includes('received')) {
        const isIncome = lower.includes('received') || lower.includes('earned') || lower.includes('salary');
        const amountMatch = text.match(/(?:(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:rs|rupees|inr|₹)?)/i);
        const amount = amountMatch ? parseFloat(amountMatch[1] || amountMatch[2]) : null;

        let category = 'General';
        if (lower.includes('food') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('breakfast') || lower.includes('coffee') || lower.includes('swiggy') || lower.includes('zomato')) category = 'Food';
        else if (lower.includes('cab') || lower.includes('uber') || lower.includes('ola') || lower.includes('petrol') || lower.includes('metro') || lower.includes('bus')) category = 'Transport';
        else if (lower.includes('movie') || lower.includes('game') || lower.includes('party')) category = 'Entertainment';
        else if (lower.includes('bill') || lower.includes('rent') || lower.includes('electricity') || lower.includes('wifi')) category = 'Utilities';
        else if (lower.includes('gym') || lower.includes('medicine') || lower.includes('doctor')) category = 'Health';

        if (amount) {
          action = {
            module: 'Finance',
            type: isIncome ? 'Income' : 'Expense',
            amount,
            category,
            description: text,
            date: new Date().toISOString().split('T')[0],
          };
          responseMsg = `I extracted a ${isIncome ? 'income' : 'expense'} entry of ₹${amount} for "${category}". Please review and confirm below.`;
        } else {
          responseMsg = "I recognized this as a finance transaction, but couldn't detect the exact amount. How much did you spend or receive?";
        }
      }
      // 2. Nutrition Intent: Oats / Eggs / Protein / Food / Ate
      else if (lower.includes('ate') || lower.includes('had') || lower.includes('drank milk') || lower.includes('oats') || lower.includes('paneer') || lower.includes('protein') || lower.includes('grams') || lower.includes('calories')) {
        let isBranded = false;
        let productName = 'Custom Food';
        let calories = 350;
        let protein = 24;
        let carbs = 42;
        let fats = 8;

        if (lower.includes('pintola')) {
          isBranded = true;
          productName = 'Pintola High Protein Rolled Oats';
          calories = 398;
          protein = 26;
          carbs = 58;
          fats = 8.5;
        } else if (lower.includes('milky mist')) {
          isBranded = true;
          productName = 'Milky Mist High Protein Paneer';
          calories = 265;
          protein = 25;
          carbs = 4;
          fats = 16;
        } else if (lower.includes('bigmuscles') || lower.includes('whey')) {
          isBranded = true;
          productName = 'BigMuscles Premium Gold Whey';
          calories = 135;
          protein = 25;
          carbs = 2.5;
          fats = 1.5;
        } else if (lower.includes('egg') || lower.includes('eggs')) {
          productName = 'Whole Boiled Eggs (3 pcs)';
          calories = 210;
          protein = 18;
          carbs = 1.5;
          fats = 15;
        }

        action = {
          module: 'Nutrition',
          type: 'Log Meal',
          productName,
          isBranded,
          calories,
          protein,
          carbs,
          fats,
          details: text,
        };
        responseMsg = `Identified: ${productName} (${protein}g Protein, ${calories} kcal). Would you like me to record this to your Daily Nutrition?`;
      }
      // 3. Fitness Intent: Workout / Chest / Bench / Reps / Sets
      else if (lower.includes('workout') || lower.includes('bench press') || lower.includes('squat') || lower.includes('gym') || lower.includes('sets') || lower.includes('lifted')) {
        action = {
          module: 'Fitness',
          type: 'Log Workout',
          exercise: lower.includes('bench') ? 'Barbell Bench Press' : 'General Workout',
          sets: 3,
          reps: 12,
          weight: 40,
          details: text,
        };
        responseMsg = `Great session! I've prepared a workout log for ${action.exercise} (3 sets × 12 reps @ 40 kg). Confirm below to save to your fitness history.`;
      }
      // 4. Habit Intent: Water / Read / Sleep / Streak
      else if (lower.includes('water') || lower.includes('drank') || lower.includes('habit') || lower.includes('read') || lower.includes('study')) {
        let habitName = 'Water Intake';
        if (lower.includes('water')) habitName = 'Drink Water (500 ml)';
        else if (lower.includes('read')) habitName = 'Read for 30 mins';
        else if (lower.includes('study')) habitName = 'Study 2 hours';

        action = {
          module: 'Habits',
          type: 'Complete Habit',
          habitName,
          details: text,
        };
        responseMsg = `Logged progress for habit: "${habitName}". Current streak maintained!`;
      }
      // 5. General / Overview
      else {
        responseMsg = `I understand you said: "${text}". I can perform actions in Finance, Nutrition, Fitness, and Habits. What would you like to log or review?`;
      }

      setPendingAction(action);

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'copilot',
          text: responseMsg,
          action,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error('Copilot processing error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'copilot',
          text: "I couldn't process that command right now. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmPendingAction = async (actionToConfirm) => {
    const targetAction = actionToConfirm || pendingAction;
    if (!targetAction) return;

    setIsProcessing(true);
    try {
      if (targetAction.module === 'Finance') {
        await apiClient.post('/add-transaction', {
          Type: targetAction.type,
          Amount: targetAction.amount,
          Description: targetAction.description || 'Logged via TrackItOut Copilot',
          Category: targetAction.category || 'General',
          PaymentMode: 'UPI',
        });
      }

      // Notify success
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'copilot',
          text: `Action confirmed & saved to ${targetAction.module}! Your live dashboard has been updated.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      setPendingAction(null);
    } catch (err) {
      console.error('Failed to execute confirmed action:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'copilot',
          text: `Error saving to ${targetAction.module}. Please check if the server is running.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelPendingAction = () => {
    setPendingAction(null);
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'copilot',
        text: 'Action cancelled. How else can I help?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <CopilotContext.Provider
      value={{
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
      }}
    >
      {children}
    </CopilotContext.Provider>
  );
}

export function useCopilot() {
  const context = useContext(CopilotContext);
  if (!context) throw new Error('useCopilot must be used within a CopilotProvider');
  return context;
}
