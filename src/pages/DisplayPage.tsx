import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../contexts/SocketContext';
import { useTheme } from '../components/ThemeProvider';
import { Users, BarChart, Clock, MessageSquare, HelpCircle, Cloud, Trophy, Target, Calendar, Activity as ActivityIcon, TrendingUp, CheckCircle, Lock, QrCode, X } from 'lucide-react';
import { Enhanced3DPollVisualization } from '../components/Enhanced3DPollVisualization';
import { Trivia3DVisualization } from '../components/Trivia3Dvisualization';
import { useTriviaGame } from '../hooks/useTriviaGame';
import type { ActivityType, Room, Activity } from '../types';

// Import our new static QR Code component
import QRCodeDisplay from '../components/QRCodeDisplay';

// Enhanced Activity Display Component with Fixed Trivia Detection
const ActivityDisplay = ({ currentRoom, currentTime, formatTime, displayActiveActivity }: {
  currentRoom: Room;
  currentTime: Date;
  formatTime: (date: Date) => string;
  displayActiveActivity: Activity | null;
}) => {
  const activeActivity = displayActiveActivity;

  // Debug logging for activity type detection
  React.useEffect(() => {
    if (activeActivity) {
      console.log('🎮 Activity detected:', {
        type: activeActivity.type,
        isTrivia: activeActivity.type === 'trivia',
        hasOptions: activeActivity.options?.length || 0
      });
    }
  }, [activeActivity]);

  // Trivia Game Hook
  const triviaGame = useTriviaGame({
    activity: activeActivity,
    enabled: activeActivity?.type === 'trivia'
  });

  // Check if this is a trivia activity
  const isTrivia = activeActivity?.type === 'trivia';

  if (isTrivia) {
    console.log('🎯 Rendering Trivia visualization');
    
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-purple-900 via-blue-900 to-slate-900 flex flex-col overflow-hidden">
        {/* Trivia Header with Game State */}
        <div className="p-3 text-center border-b border-slate-700/50 flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-2"
          >
            {/* Title Section */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold text-white">{activeActivity.title}</h1>
                <p className="text-xs text-slate-400">Trivia Challenge</p>
              </div>
            </div>

            {/* Game State Indicator */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-300 text-xs">
                <Users className="w-3 h-3" />
                <span>{currentRoom.participants} participants</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 text-xs">
                <Clock className="w-3 h-3" />
                <span>{formatTime(currentTime)}</span>
              </div>
              <div className="text-slate-400">
                <span className="font-mono font-bold text-purple-400">{currentRoom.code}</span>
              </div>
            </div>

            {/* Phase Indicator */}
            <div className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${
                triviaGame.gameState.phase === 'answering' ? 
                'bg-green-400 animate-pulse' : 
                triviaGame.gameState.phase === 'revealing' ? 'bg-yellow-400' :
                'bg-slate-400'
              }`}></div>
              <span className="capitalize text-xs">
                {triviaGame.gameState.phase === 'answering' ? 'Answering Time' : 
                 triviaGame.gameState.phase === 'revealing' ? 'Revealing Answer' :
                 triviaGame.gameState.phase === 'completed' ? 'Complete' : 'Waiting'}
              </span>
            </div>
          </div>
        </div>

        {/* Trivia 3D Visualization */}
        <div className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 80px)' }}>
          <Trivia3DVisualization
            options={activeActivity.options || []}
            totalResponses={activeActivity.total_responses || 0}
            themeColors={{
              primary: '#8b5cf6',
              secondary: '#3b82f6',
              accent: '#10b981',
              background: '#1e293b'
            }}
            activityTitle={activeActivity.title}
            activityMedia={activeActivity.media_url}
            gameState={triviaGame.gameState}
            onTimerComplete={triviaGame.endTrivia}
            onTimerTick={(timeRemaining) => {
              console.log('⏰ Timer tick:', timeRemaining);
            }}
            countdownDuration={activeActivity.settings?.countdown_duration || 30}
            showCorrectAnswer={activeActivity.settings?.show_correct_answer !== false}
            pointsPerCorrect={activeActivity.settings?.points_per_correct || 10}
          />
        </div>
      </div>
    );
  }

  // Default poll/survey display (existing logic)
  console.log('📊 Rendering default poll visualization for type:', activeActivity.type);
  
  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col overflow-hidden">
      {/* Standard Activity Header */}
      <div className="p-3 text-center border-b border-slate-700/50 flex-shrink-0">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-3 mb-2"
        >
          <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg">
            {React.createElement(getActivityIcon(activeActivity.type), { className: "w-6 h-6 text-white" })}
          </div>
          <div className="text-left">
            <h1 className="text-xl font-bold text-white">{activeActivity.title}</h1>
            <p className="text-xs text-slate-400">{getActivityTypeLabel(activeActivity.type)}</p>
          </div>
        </motion.div>
        
        <div className="flex items-center justify-center gap-4 text-slate-300 text-xs">
          <div className="flex items-center gap-2">
            <Users className="w-3 h-3" />
            <span>{currentRoom.participants} participants</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span>{formatTime(currentTime)}</span>
          </div>
          <div className="text-slate-400">
            <span className="font-mono font-bold text-blue-400">{currentRoom.code}</span>
          </div>
        </div>
      </div>

      {/* Poll Visualization */}
      <div className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 80px)' }}>
        <Enhanced3DPollVisualization
          options={activeActivity.options || []}
          totalResponses={activeActivity.total_responses || 0}
          themeColors={{
            primaryColor: '#3b82f6',
            secondaryColor: '#06b6d4',
            accentColor: '#10b981',
            backgroundGradient: 'from-slate-900 via-blue-900 to-slate-900',
            textColor: '#ffffff'
          }}
          activityTitle={activeActivity.title}
          activityMedia={activeActivity.media_url}
          isVotingLocked={activeActivity.settings?.voting_locked || false}
        />
      </div>
    </div>
  );
};

export const DisplayPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { 
    socket, 
    connectionStatus, 
    currentRoom, 
    stats,
    joinRoom,
    leaveRoom 
  } = useSocket();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [displayActiveActivity, setDisplayActiveActivity] = useState<Activity | null>(null);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Join room on mount and cleanup on unmount
  useEffect(() => {
    if (roomCode && socket && connectionStatus === 'connected') {
      console.log('🚀 Joining room:', roomCode);
      joinRoom(roomCode);
    }

    return () => {
      if (socket && currentRoom?.code) {
        console.log('👋 Leaving room:', currentRoom.code);
        leaveRoom();
      }
    };
  }, [roomCode, socket, connectionStatus, joinRoom, leaveRoom]);

  // Listen for activity updates
  useEffect(() => {
    if (!socket) return;

    const handleActivityUpdate = (activity: Activity | null) => {
      console.log('📡 Activity update received:', activity);
      setDisplayActiveActivity(activity);
    };

    const handleRoomUpdate = (room: Room) => {
      console.log('🏠 Room update received:', room);
      if (room.activeActivity) {
        setDisplayActiveActivity(room.activeActivity);
      } else {
        setDisplayActiveActivity(null);
      }
    };

    socket.on('activity_updated', handleActivityUpdate);
    socket.on('room_updated', handleRoomUpdate);

    return () => {
      socket.off('activity_updated', handleActivityUpdate);
      socket.off('room_updated', handleRoomUpdate);
    };
  }, [socket]);

  // Update display activity when room changes
  useEffect(() => {
    if (currentRoom?.activeActivity) {
      setDisplayActiveActivity(currentRoom.activeActivity);
    } else {
      setDisplayActiveActivity(null);
    }
  }, [currentRoom?.activeActivity]);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Helper functions for activity icons and labels
  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'poll': return BarChart;
      case 'survey': return MessageSquare;
      case 'trivia': return Trophy;
      case 'wordcloud': return Cloud;
      case 'q&a': return HelpCircle;
      default: return BarChart;
    }
  };

  const getActivityTypeLabel = (type: ActivityType): string => {
    switch (type) {
      case 'poll': return 'Live Poll';
      case 'survey': return 'Survey';
      case 'trivia': return 'Trivia Challenge';
      case 'wordcloud': return 'Word Cloud';
      case 'q&a': return 'Q&A Session';
      default: return 'Activity';
    }
  };

  // Loading state
  if (connectionStatus === 'connecting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Connecting...</h2>
          <p className="text-slate-400">Establishing connection to room {roomCode}</p>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (connectionStatus === 'disconnected' || !currentRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto p-8"
        >
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connection Failed</h2>
          <p className="text-slate-400 mb-4">
            Unable to connect to room <span className="font-mono text-red-400">{roomCode}</span>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  // Show active activity if available
  if (displayActiveActivity) {
    return (
      <ActivityDisplay
        currentRoom={currentRoom}
        currentTime={currentTime}
        formatTime={formatTime}
        displayActiveActivity={displayActiveActivity}
      />
    );
  }

  // No active activity - show static QR code page
  const joinUrl = `${window.location.origin}/join/${currentRoom.code}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex">
      {/* Main Content - Static QR Display */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {/* Static QR Code Display */}
            <div className="mb-8">
              <QRCodeDisplay 
                url={joinUrl} 
                size={300}
                title="Join This Room"
                showUrl={true}
                showCopyButton={true}
                className="max-w-lg mx-auto"
              />
            </div>
            
            {/* Room Code Display */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 max-w-md mx-auto"
            >
              <p className="text-slate-300 mb-3 text-lg">
                Or enter room code:
              </p>
              <div className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-4">
                <p className="text-blue-200 text-3xl font-mono font-bold tracking-wider">
                  {currentRoom.code}
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Stats and Info Section */}
      <div className="w-80 bg-slate-800/30 backdrop-blur-sm border-l border-slate-700/50 p-6">
        {/* Stats Overview */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4 mb-8"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Room Statistics</h3>
          
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="text-slate-300 text-sm">Active Participants</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.participants}</p>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <ActivityIcon className="w-5 h-5 text-green-400" />
              <span className="text-slate-300 text-sm">Total Activities</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalActivities}</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-slate-300 text-sm">Total Responses</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalResponses}</p>
          </div>
        </motion.div>

        {/* Current Time */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50"
        >
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-slate-300 text-sm">Current Time</span>
          </div>
          <p className="text-xl font-mono text-white">{formatTime(currentTime)}</p>
        </motion.div>

        {/* Waiting for Activity */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-center"
        >
          <div className="bg-slate-800/30 rounded-lg p-6 border border-slate-700/30">
            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-400 text-sm">
              Waiting for host to start an activity...
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DisplayPage;