import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Activity, TriviaGameState, TriviaSettings } from '../types';

interface UseTriviaGameProps {
  activity: Activity;
  roomId: string;
}

interface UseTriviaGameReturn {
  gameState: TriviaGameState;
  startTrivia: () => Promise<void>;
  endTrivia: () => Promise<void>;
  revealAnswer: () => Promise<void>;
  resetTrivia: () => void;
  updateSettings: (settings: Partial<TriviaSettings>) => Promise<void>;
  error: string | null;
  loading: boolean;
}

export const useTriviaGame = ({ activity, roomId }: UseTriviaGameProps): UseTriviaGameReturn => {
  const [gameState, setGameState] = useState<TriviaGameState>({
    isActive: false,
    timeRemaining: 0,
    phase: 'waiting',
    correctAnswerRevealed: false,
    participantScores: {}
  });
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const phaseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triviaSettings = activity.settings as TriviaSettings;
  const countdownDuration = triviaSettings?.countdown_duration || 30;
  const revealDelay = triviaSettings?.reveal_answer_delay || 3;

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (phaseTimeoutRef.current) {
        clearTimeout(phaseTimeoutRef.current);
      }
    };
  }, []);

  // Socket event listeners for trivia events
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel(`trivia_${activity.id}`)
      .on('broadcast', { event: 'trivia_started' }, (payload) => {
        setGameState(prev => ({
          ...prev,
          isActive: true,
          phase: 'countdown',
          startTime: Date.now(),
          endTime: Date.now() + (payload.payload.duration * 1000),
          timeRemaining: payload.payload.duration,
          correctAnswerRevealed: false
        }));
        
        // Start answering phase after a brief countdown
        setTimeout(() => {
          setGameState(prev => ({ ...prev, phase: 'answering' }));
        }, 3000);
      })
      .on('broadcast', { event: 'trivia_ended' }, (payload) => {
        setGameState(prev => ({
          ...prev,
          isActive: false,
          phase: 'revealing',
          timeRemaining: 0
        }));
        
        // Reveal answer after delay
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            correctAnswerRevealed: true,
            phase: 'completed'
          }));
        }, revealDelay * 1000);
      })
      .on('broadcast', { event: 'trivia_countdown' }, (payload) => {
        setGameState(prev => ({
          ...prev,
          timeRemaining: payload.payload.timeRemaining
        }));
      })
      .on('broadcast', { event: 'trivia_reset' }, () => {
        setGameState({
          isActive: false,
          timeRemaining: 0,
          phase: 'waiting',
          correctAnswerRevealed: false,
          participantScores: {}
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activity.id, revealDelay]);

  const startTrivia = useCallback(async () => {
    if (!supabase) {
      setError('Real-time features not available');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Update activity to active state
      const { error: updateError } = await supabase
        .from('activities')
        .update({ 
          is_active: true,
          settings: {
            ...activity.settings,
            trivia_active: true,
            started_at: new Date().toISOString()
          }
        })
        .eq('id', activity.id);

      if (updateError) throw updateError;

      // Broadcast trivia start event
      const { error: broadcastError } = await supabase.channel(`trivia_${activity.id}`)
        .send({
          type: 'broadcast',
          event: 'trivia_started',
          payload: { 
            activityId: activity.id,
            duration: countdownDuration 
          }
        });

      if (broadcastError) throw broadcastError;

      // Start countdown timer
      let timeLeft = countdownDuration;
      timerRef.current = setInterval(async () => {
        timeLeft--;
        
        // Broadcast countdown tick
        await supabase.channel(`trivia_${activity.id}`)
          .send({
            type: 'broadcast',
            event: 'trivia_countdown',
            payload: { 
              activityId: activity.id,
              timeRemaining: timeLeft 
            }
          });

        if (timeLeft <= 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          await endTrivia();
        }
      }, 1000);

    } catch (err) {
      console.error('Error starting trivia:', err);
      setError(err instanceof Error ? err.message : 'Failed to start trivia');
    } finally {
      setLoading(false);
    }
  }, [activity.id, activity.settings, countdownDuration]);

  const endTrivia = useCallback(async () => {
    if (!supabase) {
      setError('Real-time features not available');
      return;
    }

    try {
      setError(null);

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Update activity to inactive state
      const { error: updateError } = await supabase
        .from('activities')
        .update({ 
          is_active: false,
          settings: {
            ...activity.settings,
            trivia_active: false,
            ended_at: new Date().toISOString()
          }
        })
        .eq('id', activity.id);

      if (updateError) throw updateError;

      // Find correct answer
      const correctOption = activity.options?.find(opt => opt.is_correct);

      // Broadcast trivia end event
      const { error: broadcastError } = await supabase.channel(`trivia_${activity.id}`)
        .send({
          type: 'broadcast',
          event: 'trivia_ended',
          payload: { 
            activityId: activity.id,
            correctOptionId: correctOption?.id 
          }
        });

      if (broadcastError) throw broadcastError;

    } catch (err) {
      console.error('Error ending trivia:', err);
      setError(err instanceof Error ? err.message : 'Failed to end trivia');
    }
  }, [activity.id, activity.settings, activity.options]);

  const revealAnswer = useCallback(async () => {
    if (!supabase) {
      setError('Real-time features not available');
      return;
    }

    try {
      setError(null);

      // Broadcast answer reveal
      const { error: broadcastError } = await supabase.channel(`trivia_${activity.id}`)
        .send({
          type: 'broadcast',
          event: 'trivia_answer_revealed',
          payload: { 
            activityId: activity.id,
            correctOption: activity.options?.find(opt => opt.is_correct)
          }
        });

      if (broadcastError) throw broadcastError;

      setGameState(prev => ({
        ...prev,
        correctAnswerRevealed: true,
        phase: 'completed'
      }));

    } catch (err) {
      console.error('Error revealing answer:', err);
      setError(err instanceof Error ? err.message : 'Failed to reveal answer');
    }
  }, [activity.id, activity.options]);

  const resetTrivia = useCallback(() => {
    // Clear all timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (phaseTimeoutRef.current) {
      clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = null;
    }

    // Reset state
    setGameState({
      isActive: false,
      timeRemaining: 0,
      phase: 'waiting',
      correctAnswerRevealed: false,
      participantScores: {}
    });

    // Broadcast reset event
    if (supabase) {
      supabase.channel(`trivia_${activity.id}`)
        .send({
          type: 'broadcast',
          event: 'trivia_reset',
          payload: { activityId: activity.id }
        });
    }

    setError(null);
  }, [activity.id]);

  const updateSettings = useCallback(async (newSettings: Partial<TriviaSettings>) => {
    if (!supabase) {
      setError('Real-time features not available');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const updatedSettings = {
        ...activity.settings,
        ...newSettings
      };

      const { error: updateError } = await supabase
        .from('activities')
        .update({ settings: updatedSettings })
        .eq('id', activity.id);

      if (updateError) throw updateError;

    } catch (err) {
      console.error('Error updating trivia settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  }, [activity.id, activity.settings]);

  return {
    gameState,
    startTrivia,
    endTrivia,
    revealAnswer,
    resetTrivia,
    updateSettings,
    error,
    loading
  };
};