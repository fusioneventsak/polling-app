import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Play, Pause, RotateCcw } from 'lucide-react';

interface TriviaCountdownTimerProps {
  duration: number; // seconds (5-60)
  isActive: boolean;
  onTimeUp: () => void;
  onTick?: (timeRemaining: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showControls?: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  autoStart?: boolean;
}

export const TriviaCountdownTimer: React.FC<TriviaCountdownTimerProps> = ({
  duration,
  isActive,
  onTimeUp,
  onTick,
  size = 'lg',
  showControls = false,
  onStart,
  onPause,
  onReset,
  autoStart = false
}) => {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(autoStart && isActive);
  const [hasStarted, setHasStarted] = useState(autoStart);

  // Size configurations
  const sizeConfig = {
    sm: { timer: 'text-4xl', circle: 120, stroke: 8 },
    md: { timer: 'text-6xl', circle: 160, stroke: 12 },
    lg: { timer: 'text-8xl', circle: 200, stroke: 16 }
  };

  const config = sizeConfig[size];
  const radius = (config.circle - config.stroke * 2) / 2;
  const circumference = radius * 2 * Math.PI;

  // Reset timer when duration changes
  useEffect(() => {
    setTimeRemaining(duration);
    if (!hasStarted) {
      setIsRunning(false);
    }
  }, [duration, hasStarted]);

  // Handle active state changes
  useEffect(() => {
    if (!isActive) {
      setIsRunning(false);
    } else if (autoStart && !hasStarted) {
      setIsRunning(true);
      setHasStarted(true);
    }
  }, [isActive, autoStart, hasStarted]);

  // Main countdown logic
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && isActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = Math.max(0, prev - 1);
          onTick?.(newTime);
          
          if (newTime === 0) {
            setIsRunning(false);
            onTimeUp();
          }
          
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, isActive, timeRemaining, onTimeUp, onTick]);

  const handleStart = useCallback(() => {
    if (!isActive) return;
    setIsRunning(true);
    setHasStarted(true);
    onStart?.();
  }, [isActive, onStart]);

  const handlePause = useCallback(() => {
    setIsRunning(false);
    onPause?.();
  }, [onPause]);

  const handleReset = useCallback(() => {
    setTimeRemaining(duration);
    setIsRunning(false);
    setHasStarted(false);
    onReset?.();
  }, [duration, onReset]);

  // Calculate progress for circle animation
  const progress = duration > 0 ? ((duration - timeRemaining) / duration) * 100 : 0;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Color based on time remaining
  const getTimerColor = () => {
    const percentage = (timeRemaining / duration) * 100;
    if (percentage > 50) return 'text-green-400';
    if (percentage > 25) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCircleColor = () => {
    const percentage = (timeRemaining / duration) * 100;
    if (percentage > 50) return '#10b981'; // green
    if (percentage > 25) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : seconds.toString();
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Main Timer Display */}
      <div className="relative flex items-center justify-center">
        {/* Background Circle */}
        <svg
          width={config.circle}
          height={config.circle}
          className="transform -rotate-90"
        >
          <circle
            cx={config.circle / 2}
            cy={config.circle / 2}
            r={radius}
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth={config.stroke}
            fill="transparent"
          />
          {/* Progress Circle */}
          <motion.circle
            cx={config.circle / 2}
            cy={config.circle / 2}
            r={radius}
            stroke={getCircleColor()}
            strokeWidth={config.stroke}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            animate={{
              strokeDashoffset,
              stroke: getCircleColor()
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </svg>

        {/* Timer Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={timeRemaining}
              initial={{ scale: 1.2, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0.6 }}
              transition={{ duration: 0.2 }}
              className={`font-bold ${config.timer} ${getTimerColor()} font-mono tracking-tight`}
            >
              {formatTime(timeRemaining)}
            </motion.div>
          </AnimatePresence>
          
          {/* Clock Icon */}
          <Clock className="w-6 h-6 text-slate-400 mt-2" />
        </div>

        {/* Pulse Effect for Low Time */}
        {timeRemaining <= 10 && timeRemaining > 0 && (
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-red-400"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.6, 0.2, 0.6]
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}
      </div>

      {/* Timer Status */}
      <div className="text-center">
        <div className="text-sm text-slate-400 font-medium">
          {!hasStarted && 'Ready to Start'}
          {hasStarted && isRunning && 'Time Remaining'}
          {hasStarted && !isRunning && timeRemaining === 0 && 'Time\'s Up!'}
          {hasStarted && !isRunning && timeRemaining > 0 && 'Paused'}
        </div>
      </div>

      {/* Control Buttons */}
      {showControls && (
        <div className="flex items-center space-x-3">
          {!isRunning && timeRemaining > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStart}
              disabled={!isActive}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>Start</span>
            </motion.button>
          )}

          {isRunning && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePause}
              className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
            >
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleReset}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </motion.button>
        </div>
      )}

      {/* Progress Bar (Alternative View) */}
      <div className="w-full max-w-md">
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: getCircleColor() }}
            animate={{ width: `${(timeRemaining / duration) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
      </div>
    </div>
  );
};