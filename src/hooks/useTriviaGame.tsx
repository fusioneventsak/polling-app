import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Listen to custom events from global subscription instead of creating new subscriptions
  useEffect(() => {
    if (!activity?.id) return;

    console.log('🎮 TriviaGame: Setting up event listeners for activity:', activity.id);

    const handleActivityUpdate = (event: CustomEvent<{ activityId: string; roomId: string; isActive?: boolean }>) => {
      if (event.detail.activityId === activity.id) {
        console.log('🎯 TriviaGame: Activity update received:', event.detail);
        
        if (event.detail.isActive === true) {
          // Activity started
          setGameState(prev => ({
            ...prev,
            isActive: true,
            phase: 'countdown',
            startTime: Date.now(),
            endTime: Date.now() + (countdownDuration * 1000),
            timeRemaining: countdownDuration,
            correctAnswerRevealed: false
          }));
          
          // Start answering phase after a brief countdown
          setTimeout(() => {
            setGameState(prev => ({ ...prev, phase: 'answering' }));
          }, 3000);
          
        } else if (event.detail.isActive === false) {
          // Activity ended
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
        }
      }
    };

    const handleRoomUpdate = (event: CustomEvent<{ roomId: string; roomCode?: string }>) => {
      if (event.detail.roomId === roomId) {
        console.log('🏠 TriviaGame: Room reset detected');
        // Room was reset - reset trivia state
        setGameState({
          isActive: false,
          timeRemaining: 0,
          phase: 'waiting',
          correctAnswerRevealed: false,
          participantScores: {}
        });
      }
    };

    // Add event listeners
    window.addEventListener('activity-updated', handleActivityUpdate);
    window.addEventListener('room-updated', handleRoomUpdate);

    return () => {
      console.log('🧹 TriviaGame: Cleaning up event listeners');
      window.removeEventListener('activity-updated', handleActivityUpdate);
      window.removeEventListener('room-updated', handleRoomUpdate);
    };
  }, [activity?.id, roomId, countdownDuration, revealDelay]);

  const startTrivia = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🎮 TriviaGame: Starting trivia (this should be handled by admin controls)');
      // Note: Actual trivia starting should be handled by the admin controls
      // This hook just manages the local game state based on activity updates

      // Start countdown timer
      let timeLeft = countdownDuration;
      timerRef.current = setInterval(async () => {
        timeLeft--;
        
        setGameState(prev => ({
          ...prev,
          timeRemaining: timeLeft
        }));

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
    try {
      setError(null);

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      console.log('🎮 TriviaGame: Ending trivia (this should be handled by admin controls)');
      // Note: Actual trivia ending should be handled by the admin controls

    } catch (err) {
      console.error('Error ending trivia:', err);
      setError(err instanceof Error ? err.message : 'Failed to end trivia');
    }
  }, [activity.id, activity.settings, activity.options]);

  const revealAnswer = useCallback(async () => {
    try {
      setError(null);

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

    setError(null);
  }, [activity.id]);

  const updateSettings = useCallback(async (newSettings: Partial<TriviaSettings>) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🎮 TriviaGame: Updating settings (this should be handled by admin controls)');
      // Note: Settings updates should be handled by the admin controls

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