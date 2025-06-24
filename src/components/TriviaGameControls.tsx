import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, RotateCcw, Eye, Settings, Users, Timer, Trophy, Zap } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { useTriviaGame } from '../hooks/useTriviaGame';
import type { Activity, TriviaGameState } from '../types';

interface TriviaGameControlsProps {
  activity: Activity;
  roomId: string;
  participantCount: number;
  onSettingsClick?: () => void;
}

export const TriviaGameControls: React.FC<TriviaGameControlsProps> = ({
  activity,
  roomId,
  participantCount,
  onSettingsClick
}) => {
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  
  const {
    gameState,
    startTrivia,
    endTrivia,
    revealAnswer,
    resetTrivia,
    error,
    loading
  } = useTriviaGame({ activity, roomId });

  const triviaSettings = activity.settings || {};
  const countdownDuration = triviaSettings.countdown_duration || 30;
  const pointsPerCorrect = triviaSettings.points_per_correct || 10;

  const handleAction = async (action: string, confirmMessage?: string) => {
    if (confirmMessage) {
      setShowConfirm(action);
      return;
    }

    try {
      switch (action) {
        case 'start':
          await startTrivia();
          break;
        case 'end':
          await endTrivia();
          break;
        case 'reveal':
          await revealAnswer();
          break;
        case 'reset':
          resetTrivia();
          break;
      }
      setShowConfirm(null);
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  const getPhaseDisplay = (phase: TriviaGameState['phase']) => {
    switch (phase) {
      case 'waiting':
        return { text: 'Ready to Start', color: 'text-slate-400', bg: 'bg-slate-600' };
      case 'countdown':
        return { text: 'Get Ready!', color: 'text-yellow-400', bg: 'bg-yellow-600' };
      case 'answering':
        return { text: 'Answering Time', color: 'text-green-400', bg: 'bg-green-600' };
      case 'revealing':
        return { text: 'Revealing Answer', color: 'text-blue-400', bg: 'bg-blue-600' };
      case 'completed':
        return { text: 'Question Complete', color: 'text-purple-400', bg: 'bg-purple-600' };
      default:
        return { text: 'Unknown', color: 'text-slate-400', bg: 'bg-slate-600' };
    }
  };

  const phaseDisplay = getPhaseDisplay(gameState.phase);

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Trivia Game Controls</h3>
              <p className="text-sm text-slate-400">{activity.title}</p>
            </div>
          </div>
          
          {onSettingsClick && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onSettingsClick}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Game Phase Indicator */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-3 h-3 rounded-full ${phaseDisplay.bg} animate-pulse`}></div>
            <span className={`font-medium ${phaseDisplay.color}`}>
              {phaseDisplay.text}
            </span>
          </div>
          
          {gameState.phase === 'waiting' && (
            <p className="text-sm text-slate-400">
              Ready to start the trivia question. {participantCount === 0 ? 'You can start without participants - they can join and see results in real-time.' : `${participantCount} participant(s) waiting.`}
            </p>
          )}
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-slate-400 font-medium">PARTICIPANTS</span>
            </div>
            <div className="text-lg font-bold text-white">
              {participantCount}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-slate-400 font-medium">TIMER</span>
            </div>
            <div className="text-sm font-bold text-white">
              {gameState.phase === 'answering' ? 
                `${gameState.timeRemaining}s` : `${countdownDuration}s`}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3 h-3 text-green-400" />
              <span className="text-xs text-slate-400 font-medium">POINTS</span>
            </div>
            <div className="text-sm font-bold text-white">
              {pointsPerCorrect} per correct
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-3 h-3 text-purple-400" />
              <span className="text-xs text-slate-400 font-medium">RESPONSES</span>
            </div>
            <div className="text-lg font-bold text-white">
              {activity.total_responses || 0}
            </div>
          </div>
        </div>

        {/* Timer Display */}
        {gameState.phase === 'answering' && gameState.timeRemaining > 0 && (
          <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-4 border border-blue-600/30 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-400 font-medium">Time Remaining</span>
              <span className="text-2xl font-bold text-white font-mono">
                {gameState.timeRemaining}s
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <motion.div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                animate={{ 
                  width: `${(gameState.timeRemaining / countdownDuration) * 100}%`,
                  backgroundColor: gameState.timeRemaining <= 10 ? '#ef4444' : '#3b82f6'
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="space-y-3">
          {gameState.phase === 'waiting' && (
            <Button
              onClick={() => handleAction('start')}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Play className="w-5 h-5" />
              Start Trivia Question
              {participantCount === 0 && (
                <span className="ml-2 text-xs opacity-75">(Demo Mode)</span>
              )}
            </Button>
          )}

          {(gameState.phase === 'answering' || gameState.phase === 'countdown') && (
            <Button
              onClick={() => handleAction('end', 'Are you sure you want to end the trivia question early?')}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700"
              size="lg"
            >
              <Square className="w-5 h-5" />
              End Question Early
            </Button>
          )}

          {gameState.phase === 'revealing' && !gameState.correctAnswerRevealed && (
            <Button
              onClick={() => handleAction('reveal')}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <Eye className="w-5 h-5" />
              Reveal Correct Answer
            </Button>
          )}

          {(gameState.phase === 'completed' || !gameState.isActive) && (
            <Button
              onClick={() => handleAction('reset', 'This will reset the trivia question. All current responses will be cleared.')}
              disabled={loading}
              variant="ghost"
              className="w-full border-2 border-dashed border-slate-600 hover:border-slate-500"
              size="lg"
            >
              <RotateCcw className="w-5 h-5" />
              Reset Question
            </Button>
          )}
        </div>

        {/* Response Summary */}
        {activity.total_responses > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600 mt-6">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Response Summary
            </h4>
            <div className="space-y-2">
              {activity.options?.map((option, index) => {
                const percentage = activity.total_responses > 0 
                  ? Math.round((option.responses / activity.total_responses) * 100) 
                  : 0;
                
                return (
                  <div key={option.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-slate-600 rounded text-white text-xs flex items-center justify-center font-bold">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="text-sm text-white truncate flex-1">
                        {option.text}
                      </span>
                      {option.is_correct && (
                        <span className="text-green-400 text-xs font-bold">CORRECT</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-300 ml-4">
                      <span className="font-bold">{option.responses}</span> ({percentage}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Confirm Action
              </h3>
              <p className="text-slate-300 mb-6">
                {showConfirm === 'end' && 'Are you sure you want to end the trivia question early?'}
                {showConfirm === 'reset' && 'This will reset the trivia question. All current responses will be cleared.'}
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowConfirm(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleAction(showConfirm)}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Confirm
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};