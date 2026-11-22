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
      text: "Hello! I'm your TrackItOut Life Copilot. I can track your expenses, log meals, record workouts, and monitor habits. Try speaking or typing commands like:\n• 'I spent 150 rupees on lunch'\n• 'I ate 150g roasted chicken'\n• 'I had 100g Pintola oats'\n• 'Drank 500 ml water'",
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

  // Determine current meal type from time of day
  const getInferredMealType = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Breakfast';
    if (hour < 16) return 'Lunch';
    if (hour < 19) return 'Snacks';
    return 'Dinner';
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
      const lower = text.toLowerCase();
      let responseMsg = '';
      let action = null;

      // 1. Water Tracking Intent
      if (lower.includes('water') && (lower.includes('drank') || lower.includes('had') || lower.includes('log') || lower.includes('drink') || lower.includes('consumed') || lower.includes('ml') || lower.includes('liter') || lower.includes('litre'))) {
        let ml = 250;
        const mlMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:ml|milliliter|millilitre|milliliters|millilitres)\b/i);
        const lMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:l|liter|litre|liters|litres)\b/i);
        const bareNumMatch = text.match(/\b(\d+)\b/);

        if (mlMatch) {
          ml = parseInt(mlMatch[1], 10);
        } else if (lMatch) {
          ml = Math.round(parseFloat(lMatch[1]) * 1000);
        } else if (bareNumMatch) {
          ml = parseInt(bareNumMatch[1], 10);
        }

        action = {
          module: 'Nutrition',
          type: 'Water',
          water_ml: ml,
          description: text,
          date: new Date().toISOString().split('T')[0],
        };
        responseMsg = `I extracted a hydration entry of ${ml} ml. Please review and confirm to log this to your daily water intake.`;
      }
      // 2. Finance Intent: Spent / Received / Expense
      else if (lower.includes('spent') || lower.includes('paid') || lower.includes('bought') || lower.includes('rupees') || lower.includes('₹') || lower.includes('received')) {
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
      // 3. Nutrition Meal Intent: Ate / Had / Food / Chicken / Oats / Paneer / Whey
      else if (lower.includes('ate') || lower.includes('had') || lower.includes('eaten') || lower.includes('oats') || lower.includes('chicken') || lower.includes('paneer') || lower.includes('whey') || lower.includes('egg') || lower.includes('lassi') || lower.includes('meal')) {
        let mealType = getInferredMealType();
        if (lower.includes('breakfast')) mealType = 'Breakfast';
        else if (lower.includes('lunch')) mealType = 'Lunch';
        else if (lower.includes('dinner')) mealType = 'Dinner';
        else if (lower.includes('snack') || lower.includes('snacks')) mealType = 'Snacks';

        // Extract quantity and unit
        let quantity = 100;
        let unit = 'g';
        const qtyMatch = text.match(/(\d+(?:\.\d+)?)\s*(g|grams?|ml|milliliters?|millilitres?|scoops?|servings?|pieces?|pcs?|packs?)\b/i);
        if (qtyMatch) {
          quantity = parseFloat(qtyMatch[1]);
          const rawUnit = qtyMatch[2].toLowerCase();
          if (rawUnit.startsWith('gram') || rawUnit === 'g') unit = 'g';
          else if (rawUnit.startsWith('ml') || rawUnit.startsWith('milli')) unit = 'ml';
          else if (rawUnit.startsWith('scoop')) unit = 'scoop';
          else if (rawUnit.startsWith('pack')) unit = 'pack';
          else if (rawUnit.startsWith('piece') || rawUnit === 'pcs') unit = 'serving';
          else unit = 'serving';
        }

        // Match against catalog
        let productName = 'Custom Food';
        let brand = 'Generic';
        let foodProductId = null;
        let calories = 250;
        let protein = 20;
        let carbs = 25;
        let fats = 6;
        let isVerified = false;

        if (lower.includes('chicken')) {
          brand = 'Generic';
          productName = 'Chicken Breast (Roasted)';
          if (lower.includes('grilled')) productName = 'Chicken Breast (Grilled)';
          else if (lower.includes('raw')) productName = 'Chicken Breast (Raw)';
          else if (lower.includes('stewed') || lower.includes('boiled')) productName = 'Chicken Breast (Stewed)';

          // Roasted chicken per 100g: 165 kcal, 31.02g protein, 3.57g fat
          const factor = (unit === 'g' ? quantity : 100) / 100;
          calories = parseFloat((165 * factor).toFixed(2));
          protein = parseFloat((31.02 * factor).toFixed(2));
          carbs = 0;
          fats = parseFloat((3.57 * factor).toFixed(2));
          isVerified = true;
        } else if (lower.includes('pintola') || lower.includes('oat')) {
          brand = 'Pintola';
          productName = 'High Protein Rolled Oats';
          const factor = (unit === 'g' ? quantity : 40) / 100;
          calories = parseFloat((392 * factor).toFixed(2));
          protein = parseFloat((25 * factor).toFixed(2));
          carbs = parseFloat((54.6 * factor).toFixed(2));
          fats = parseFloat((7.8 * factor).toFixed(2));
        } else if (lower.includes('whey') || lower.includes('bigmuscles')) {
          brand = 'BigMuscles Nutrition';
          productName = 'Premium Gold Whey Protein';
          unit = 'scoop';
          if (!qtyMatch) quantity = 1;
          calories = parseFloat((136.2 * quantity).toFixed(2));
          protein = parseFloat((25.0 * quantity).toFixed(2));
          carbs = parseFloat((5.0 * quantity).toFixed(2));
          fats = parseFloat((1.8 * quantity).toFixed(2));
          isVerified = true;
        } else if (lower.includes('paneer') || lower.includes('milky mist')) {
          brand = 'Milky Mist';
          productName = 'High Protein Low Fat Paneer';
          const factor = (unit === 'g' ? quantity : 100) / 100;
          calories = parseFloat((190 * factor).toFixed(2));
          protein = parseFloat((25.0 * factor).toFixed(2));
          carbs = parseFloat((5.7 * factor).toFixed(2));
          fats = parseFloat((7.0 * factor).toFixed(2));
        } else if (lower.includes('lassi') || lower.includes('amul')) {
          brand = 'Amul';
          productName = 'High Protein Lassi (Rose)';
          unit = 'ml';
          if (!qtyMatch) quantity = 200;
          const factor = quantity / 100;
          calories = parseFloat((53.5 * factor).toFixed(2));
          protein = parseFloat((7.5 * factor).toFixed(2));
          carbs = parseFloat((6.0 * factor).toFixed(2));
          fats = parseFloat((0.85 * factor).toFixed(2));
        } else if (lower.includes('egg') || lower.includes('eggs')) {
          brand = 'Generic';
          productName = 'Boiled Eggs';
          unit = 'serving';
          const count = qtyMatch ? quantity : 2;
          quantity = count;
          calories = count * 78;
          protein = count * 6.3;
          carbs = count * 0.6;
          fats = count * 5.3;
        }

        action = {
          module: 'Nutrition',
          type: 'Meal',
          meal_type: mealType,
          food_product_id: foodProductId,
          productName,
          brand,
          quantity,
          unit,
          calories,
          protein,
          carbs,
          fats,
          isVerified,
          description: text,
          date: new Date().toISOString().split('T')[0],
        };
        responseMsg = `Identified: ${quantity} ${unit} of ${productName} (${protein}g Protein, ${calories} kcal). Confirm below to log this to ${mealType}.`;
      }
      // 4. Fitness Intent: Workout / Bench / Squat / Cardio / Treadmill / Rotation / Reschedule
      else if (
        lower.includes('workout') || lower.includes('bench press') || lower.includes('squat') ||
        lower.includes('gym') || lower.includes('treadmill') || lower.includes('chest') ||
        lower.includes('cardio') || lower.includes('rotation') || lower.includes('postpone') ||
        lower.includes('reschedule') || lower.includes('1rm') || lower.includes('max')
      ) {
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        // 4A. Query current workout rotation
        if (lower.includes('rotation') || lower.includes('split') || (lower.includes('what') && lower.includes('next'))) {
          try {
            const rotRes = await apiClient.get('/api/v1/fitness/rotation');
            const rotData = rotRes.data.data;
            if (rotData) {
              const currentRoutine = rotData.current_template_name || `Routine ${rotData.current_position}`;
              responseMsg = `🏋️ Your current rotation position is **${currentRoutine}**.\nSequence: A (Chest+Shoulders+Abs) → B (Back+Abs) → C (Biceps+Triceps+Forearms) → D (Legs).\n\nWould you like me to start your **${currentRoutine}** workout?`;
              action = {
                module: 'Fitness',
                type: 'Start Workout',
                routine_code: rotData.current_position,
                template_id: rotData.current_template_id || 1,
                title: currentRoutine,
                planned_date: todayStr,
                advances_rotation: 1
              };
            } else {
              responseMsg = `Your rotation state is not yet initialized. Head to the Fitness page to view your split routines.`;
            }
          } catch (e) {
            responseMsg = `You are on the standard A/B/C/D rotation split. Today's target is Routine A (Chest + Shoulders + Abs).`;
          }
        }
        // 4B. Postpone / Reschedule Workout
        else if (lower.includes('postpone') || lower.includes('reschedule') || lower.includes('tomorrow')) {
          action = {
            module: 'Fitness',
            type: 'Reschedule',
            title: 'Reschedule Today’s Workout to Tomorrow',
            newDate: tomorrowStr,
            description: `Postpone workout from ${todayStr} to ${tomorrowStr}`
          };
          responseMsg = `I can reschedule your active workout to tomorrow (${tomorrowStr}). Your rotation position will be preserved. Confirm below:`;
        }
        // 4C. Treadmill Cardio Intent
        else if (lower.includes('treadmill') || lower.includes('walk') || (lower.includes('cardio') && (lower.includes('min') || lower.includes('walk')))) {
          let minutes = 20;
          const minMatch = text.match(/(\d+)\s*(?:min|mins|minutes)\b/i);
          if (minMatch) minutes = parseInt(minMatch[1], 10);

          action = {
            module: 'Fitness',
            type: 'Log Cardio',
            exercise_name: 'Treadmill Incline Walking',
            exercise_id: 41, // seed_ex_treadmill_incline_walk
            duration_minutes: minutes,
            speed_kmh: 3.5,
            incline_pct: 8.0,
            date: todayStr
          };
          responseMsg = `🏃 Great aerobic fat oxidation! I've prepared a ${minutes}-minute Treadmill Incline Walk log (3.5 km/h, 8% incline). Confirm below to record to your daily activity:`;
        }
        // 4D. Start Chest / Routine Workout
        else if (lower.includes('start') && (lower.includes('chest') || lower.includes('workout') || lower.includes('routine') || lower.includes('leg') || lower.includes('back'))) {
          let code = 'A';
          let title = 'Workout A: Chest + Shoulders + Abs';
          let tmplId = 1;
          if (lower.includes('back')) { code = 'B'; title = 'Workout B: Back + Abs'; tmplId = 2; }
          else if (lower.includes('bicep') || lower.includes('tricep') || lower.includes('arm')) { code = 'C'; title = 'Workout C: Biceps + Triceps + Forearms'; tmplId = 3; }
          else if (lower.includes('leg')) { code = 'D'; title = 'Workout D: Legs'; tmplId = 4; }

          action = {
            module: 'Fitness',
            type: 'Start Workout',
            routine_code: code,
            template_id: tmplId,
            title,
            planned_date: todayStr,
            advances_rotation: 1
          };
          responseMsg = `💪 Ready to train! I have initialized **${title}**. Confirm below to activate today's workout session:`;
        }
        // 4E. Strength Sets Logging (e.g. "I completed 3 sets of bench press at 40 kg")
        else {
          let exerciseName = 'Flat Bench Press';
          let exerciseId = 2;
          if (lower.includes('squat')) { exerciseName = 'Squats'; exerciseId = 40; }
          else if (lower.includes('row')) { exerciseName = 'Bent-Over Barbell Rows'; exerciseId = 18; }
          else if (lower.includes('lateral')) { exerciseName = 'Dumbbell Lateral Raises'; exerciseId = 7; }
          else if (lower.includes('curl')) { exerciseName = 'Preacher Curls'; exerciseId = 24; }
          else if (lower.includes('leg press')) { exerciseName = 'Leg Press'; exerciseId = 35; }

          let weight = 40;
          let reps = 12;
          let setsCount = 3;

          const weightMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos)\b/i);
          if (weightMatch) weight = parseFloat(weightMatch[1]);

          const repsMatch = text.match(/(\d+)\s*(?:reps?|repetitions?)\b/i);
          if (repsMatch) reps = parseInt(repsMatch[1], 10);

          const setsMatch = text.match(/(\d+)\s*sets?\b/i);
          if (setsMatch) setsCount = parseInt(setsMatch[1], 10);

          const isOneRepMax = reps === 1 || lower.includes('1rm') || lower.includes('one rep max') || lower.includes('1 rep max');

          action = {
            module: 'Fitness',
            type: isOneRepMax ? 'Confirmed 1RM' : 'Log Workout',
            exercise_name: exerciseName,
            exercise_id: exerciseId,
            sets_count: setsCount,
            reps,
            weight_kg: weight,
            is_confirmed_1rm: isOneRepMax ? 1 : 0,
            date: todayStr
          };

          if (isOneRepMax) {
            responseMsg = `⚠️ **Confirmed 1RM Verification**: You are about to record a confirmed single-repetition maximum of **${weight} kg** on **${exerciseName}**. Please verify and confirm below to update your official Personal Records:`;
          } else {
            responseMsg = `Great work! I parsed: **${setsCount} sets × ${reps} reps @ ${weight} kg** on **${exerciseName}**. Confirm below to save to your workout history:`;
          }
        }
      }
      // 5. Default Fallback
      else {
        responseMsg = `I understand you said: "${text}". You can ask me to log expenses (e.g. 'spent 150 on coffee'), meals (e.g. 'ate 200g roasted chicken'), or hydration (e.g. 'drank 500 ml water').`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'copilot',
          text: responseMsg,
          action: action || null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      if (action) {
        setPendingAction(action);
      }
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
      } else if (targetAction.module === 'Nutrition') {
        if (targetAction.type === 'Water') {
          await apiClient.post('/api/v1/nutrition/water', {
            date: targetAction.date,
            water_ml: targetAction.water_ml,
          });
        } else if (targetAction.type === 'Meal') {
          await apiClient.post('/api/v1/nutrition/meals', {
            date: targetAction.date,
            meal_type: targetAction.meal_type || 'Snacks',
            items: [
              {
                food_product_id: targetAction.food_product_id || null,
                product_name: targetAction.productName,
                brand_name: targetAction.brand || 'Generic',
                logged_quantity: targetAction.quantity,
                logged_unit: targetAction.unit,
                calories: targetAction.calories,
                protein: targetAction.protein,
                carbohydrates: targetAction.carbs,
                fats: targetAction.fats,
              },
            ],
            notes: targetAction.description || 'Logged via TrackItOut Copilot',
          });
        }
        // Broadcast custom event so NutritionPage automatically refreshes live
        window.dispatchEvent(new Event('nutrition-updated'));
      } else if (targetAction.module === 'Fitness') {
        if (targetAction.type === 'Start Workout') {
          await apiClient.post('/api/v1/fitness/sessions', {
            template_id: targetAction.template_id,
            rotation_code: targetAction.routine_code,
            title: targetAction.title,
            planned_date: targetAction.planned_date,
            status: 'planned',
            advances_rotation: targetAction.advances_rotation || 1
          });
        } else if (targetAction.type === 'Reschedule') {
          const overviewRes = await apiClient.get('/api/v1/fitness/overview');
          const todaySessions = overviewRes.data?.data?.sessions || [];
          if (todaySessions.length > 0) {
            await apiClient.post(`/api/v1/fitness/sessions/${todaySessions[0].id}/reschedule`, {
              newDate: targetAction.newDate
            });
          } else {
            const rotRes = await apiClient.get('/api/v1/fitness/rotation');
            const rot = rotRes.data?.data;
            await apiClient.post('/api/v1/fitness/sessions', {
              rotation_code: rot?.current_position || 'A',
              title: rot?.current_template_name || 'Workout A: Chest + Shoulders + Abs',
              planned_date: targetAction.newDate,
              status: 'planned',
              advances_rotation: 1
            });
          }
        } else if (targetAction.type === 'Log Cardio') {
          await apiClient.post('/api/v1/fitness/sessions', {
            title: targetAction.exercise_name,
            planned_date: targetAction.date,
            actual_date: targetAction.date,
            status: 'completed',
            duration_minutes: targetAction.duration_minutes,
            advances_rotation: 0,
            sets: [
              {
                exercise_id: targetAction.exercise_id,
                duration_seconds: targetAction.duration_minutes * 60,
                speed_kmh: targetAction.speed_kmh,
                incline_pct: targetAction.incline_pct
              }
            ]
          });
        } else if (targetAction.type === 'Confirmed 1RM' || targetAction.type === 'Log Workout') {
          const setsPayload = [];
          const count = targetAction.sets_count || 1;
          for (let s = 1; s <= count; s++) {
            setsPayload.push({
              exercise_id: targetAction.exercise_id,
              weight_kg: targetAction.weight_kg,
              reps: targetAction.reps,
              set_type: 'normal',
              is_confirmed_1rm: targetAction.is_confirmed_1rm ? 1 : 0
            });
          }

          await apiClient.post('/api/v1/fitness/sessions', {
            title: `${targetAction.exercise_name} Session`,
            planned_date: targetAction.date,
            actual_date: targetAction.date,
            status: 'completed',
            duration_minutes: 45,
            advances_rotation: 0,
            sets: setsPayload
          });
        }
        // Broadcast custom event so FitnessPage automatically refreshes live
        window.dispatchEvent(new Event('fitness-updated'));
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
