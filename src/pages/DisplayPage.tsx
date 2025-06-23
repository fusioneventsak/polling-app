import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { roomService } from '../services/roomService';
import { useTheme } from '../components/ThemeProvider';
import { Users, BarChart, Clock, MessageSquare, HelpCircle, Cloud, Trophy, Target, Calendar, Activity as ActivityIcon, TrendingUp, CheckCircle, Lock, QrCode } from 'lucide-react';
import { Enhanced3DPollVisualization } from '../components/Enhanced3DPollVisualization';
import type { ActivityType, Room, Activity } from '../types';

// QR Code Generator Component (inline to avoid import issues)
const QRCodeDisplay: React.FC<{ url: string; size?: number }> = ({ url, size = 200 }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    // Generate QR code data URL using QR Server API
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

// Enhanced Poll Results Visualization Component with real-time animations
const FixedPoll3DVisualization: React.FC<{
  options: any[];
  totalResponses: number;
  themeColors: any;
  activityTitle?: string;
  activityMedia?: string;
  isVotingLocked?: boolean;
}> = ({ options, totalResponses, themeColors, activityTitle, activityMedia, isVotingLocked }) => {
  const [animatedCounts, setAnimatedCounts] = useState<number[]>([]);
  const [animatedPercentages, setAnimatedPercentages] = useState<number[]>([]);
  const prevTotalResponses = useRef(totalResponses);

  // Initialize animated values
  useEffect(() => {
    if (options.length > 0) {
      setAnimatedCounts(options.map(opt => opt.responses || 0));
      setAnimatedPercentages(options.map((opt, index) => 
        totalResponses > 0 ? Math.round(((opt.responses || 0) / totalResponses) * 100) : 0
      ));
    }
  }, [options.length]);

  // Animate values when they change with enhanced animations
  useEffect(() => {
    if (totalResponses !== prevTotalResponses.current && options.length > 0) {
      console.log('DisplayPage: Animating vote count changes:', { 
        oldTotal: prevTotalResponses.current, 
        newTotal: totalResponses 
      });
      
      const newCounts = options.map(opt => opt.responses || 0);
      const newPercentages = options.map(opt => 
        totalResponses > 0 ? Math.round(((opt.responses || 0) / totalResponses) * 100) : 0
      );

      // Enhanced animation for counts
      animatedCounts.forEach((currentCount, index) => {
        const targetCount = newCounts[index];
        if (currentCount !== targetCount) {
          const duration = 1500; // 1.5 second animation
          const steps = 60; // Smoother animation
          const stepValue = (targetCount - currentCount) / steps;
          
          let step = 0;
          const interval = setInterval(() => {
            step++;
            const newValue = Math.round(currentCount + (stepValue * step));
            
            setAnimatedCounts(prev => {
              const updated = [...prev];
              updated[index] = step === steps ? targetCount : newValue;
              return updated;
            });
            
            if (step === steps) {
              clearInterval(interval);
            }
          }, duration / steps);
        }
      });

      // Enhanced animation for percentages
      animatedPercentages.forEach((currentPercentage, index) => {
        const targetPercentage = newPercentages[index];
        if (currentPercentage !== targetPercentage) {
          const duration = 1500;
          const steps = 60;
          const stepValue = (targetPercentage - currentPercentage) / steps;
          
          let step = 0;
          const interval = setInterval(() => {
            step++;
            const newValue = Math.round(currentPercentage + (stepValue * step));
            
            setAnimatedPercentages(prev => {
              const updated = [...prev];
              updated[index] = step === steps ? targetPercentage : newValue;
              return updated;
            });
            
            if (step === steps) {
              clearInterval(interval);
            }
          }, duration / steps);
        }
      });

      prevTotalResponses.current = totalResponses;
    }
  }, [totalResponses, options, animatedCounts, animatedPercentages]);

  if (options.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-gradient-to-br from-slate-900/40 to-blue-900/20 rounded-xl border border-slate-700 p-12 text-center"
      >
        <Target className="w-16 h-16 mx-auto text-slate-600 mb-4" />
        <h3 className="text-2xl font-bold text-white mb-2">No Options Available</h3>
        <p className="text-slate-400">Options will appear here when created</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8 }}
      className="w-full bg-gradient-to-br from-slate-900/40 to-blue-900/20 rounded-xl border border-slate-700 overflow-hidden shadow-2xl relative"
      style={{ height: '100%', minHeight: '400px' }}
    >
      {/* Enhanced header with vote counter and status */}
      <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm rounded-lg p-3 border border-white/10">
        <div className="text-white text-sm">
          <motion.div 
            key={totalResponses}
            initial={{ scale: 1.2, color: '#22c55e' }}
            animate={{ scale: 1, color: '#ffffff' }}
            transition={{ duration: 0.5 }}
            className="font-semibold"
          >
            {totalResponses} Total Responses
          </motion.div>
          <div className="text-slate-300 text-xs">{options.length} Options</div>
        </div>
      </div>

      {/* Voting locked indicator */}
      {isVotingLocked && (
        <div className="absolute top-4 right-4 bg-red-900/40 backdrop-blur-sm rounded-lg p-3 border border-red-600/30">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-sm font-medium">Voting Locked</span>
          </div>
        </div>
      )}

      {/* Enhanced visualization with better animations */}
      <div className="h-full flex flex-col p-8">
        <div className="text-center mb-8">
          {/* Activity Media */}
          {activityMedia && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <img
                src={activityMedia}
                alt="Activity media"
                className="max-w-sm mx-auto rounded-lg shadow-lg"
              />
            </motion.div>
          )}
          
          <h3 className="text-2xl font-bold text-white mb-2">
            {totalResponses > 0 ? 'Live Poll Results' : (activityTitle || 'Poll Options')}
          </h3>
          <p className="text-slate-400">
            {totalResponses > 0 ? 'Results update in real-time as votes come in' : 'Waiting for participants to vote...'}
          </p>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
            {options.map((option, index) => {
              const animatedCount = animatedCounts[index] || 0;
              const animatedPercentage = animatedPercentages[index] || 0;
              const maxResponses = Math.max(...options.map(opt => opt.responses || 0), 1);
              const heightPercentage = totalResponses > 0 ? (animatedCount / maxResponses) * 100 : 0;

              return (
                <motion.div
                  key={option.id}
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.15, duration: 0.6 }}
                  className="relative"
                >
                  {/* Enhanced 3D Card */}
                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-6 border border-slate-600/50 backdrop-blur-sm shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                    {/* Option Media */}
                    {option.media_url && (
                      <div className="mb-4">
                        <img
                          src={option.media_url}
                          alt="Option media"
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      </div>
                    )}

                    {/* Option Label */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {String.fromCharCode(65 + index)}
                      </div>
                      <p className="text-white font-semibold text-lg flex-1 leading-tight">
                        {option.text}
                      </p>
                    </div>

                    {/* Animated Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-300 text-sm">Responses</span>
                        <span className="text-white font-bold text-lg">
                          {animatedPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${animatedPercentage}%` }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full shadow-lg"
                        />
                      </div>
                    </div>

                    {/* Vote Count with Animation */}
                    <div className="text-center">
                      <motion.div
                        key={animatedCount}
                        initial={{ scale: 1.2, color: '#22c55e' }}
                        animate={{ scale: 1, color: '#ffffff' }}
                        transition={{ duration: 0.5 }}
                        className="text-3xl font-bold text-white"
                      >
                        {animatedCount}
                      </motion.div>
                      <p className="text-slate-400 text-sm">votes</p>
                    </div>

                    {/* 3D Height Indicator */}
                    <div className="absolute right-4 top-4 w-2 bg-slate-700/50 rounded-full overflow-hidden h-20">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPercentage}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-full"
                        style={{ alignSelf: 'flex-end' }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

function DisplayPage() {
  const { pollId } = useParams();
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const subscriptionRef = useRef<any>(null);

  const activeActivity = React.useMemo(() => {
    if (!currentRoom?.activities) return null;
    
    // Priority 1: Use current_activity_id from room
    if (currentRoom.current_activity_id) {
      const currentActivity = currentRoom.activities.find(a => a.id === currentRoom.current_activity_id) as Activity | undefined;
      if (currentActivity) {
        console.log('DisplayPage: Found current activity via current_activity_id:', {
          id: currentActivity.id,
          title: currentActivity.title,
          optionsCount: currentActivity.options?.length || 0,
          totalResponses: currentActivity.total_responses || 0
        });
        
        // Ensure options are properly formatted
        currentActivity.options = currentActivity.options?.map(opt => ({
          id: opt.id,
          text: opt.text,
          responses: opt.responses || 0
        })) || [];
        return currentActivity;
      } else {
        console.log('DisplayPage: Warning - current_activity_id points to non-existent activity:', currentRoom.current_activity_id);
      }
    }
    
    // Priority 2: Fallback to any activity marked as active (in case of data inconsistency)
    const flaggedActive = currentRoom.activities?.find(a => a.is_active) as Activity | undefined;
    if (flaggedActive) {
      console.log('DisplayPage: Found active activity via is_active flag (fallback):', {
        id: flaggedActive.id,
        title: flaggedActive.title,
        optionsCount: flaggedActive.options?.length || 0,
        totalResponses: flaggedActive.total_responses || 0
      });
      return flaggedActive;
    }
    
    console.log('DisplayPage: No active activity found - showing dashboard');
    return null;
  }, [currentRoom?.current_activity_id, currentRoom?.activities]);

  const allActivities = currentRoom?.activities || [];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load room data
  const loadRoom = useCallback(async (forceRefresh = false) => {
    if (!pollId || !supabase) return;
    
    try {
      console.log('DisplayPage: Loading room data for code:', pollId, forceRefresh ? '(forced)' : '');
      
      const { data: roomData, error } = await supabase
        .from('rooms')
        .select(`
          *,
          activities!activities_room_id_fkey(
            *,
            options:activity_options(*)
          )
        `)
        .eq('code', pollId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('DisplayPage: Error loading room:', error);
        setCurrentRoom(null);
        return;
      }

      if (!roomData) {
        console.log('DisplayPage: Room not found for code:', pollId);
        setCurrentRoom(null);
        return;
      }

      console.log('DisplayPage: Room loaded successfully:', {
        id: roomData.id,
        name: roomData.name,
        code: roomData.code,
        activitiesCount: roomData.activities?.length || 0,
        currentActivityId: roomData.current_activity_id,
        participants: roomData.participants
      });

      setCurrentRoom(roomData);
    } catch (error) {
      console.error('DisplayPage: Error in loadRoom:', error);
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  // Load room on mount
  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!pollId || !supabase) return;

    console.log('DisplayPage: Setting up real-time subscriptions for room code:', pollId);

    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    const channel = supabase
      .channel(`display-page-${pollId}`)
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'rooms',
          filter: `code=eq.${pollId}`
        },
        async (payload) => {
          console.log('DisplayPage: Room change received:', payload);
          await loadRoom(true);
        }
      )
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'activities'
        },
        async (payload) => {
          console.log('DisplayPage: Activity change received:', payload);
          await loadRoom(true);
        }
      )
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'activity_options'
        },
        async (payload) => {
          console.log('DisplayPage: Activity options change received:', payload);
          await loadRoom(true);
        }
      )
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'participant_responses'
        },
        async (payload) => {
          console.log('DisplayPage: Participant response change received:', {
            eventType: payload.eventType,
            activityId: payload.new?.activity_id || payload.old?.activity_id,
            optionId: payload.new?.option_id || payload.old?.option_id
          });
          await loadRoom(true);
        }
      );

    subscriptionRef.current = channel;
    channel.subscribe((status, err) => {
      console.log('DisplayPage: Subscription status:', status);
      if (err) {
        console.error('DisplayPage: Subscription error:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ DisplayPage: Real-time subscriptions active');
      }
    });

    return () => {
      console.log('DisplayPage: Cleaning up subscriptions');
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [pollId, loadRoom]);

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
                      <p className="text-slate-400">Participants</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <Target className="w-8 h-8 text-green-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.activities}</p>
                      <p className="text-slate-400">Activities</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <BarChart className="w-8 h-8 text-purple-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.totalResponses}</p>
                      <p className="text-slate-400">Total Responses</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-orange-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.completedActivities}</p>
                      <p className="text-slate-400">Completed</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Activities Preview */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700/50"
              >
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <ActivityIcon className="w-5 h-5" />
                  Activities Overview
                </h3>
                
                {allActivities.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {allActivities.map((activity, index) => {
                      const Icon = getActivityIcon(activity.type);
                      const participationRate = stats.participants > 0 
                        ? Math.round(((activity.total_responses || 0) / stats.participants) * 100)
                        : 0;

                      return (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + (index * 0.05) }}
                          className="flex items-center justify-between p-3 bg-slate-900/30 rounded border border-slate-600/30"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Icon className="w-4 h-4 text-blue-400" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium truncate">{activity.title}</p>
                              <p className="text-slate-400 text-xs">
                                {activity.total_responses || 0} responses • {participationRate}% participation
                              </p>
                            </div>
                          </div>
                          {participationRate > 0 && (
                            <div className="w-16 bg-slate-700/50 rounded-full h-2 ml-3">
                              <div 
                                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${Math.min(100, participationRate)}%` 
                                }}
                              />
                            </div>
                          )}
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
              </motion.div>
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
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading room display...</p>
        </div>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-white mb-2">Room Not Found</h1>
          <p className="text-red-300">Unable to find room with code: {pollId}</p>
        </div>
      </div>
    );
  }

  // Show dashboard with QR code when no activity is active
  if (!activeActivity) {
    return <Dashboard />;
  }

  // Show active activity with enhanced real-time results
  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeActivity.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          {/* Enhanced Header */}
          <div className="p-6 border-b border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  {React.createElement(getActivityIcon(activeActivity.type), {
                    className: "w-8 h-8 text-blue-400"
                  })}
                  <div>
                    <h1 className="text-2xl font-bold text-white">{activeActivity.title}</h1>
                    <p className="text-slate-400">{getActivityTypeLabel(activeActivity.type)}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-6 text-slate-300">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <span>{currentRoom.participants} participants</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>{formatTime(currentTime)}</span>
                </div>
                <div className="text-slate-400">
                  Room: <span className="font-mono font-bold text-blue-400">{currentRoom.code}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Results Visualization */}
          <div className="flex-1 p-6">
            <Enhanced3DPollVisualization
              options={activeActivity.options || []}
              totalResponses={activeActivity.total_responses || 0}
              themeColors={{
                primary: '#3b82f6',
                accent: '#10b981',
                background: '#1e293b'
              }}
              activityTitle={activeActivity.title}
              activityMedia={activeActivity.media_url}
              isVotingLocked={activeActivity.settings?.voting_locked}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export { DisplayPage };