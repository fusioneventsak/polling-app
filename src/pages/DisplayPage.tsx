import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { roomService } from '../services/roomService';
import { useTheme } from '../components/ThemeProvider';
import { Poll3DVisualization } from '../components/Poll3DVisualization';
import { Users, BarChart, Clock, MessageSquare, HelpCircle, Cloud, Trophy, Target, Calendar, Activity as ActivityIcon, TrendingUp, CheckCircle } from 'lucide-react';
import type { ActivityType, Room, Activity } from '../types';

export const DisplayPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const { applyTheme, resetTheme } = useTheme();

  // Improved logic to find the current active activity
  const activeActivity = React.useMemo(() => {
    if (!currentRoom) return null;
    
    // Priority 1: Check room.current_activity_id first (most authoritative)
    if (currentRoom.current_activity_id) {
      const currentActivity = currentRoom.activities?.find(a => 
        a.id === currentRoom.current_activity_id
      ) as Activity | undefined;
      
      // Verify the activity is actually marked as active
      if (currentActivity && currentActivity.is_active) {
        console.log('DisplayPage: Found active activity via current_activity_id:', currentActivity.id, currentActivity.title);
        return currentActivity;
      } else if (currentActivity) {
        console.log('DisplayPage: Warning - current_activity_id points to inactive activity:', currentActivity.id);
      }
    }
    
    // Priority 2: Fallback to any activity marked as active (in case of data inconsistency)
    const flaggedActive = currentRoom.activities?.find(a => a.is_active) as Activity | undefined;
    if (flaggedActive) {
      console.log('DisplayPage: Found active activity via is_active flag (fallback):', flaggedActive.id, flaggedActive.title);
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

  // Load room data with better error handling
  const loadRoom = useCallback(async (forceRefresh = false) => {
    if (!pollId || !supabase) return;
    
    try {
      console.log('DisplayPage: Loading room data for code:', pollId, forceRefresh ? '(forced refresh)' : '(normal load)');
      setLastUpdateTime(new Date());

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

        // Enhanced activity status debugging
        const activeByFlag = room.activities?.filter(a => a.is_active) || [];
        const activeByCurrent = room.current_activity_id ? 
          room.activities?.find(a => a.id === room.current_activity_id) : null;
        
        console.log('DisplayPage: Activity status analysis:', {
          totalActivities: room.activities?.length || 0,
          currentActivityId: room.current_activity_id,
          activeByFlag: activeByFlag.map(a => ({ id: a.id, title: a.title })),
          activeByCurrent: activeByCurrent ? 
            { id: activeByCurrent.id, title: activeByCurrent.title, isActive: activeByCurrent.is_active } : null,
          inconsistency: activeByFlag.length > 1 || 
            (activeByFlag.length === 1 && room.current_activity_id && activeByFlag[0].id !== room.current_activity_id)
        });
      } else {
        console.log('DisplayPage: Room not found for code:', pollId);
        setCurrentRoom(null);
      }
    } catch (error) {
      console.error('DisplayPage: Error loading room:', error);
      setCurrentRoom(null);
    }
  }, [pollId]);

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

  // Enhanced real-time subscriptions with immediate updates
  useEffect(() => {
    if (!pollId || !currentRoom || !supabase) return;

    console.log('DisplayPage: Setting up real-time subscriptions for room:', currentRoom.id);

    // Create a unique channel for this display session
    const channelName = `room-display-${currentRoom.id}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Subscribe to room changes with immediate reload
    channel.on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'rooms',
        filter: `id=eq.${currentRoom.id}`
      },
      async (payload) => {
        console.log('DisplayPage: Room change received:', {
          eventType: payload.eventType,
          oldCurrentActivityId: payload.old?.current_activity_id,
          newCurrentActivityId: payload.new?.current_activity_id,
          oldCurrentActivityType: payload.old?.current_activity_type,
          newCurrentActivityType: payload.new?.current_activity_type
        });
        
        // Immediate reload for room changes - no delay
        await loadRoom(true);
      }
    );

    // Subscribe to activity changes for this room with immediate reload
    channel.on('postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'activities',
        filter: `room_id=eq.${currentRoom.id}`
      },
      async (payload) => {
        console.log('DisplayPage: Activity change received:', {
          eventType: payload.eventType,
          activityId: payload.new?.id || payload.old?.id,
          isActive: payload.new?.is_active,
          title: payload.new?.title || payload.old?.title
        });
        
        // Immediate reload for activity changes
        await loadRoom(true);
      }
    );

    // Subscribe to response changes for activities in this room
    channel.on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'responses'
      },
      async (payload) => {
        // Check if this response belongs to an activity in our room
        const activityId = payload.new?.activity_id || payload.old?.activity_id;
        const roomActivity = currentRoom.activities?.find(a => a.id === activityId);
        
        if (roomActivity) {
          console.log('DisplayPage: Response change for room activity:', {
            eventType: payload.eventType,
            activityId,
            responseId: payload.new?.id || payload.old?.id
          });
          
          // Reload to update response counts
          await loadRoom(true);
        }
      }
    );

    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log('DisplayPage: Subscription status:', status);
    });

    return () => {
      console.log('DisplayPage: Cleaning up real-time subscriptions');
      supabase.removeChannel(channel);
    };
  }, [currentRoom?.id, loadRoom]);

  // Reduced backup periodic refresh since real-time should handle most updates
  useEffect(() => {
    if (!currentRoom) return;
    
    const interval = setInterval(async () => {
      const timeSinceLastUpdate = Date.now() - lastUpdateTime.getTime();
      if (timeSinceLastUpdate > 30000) { // Only refresh if no updates in 30 seconds
        console.log('DisplayPage: Backup periodic refresh (no updates for 30s)');
        await loadRoom(true);
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [currentRoom?.id, lastUpdateTime, loadRoom]);

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
            <Poll3DVisualization activity={activeActivity} />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};