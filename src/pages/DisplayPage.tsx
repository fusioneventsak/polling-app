import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useTheme } from '../components/ThemeProvider';
import { Users, BarChart, Clock, MessageSquare, HelpCircle, Cloud, Trophy, Target, Calendar, Activity as ActivityIcon, TrendingUp, CheckCircle, Lock, QrCode, X } from 'lucide-react';
import { Enhanced3DPollVisualization } from '../components/Enhanced3DPollVisualization';
import { Trivia3DVisualization } from '../components/Trivia3Dvisualization';
import { useTriviaGame } from '../hooks/useTriviaGame';
import type { ActivityType, Room, Activity } from '../types';

// QR Code Generator Component (inline to avoid import issues)
const QRCodeDisplay: React.FC<{ url: string; size?: number }> = ({ url, size = 200 }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=1e293b&color=ffffff&format=svg`;
        setQrDataUrl(qrApiUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    if (url) {
      generateQRCode();
    }
  }, [url, size]);

  if (!qrDataUrl) {
    return (
      <div 
        className="flex items-center justify-center bg-slate-800 rounded-lg border-2 border-dashed border-slate-600"
        style={{ width: size, height: size }}
      >
        <QrCode className="w-12 h-12 text-slate-500" />
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg">
      <img 
        src={qrDataUrl} 
        alt="QR Code to join room" 
        className="w-full h-full"
        style={{ width: size - 32, height: size - 32 }}
        onError={() => {
          console.error('Failed to load QR code');
          setQrDataUrl('');
        }}
      />
    </div>
  );
};

// Enhanced Activity Display Component with Fixed Trivia Detection
const ActivityDisplay = ({ currentRoom, currentTime, formatTime }: {
  currentRoom: Room;
  currentTime: Date;
  formatTime: (date: Date) => string;
}) => {
  const activeActivity = React.useMemo(() => {
    if (!currentRoom?.activities) return null;
    
    // Priority 1: Use current_activity_id from room
    if (currentRoom.current_activity_id) {
      const currentActivity = currentRoom.activities.find(a => a.id === currentRoom.current_activity_id) as Activity | undefined;
      if (currentActivity) {
        // Debug logging
        console.log('🎯 Found current activity by ID:', {
          id: currentActivity.id,
          type: currentActivity.type,
          title: currentActivity.title,
          options: currentActivity.options?.length || 0
        });
        
        // Ensure options are properly formatted
        currentActivity.options = currentActivity.options?.map((opt, index) => ({
          id: opt.id,
          text: opt.text,
          media_url: opt.media_url,
          responses: opt.responses || 0,
          is_correct: opt.is_correct || false,
          option_order: opt.option_order || index,
          created_at: opt.created_at,
          activity_id: opt.activity_id
        })) || [];
        return currentActivity;
      }
    }
    
    // Priority 2: Fallback to any activity marked as active
    const flaggedActive = currentRoom.activities?.find(a => a.is_active) as Activity | undefined;
    if (flaggedActive) {
      console.log('🎯 Found active activity by flag:', flaggedActive.type, flaggedActive.title);
      return flaggedActive;
    }
    
    console.log('❌ No active activity found');
    return null;
  }, [currentRoom?.current_activity_id, currentRoom?.activities]);

  // Debug logging for activity type detection
  React.useEffect(() => {
    if (activeActivity) {
      console.log('🎮 Activity detected:', {
        type: activeActivity.type,
        isTrivia: activeActivity.type === 'trivia',
        title: activeActivity.title,
        options: activeActivity.options?.length
      });
    }
  }, [activeActivity]);

  // Initialize trivia game hook only for trivia activities
  const triviaGame = useTriviaGame({
    activity: activeActivity || {} as Activity,
    roomId: currentRoom?.id || '',
  });

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'poll':
        return Target;
      case 'trivia':
        return HelpCircle;
      case 'quiz':
        return MessageSquare;
      default:
        return Target;
    }
  };

  const getActivityTypeLabel = (type: ActivityType) => {
    switch (type) {
      case 'poll':
        return 'Poll';
      case 'trivia':
        return 'Trivia';
      case 'quiz':
        return 'Quiz';
      default:
        return 'Activity';
    }
  };

  if (!activeActivity || !currentRoom) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-2">No Active Activity</h2>
          <p className="text-slate-400">Waiting for the host to start an activity...</p>
        </div>
      </div>
    );
  }

  // FIXED: Explicit check for trivia type with debug logging
  console.log('🔍 Checking activity type for display:', {
    type: activeActivity.type,
    isExactlyTrivia: activeActivity.type === 'trivia',
    typeOfType: typeof activeActivity.type
  });

  if (activeActivity.type === 'trivia') {
    console.log('✅ Rendering Trivia3DVisualization');
    
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col">
        {/* Trivia Header */}
        <div className="p-6 text-center border-b border-slate-700/50">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-4 mb-4"
          >
            <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
              <HelpCircle className="w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-white">{activeActivity.title}</h1>
              <p className="text-sm text-slate-400">Trivia Question</p>
            </div>
          </motion.div>
          
          <div className="flex items-center justify-center gap-6 text-slate-300 text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{currentRoom.participants} participants</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{formatTime(currentTime)}</span>
            </div>
            <div className="text-slate-400">
              <span className="font-mono font-bold text-purple-400">{currentRoom.code}</span>
            </div>
            {/* Game Phase Indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                triviaGame.gameState.phase === 'answering' ? 'bg-green-400 animate-pulse' : 
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
        <div className="flex-1 p-4" style={{ height: 'calc(100vh - 120px)' }}>
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
    <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col">
      {/* Standard Activity Header */}
      <div className="p-6 text-center border-b border-slate-700/50">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-4 mb-4"
        >
          <div className="p-3 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl">
            {React.createElement(getActivityIcon(activeActivity.type), { className: "w-8 h-8 text-white" })}
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-bold text-white">{activeActivity.title}</h1>
            <p className="text-sm text-slate-400">{getActivityTypeLabel(activeActivity.type)}</p>
          </div>
        </motion.div>
        
        <div className="flex items-center justify-center gap-6 text-slate-300 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{currentRoom.participants} participants</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{formatTime(currentTime)}</span>
          </div>
          <div className="text-slate-400">
            <span className="font-mono font-bold text-blue-400">{currentRoom.code}</span>
          </div>
        </div>
      </div>

      {/* Poll Visualization */}
      <div className="flex-1 p-4" style={{ height: 'calc(100vh - 120px)' }}>
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
  const { pollId } = useParams<{ pollId: string }>();
  const { rooms, isConnected, connectionStatus } = useSocket();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Derive currentRoom from the global rooms state
  const currentRoom = useMemo(() => {
    if (!pollId || !rooms) return null;
    return rooms.find(room => room.code === pollId) || null;
  }, [pollId, rooms]);

  // Get all activities for stats
  const allActivities = currentRoom?.activities || [];

  // Time update effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getRoomStats = () => {
    if (!currentRoom) return null;
    
    const completedActivities = allActivities.filter(a => (a.total_responses || 0) > 0).length;
    const totalActivities = allActivities.length;
    
    return {
      activities: totalActivities,
      completedActivities,
      totalResponses: allActivities.reduce((sum, a) => sum + (a.total_responses || 0), 0),
      participants: currentRoom.participants
    };
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Enhanced Dashboard Component with QR Code
  const Dashboard = () => {
    const stats = getRoomStats();
    if (!stats || !currentRoom) return null;

    const joinUrl = `${window.location.origin}/game?code=${currentRoom.code}`;

    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col">
        {/* Header */}
        <div className="p-8 text-center border-b border-slate-700/50">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-white mb-2"
          >
            {currentRoom.name}
          </motion.h1>
          <div className="flex items-center justify-center gap-6 text-slate-300">
            <span className="text-lg">Room Code: <span className="font-mono font-bold text-blue-400">{currentRoom.code}</span></span>
            <span className="text-lg">{formatTime(currentTime)}</span>
          </div>
        </div>

        <div className="flex-1 p-8">
          {/* Main Content - QR Code Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 h-full items-center"
          >
            {/* QR Code Section */}
            <div className="text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="mb-8"
              >
                <h2 className="text-3xl font-bold text-white mb-6">
                  Join the Room
                </h2>
                <div className="flex justify-center mb-6">
                  <QRCodeDisplay url={joinUrl} size={300} />
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700/50 max-w-md mx-auto">
                  <p className="text-slate-300 mb-4">
                    Scan the QR code or visit:
                  </p>
                  <div className="bg-slate-900/50 p-3 rounded border border-slate-600">
                    <code className="text-blue-400 text-sm break-all">
                      {joinUrl}
                    </code>
                  </div>
                  <div className="mt-4 p-3 bg-blue-900/30 border border-blue-600/50 rounded">
                    <p className="text-blue-200 text-lg font-mono font-bold">
                      Room Code: {currentRoom.code}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Stats and Info Section */}
            <div>
              {/* Stats Overview */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-2 gap-6 mb-8"
              >
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-blue-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.participants}</p>
                      <p className="text-slate-400 text-sm">Participants</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <ActivityIcon className="w-8 h-8 text-green-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.activities}</p>
                      <p className="text-slate-400 text-sm">Activities</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-purple-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.completedActivities}</p>
                      <p className="text-slate-400 text-sm">Completed</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-orange-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.totalResponses}</p>
                      <p className="text-slate-400 text-sm">Total Responses</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Activities List */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700/50 overflow-hidden"
              >
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <BarChart className="w-5 h-5" />
                    Recent Activities
                  </h3>
                  
                  {allActivities.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {allActivities.slice(0, 5).map((activity, index) => {
                        const isActive = activity.is_active || activity.id === currentRoom.current_activity_id;
                        const participationRate = activity.total_responses > 0 
                          ? Math.round((activity.total_responses / Math.max(currentRoom.participants, 1)) * 100)
                          : 0;
                        
                        return (
                          <motion.div
                            key={activity.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + index * 0.1 }}
                            className={`p-4 rounded-lg border transition-all ${
                              isActive 
                                ? 'bg-blue-900/30 border-blue-600/50' 
                                : 'bg-slate-700/30 border-slate-600/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {isActive && (
                                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                )}
                                <div>
                                  <h4 className="font-medium text-white truncate">
                                    {activity.title}
                                  </h4>
                                  <p className="text-sm text-slate-400 capitalize">
                                    {activity.type} • {activity.total_responses || 0} responses
                                  </p>
                                </div>
                              </div>
                              
                              {activity.total_responses > 0 && (
                                <div className="text-right">
                                  <p className="text-sm font-medium text-white">
                                    {participationRate}%
                                  </p>
                                  <div className="w-16 h-1 bg-slate-600 rounded-full mt-1">
                                    <div 
                                      className="h-full bg-blue-400 rounded-full transition-all duration-1000"
                                      style={{ 
                                        width: `${Math.min(100, participationRate)}%` 
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Target className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                      <p className="text-slate-400 mb-1">No Activities Yet</p>
                      <p className="text-slate-500 text-sm">Activities will appear here when they are created</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Waiting Message */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center mt-8"
              >
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-blue-900/30 border border-blue-600/50 rounded-full">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-blue-200 text-lg">Waiting for activity to start...</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

  // Show connection status
  if (connectionStatus === 'disconnected') {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connection Lost</h2>
          <p className="text-slate-400 mb-6">Unable to connect to the server</p>
          <p className="text-sm text-slate-500">
            Please check your internet connection and try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'reconnecting') {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Reconnecting...</h2>
          <p className="text-slate-400">Restoring connection to room {pollId}</p>
        </div>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Room Not Found</h2>
          <p className="text-slate-400 mb-6">Room with code "{pollId}" does not exist or is no longer active</p>
          <p className="text-sm text-slate-500">
            Please check the room code and try again.
          </p>
        </div>
      </div>
    );
  }

  // Show dashboard with QR code when no activity is active
  if (!currentRoom?.current_activity_id && !currentRoom?.activities?.some(a => a.is_active)) {
    return <Dashboard />;
  }

  // Show active activity display
  return (
    <ActivityDisplay
      currentRoom={currentRoom}
      currentTime={currentTime}
      formatTime={formatTime}
    />
  );
};