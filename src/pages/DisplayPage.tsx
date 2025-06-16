import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { roomService } from '../services/roomService';
import { useTheme } from '../components/ThemeProvider';
import { Users, BarChart, Clock, MessageSquare, HelpCircle, Cloud, Trophy, Target, Calendar, Activity as ActivityIcon, TrendingUp, CheckCircle } from 'lucide-react';
import type { ActivityType, Room, Activity } from '../types';

// Fixed Poll3D component without font errors
const FixedPoll3DVisualization: React.FC<{
  options: any[];
  totalResponses: number;
  themeColors: any;
  activityTitle?: string;
  activityMedia?: string;
}> = ({ options, totalResponses, themeColors, activityTitle, activityMedia }) => {
  if (!options || options.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="w-full bg-slate-900/20 rounded-xl border border-slate-700 overflow-hidden flex items-center justify-center"
        style={{ height: '100%', minHeight: '400px' }}
      >
        <div className="text-center text-slate-400">
          <div className="w-16 h-16 bg-slate-700 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <BarChart className="w-8 h-8" />
          </div>
          <p className="text-lg font-medium">No poll options available</p>
          <p className="text-sm">Poll options will appear here when created</p>
        </div>
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
      {/* Simple 2D visualization instead of 3D to avoid font errors */}
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
            {totalResponses > 0 ? `${totalResponses} total responses` : 'Waiting for responses...'}
          </p>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
            {options.map((option, index) => {
              const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
              const maxResponses = Math.max(...options.map(opt => opt.responses || 0), 1);
              const heightPercentage = totalResponses > 0 ? (option.responses / maxResponses) * 100 : 20;
              
              return (
                <motion.div
                  key={option.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-slate-800/50 rounded-lg p-4 border border-slate-600"
                >
                  {/* Option Media */}
                  {option.media_url && (
                    <div className="mb-4">
                      <img
                        src={option.media_url}
                        alt="Option media"
                        className="w-full max-w-xs mx-auto rounded-md"
                      />
                    </div>
                  )}
                  
                  <div className="text-center mb-4">
                    <h4 className="text-white font-medium text-sm mb-2">{option.text}</h4>
                    <div className="text-2xl font-bold text-blue-400">{percentage}%</div>
                    <div className="text-xs text-slate-400">
                      {option.responses || 0} {(option.responses || 0) === 1 ? 'vote' : 'votes'}
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${heightPercentage}%` }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                      className="h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                    />
                  </div>
                  
                  {option.is_correct && (
                    <div className="mt-2 text-center">
                      <span className="text-green-400 text-xs font-medium">✓ CORRECT</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Status indicator */}
      <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm rounded-lg p-2 border border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-green-400 text-xs font-medium">LIVE</span>
        </div>
      </div>
    </motion.div>
  );
};

export const DisplayPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const { applyTheme, resetTheme } = useTheme();

  // Improved logic to find the current active activity
  const activeActivity = React.useMemo(() => {
    if (!currentRoom) return null;
    
    console.log('DisplayPage: Analyzing active activity...', {
      roomCurrentActivityId: currentRoom.current_activity_id,
      totalActivities: currentRoom.activities?.length || 0,
      activitiesWithFlags: currentRoom.activities?.map(a => ({
        id: a.id,
        title: a.title,
        isActive: a.is_active,
        optionsCount: a.options?.length || 0,
        totalResponses: a.total_responses || 0
      })) || []
    });
    
    // Priority 1: Check room.current_activity_id first (most authoritative)
    if (currentRoom.current_activity_id) {
      const currentActivity = currentRoom.activities?.find(a => 
        a.id === currentRoom.current_activity_id
      ) as Activity | undefined;
      
      if (currentActivity) {
        // Don't require is_active flag to match - trust the room's current_activity_id
        console.log('DisplayPage: Found activity via current_activity_id:', {
          id: currentActivity.id,
          title: currentActivity.title,
          isActive: currentActivity.is_active,
          optionsCount: currentActivity.options?.length || 0,
          totalResponses: currentActivity.total_responses || 0,
          options: currentActivity.options?.map(opt => ({
            id: opt.id,
            text: opt.text,
            responses: opt.responses || 0
          })) || [],
          trustingRoomSetting: true
        });
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
      console.log('DisplayPage: Loading room data for code:', pollId, forceRefresh ? '(forced refresh)' : '(normal load)');

      const room = await roomService.getRoomByCode(pollId);
      
      if (room) {
        console.log('DisplayPage: Room loaded successfully:', {
          id: room.id,
          name: room.name,
          activities: room.activities?.length || 0,
          currentActivityId: room.current_activity_id,
          participants: room.participants
        });

        setCurrentRoom(room);
      } else {
        console.log('DisplayPage: Room not found for code:', pollId);
        setCurrentRoom(null);
      }
    } catch (error) {
      console.error('DisplayPage: Error loading room:', error);
      setCurrentRoom(null);
    }
  }, [pollId]);

  // Initialize room on mount
  useEffect(() => {
    const initializeRoom = async () => {
      setLoading(true);
      await loadRoom(true);
      setLoading(false);
    };

    initializeRoom();
  }, [loadRoom]);

  // Apply room theme when room loads
  useEffect(() => {
    if (currentRoom?.settings) {
      applyTheme(currentRoom.settings);
    } else {
      resetTheme();
    }
    
    return () => {
      resetTheme();
    };
  }, [currentRoom?.settings, applyTheme, resetTheme]);

  // Minimal real-time subscription - only for critical changes
  useEffect(() => {
    if (!pollId || !supabase) return;

    let mounted = true;
    let lastUpdateTime = Date.now();
    console.log('DisplayPage: Setting up minimal real-time subscription for room code:', pollId);

    // Create one channel with a simple, consistent name
    const channel = supabase.channel(`display_${pollId}`);

    // Subscribe to room changes for current_activity_id ONLY
    channel
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'rooms',
          filter: `code=eq.${pollId}`
        },
        async (payload) => {
          if (!mounted) return;
          
          // Throttle updates - only allow one update per 2 seconds
          const now = Date.now();
          if (now - lastUpdateTime < 2000) {
            console.log('DisplayPage: Throttling room update');
            return;
          }
          
          // Only reload if current_activity_id actually changed
          const oldActivityId = payload.old?.current_activity_id;
          const newActivityId = payload.new?.current_activity_id;
          
          if (oldActivityId !== newActivityId) {
            console.log('DisplayPage: Activity changed from', oldActivityId, 'to', newActivityId);
            lastUpdateTime = now;
            
            try {
              const room = await roomService.getRoomByCode(pollId);
              if (room && mounted) {
                setCurrentRoom(room);
              }
            } catch (error) {
              console.error('DisplayPage: Error updating room:', error);
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('DisplayPage: Subscription error:', err);
        } else {
          console.log('DisplayPage: Subscription status:', status);
        }
      });

    return () => {
      mounted = false;
      console.log('DisplayPage: Cleaning up subscription');
      channel.unsubscribe();
    };
  }, [pollId]); // Only pollId dependency to prevent re-subscriptions

  // Separate effect for response updates - only when activity is active
  useEffect(() => {
    if (!pollId || !supabase || !activeActivity) return;

    let mounted = true;
    let lastResponseUpdate = Date.now();
    console.log('DisplayPage: Setting up response subscription for active activity:', activeActivity.id);

    const responseChannel = supabase.channel(`responses_${activeActivity.id}`);

    responseChannel
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'participant_responses',
          filter: `activity_id=eq.${activeActivity.id}`
        },
        async (payload) => {
          if (!mounted) return;
          
          // Throttle response updates - only allow one update per 3 seconds
          const now = Date.now();
          if (now - lastResponseUpdate < 3000) {
            console.log('DisplayPage: Throttling response update');
            return;
          }
          
          console.log('DisplayPage: Response update for active activity');
          lastResponseUpdate = now;
          
          try {
            const room = await roomService.getRoomByCode(pollId);
            if (room && mounted) {
              setCurrentRoom(room);
            }
          } catch (error) {
            console.error('DisplayPage: Error updating room after response:', error);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      console.log('DisplayPage: Cleaning up response subscription');
      responseChannel.unsubscribe();
    };
  }, [pollId, activeActivity?.id]); // Only when active activity changes

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'poll': return MessageSquare;
      case 'trivia': return HelpCircle;
      case 'quiz': return Target;
      case 'word_cloud': return Cloud;
      default: return MessageSquare;
    }
  };

  const getActivityTypeLabel = (type: ActivityType) => {
    switch (type) {
      case 'poll': return 'Poll';
      case 'trivia': return 'Trivia';
      case 'quiz': return 'Quiz';
      case 'word_cloud': return 'Word Cloud';
      default: return 'Activity';
    }
  };

  const getRoomStats = () => {
    if (!currentRoom) return null;
    
    const totalActivities = allActivities.length;
    const completedActivities = allActivities.filter(a => !a.is_active && a.total_responses > 0).length;
    const totalResponses = allActivities.reduce((sum, a) => sum + a.total_responses, 0);
    
    return {
      totalActivities,
      completedActivities,
      totalResponses,
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

  // Dashboard Component for when no activity is active
  const Dashboard = () => {
    const stats = getRoomStats();
    if (!stats || !currentRoom) return null;

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
          {/* Stats Overview */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
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
                  <p className="text-2xl font-bold text-white">{stats.totalActivities}</p>
                  <p className="text-slate-400">Total Activities</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700/50">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-purple-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats.completedActivities}</p>
                  <p className="text-slate-400">Completed</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700/50">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-orange-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats.totalResponses}</p>
                  <p className="text-slate-400">Total Responses</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Activity Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700/50 p-6"
          >
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <BarChart className="w-6 h-6 text-blue-400" />
              Activity Overview
            </h2>

            {allActivities.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {allActivities.map((activity, index) => {
                  const Icon = getActivityIcon(activity.type);
                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className="bg-slate-700/50 rounded-lg p-4 border border-slate-600/50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <Icon className="w-5 h-5 text-blue-400 mt-1" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white truncate">{activity.title}</h3>
                            <p className="text-sm text-slate-400">{getActivityTypeLabel(activity.type)}</p>
                            {activity.description && (
                              <p className="text-sm text-slate-500 mt-1 truncate">{activity.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">{activity.total_responses || 0}</p>
                          <p className="text-xs text-slate-400">responses</p>
                        </div>
                      </div>
                      {activity.total_responses > 0 && (
                        <div className="mt-3 bg-slate-600/50 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                            style={{ 
                              width: `${Math.min(100, (activity.total_responses / Math.max(stats.participants, 1)) * 100)}%` 
                            }}
                          />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Target className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                <p className="text-xl text-slate-400 mb-2">No Activities Yet</p>
                <p className="text-slate-500">Activities will appear here when they are created</p>
              </div>
            )}
          </motion.div>

          {/* Waiting Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center mt-8"
          >
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-blue-900/30 border border-blue-600/50 rounded-full">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-blue-200 text-lg">Waiting for activity to start...</span>
            </div>
            
            {/* Debug refresh button */}
            <div className="mt-4">
              <button
                onClick={() => {
                  console.log('DisplayPage: Manual refresh triggered');
                  loadRoom(true);
                }}
                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
              >
                🔄 Refresh Display
              </button>
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

  // Show dashboard when no activity is active
  if (!activeActivity) {
    return <Dashboard />;
  }

  // Show active activity
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
          {/* Header */}
          <div className="p-6 border-b border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  {React.createElement(getActivityIcon(activeActivity.type), {
                    className: "w-8 h-8 text-blue-400"
                  })}
                  <div>
                    <h1 className="text-2xl font-bold text-white">{activeActivity.title}</h1>
                    <p className="text-slate-400">{getActivityTypeLabel(activeActivity.type)} • Room {currentRoom.code}</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-green-600 text-white text-sm rounded-full animate-pulse">
                  LIVE
                </div>
              </div>
              
              <div className="flex items-center gap-6 text-slate-300">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <span>{currentRoom.participants} participants</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart className="w-5 h-5" />
                  <span>{activeActivity.total_responses || 0} responses</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>{formatTime(currentTime)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Content */}
          <div className="flex-1 overflow-hidden">
            <FixedPoll3DVisualization 
              options={activeActivity.options || []} 
              totalResponses={activeActivity.total_responses || 0}
              activityTitle={activeActivity.title}
              activityMedia={activeActivity.media_url}
              themeColors={{
                primaryColor: '#3b82f6',
                secondaryColor: '#8b5cf6', 
                accentColor: '#06b6d4'
              }}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};