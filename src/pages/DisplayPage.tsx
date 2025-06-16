import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { roomService } from '../services/roomService';
import { useTheme } from '../components/ThemeProvider';
import { Poll3DVisualization } from '../components/Poll3DVisualization';
import { Users, BarChart, Clock, MessageSquare, HelpCircle, Cloud, Trophy, Target, Calendar, Activity } from 'lucide-react';
import type { ActivityType, Room, Activity } from '../types';

export const DisplayPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const { applyTheme, resetTheme } = useTheme();

  // Find the current active activity with improved logic
  const activeActivity = React.useMemo(() => {
    if (!currentRoom) return null;
    
    // First check if there's a room.current_activity_id that matches an active activity
    if (currentRoom.current_activity_id) {
      const currentActivity = currentRoom.activities?.find(a => 
        a.id === currentRoom.current_activity_id && a.is_active
      ) as Activity | undefined;
      if (currentActivity) {
        console.log('DisplayPage: Found active activity via current_activity_id:', currentActivity.id);
        return currentActivity;
      }
    }
    
    // Fallback: Find any activity marked as active
    const flaggedActive = currentRoom.activities?.find(a => a.is_active) as Activity | undefined;
    if (flaggedActive) {
      console.log('DisplayPage: Found active activity via is_active flag:', flaggedActive.id);
      return flaggedActive;
    }
    
    console.log('DisplayPage: No active activity found');
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
      console.log('DisplayPage: Loading room data for code:', pollId, forceRefresh ? '(forced)' : '');
      const room = await roomService.getRoomByCode(pollId);
      
      if (!room) {
        console.error('DisplayPage: Room not found');
        setCurrentRoom(null);
        return;
      }
      
      setCurrentRoom(room);
      setLastUpdateTime(new Date());
      
      console.log('DisplayPage: Loaded room data:', {
        roomName: room.name,
        currentActivityId: room.current_activity_id,
        currentActivityType: room.current_activity_type,
        activitiesCount: room.activities?.length,
        participants: room.participants
      });
      
      // Enhanced activity status debugging
      if (room.activities) {
        const activeByFlag = room.activities.filter(a => a.is_active);
        const activeByCurrent = room.current_activity_id ? 
          room.activities.find(a => a.id === room.current_activity_id) : null;
        
        console.log('DisplayPage: Activity status analysis:', {
          totalActivities: room.activities.length,
          activeByFlag: activeByFlag.map(a => ({ id: a.id, title: a.title })),
          activeByCurrent: activeByCurrent ? { id: activeByCurrent.id, title: activeByCurrent.title } : null,
          roomCurrentActivityId: room.current_activity_id,
          mismatch: activeByFlag.length > 1 || (activeByFlag.length === 1 && activeByFlag[0].id !== room.current_activity_id)
        });
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

  // Enhanced real-time subscriptions
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
        
        // Immediate reload without delay for room changes
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
          activityTitle: payload.new?.title || payload.old?.title,
          oldIsActive: payload.old?.is_active,
          newIsActive: payload.new?.is_active
        });
        
        // Immediate reload without delay for activity changes
        await loadRoom(true);
      }
    );

    // Subscribe to activity options changes
    channel.on('postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'activity_options'
      },
      async (payload) => {
        console.log('DisplayPage: Activity options change received:', payload.eventType);
        
        // Check if this option belongs to an activity in our room
        if (currentRoom.activities?.some(activity => 
          activity.options?.some(option => 
            option.id === payload.old?.id || option.id === payload.new?.id
          )
        )) {
          await loadRoom(true);
        }
      }
    );

    // Subscribe to participant responses
    channel.on('postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'participant_responses',
        filter: `room_id=eq.${currentRoom.id}`
      },
      async (payload) => {
        console.log('DisplayPage: Response change received');
        await loadRoom(true);
      }
    );

    // Subscribe to the channel
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
      channel.unsubscribe();
    };
  }, [currentRoom?.id, loadRoom]);

  // Backup periodic refresh (reduced frequency since we have better real-time)
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
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Room Not Found</h2>
          <p className="text-red-400">Room code "{pollId}" does not exist or is not active.</p>
        </div>
      </div>
    );
  }

  // Get theme colors
  const themeColors = {
    primary: currentRoom.settings?.theme?.primary_color || '#3B82F6',
    secondary: currentRoom.settings?.theme?.secondary_color || '#1E40AF',
    accent: currentRoom.settings?.theme?.accent_color || '#60A5FA',
    text: currentRoom.settings?.theme?.text_color || '#FFFFFF'
  };

  const roomStats = getRoomStats();

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{currentRoom.name}</h1>
            <p className="text-slate-300">{currentRoom.description}</p>
          </div>
          
          <div className="flex items-center gap-6 text-right">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color: themeColors.accent }} />
              <span className="text-white font-medium">{currentRoom.participants}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: themeColors.accent }} />
              <span className="text-white font-mono">
                {currentTime.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="h-full flex items-center justify-center pt-24 pb-16">
        <AnimatePresence mode="wait">
          {activeActivity ? (
            <motion.div
              key={`activity-${activeActivity.id}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-6xl px-6"
            >
              <Poll3DVisualization 
                activity={activeActivity} 
                className="w-full h-full"
              />
              
              {/* Activity Status Badge */}
              <div className="absolute top-24 right-6">
                <div 
                  className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2"
                  style={{ 
                    backgroundColor: `${themeColors.accent}20`,
                    borderColor: themeColors.accent,
                    color: themeColors.accent
                  }}
                >
                  <Activity className="w-4 h-4" />
                  <span>Live: {getActivityTypeLabel(activeActivity.type)}</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="room-stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-4xl px-6"
            >
              <div className="mb-8">
                <div 
                  className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{ backgroundColor: `${themeColors.primary}20` }}
                >
                  <BarChart className="w-12 h-12" style={{ color: themeColors.primary }} />
                </div>
                
                <h2 className="text-4xl font-bold text-white mb-4">
                  {allActivities.length === 0 ? 'Welcome!' : 'Room Statistics'}
                </h2>
                
                {roomStats && allActivities.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
                      <div className="text-3xl font-bold" style={{ color: themeColors.accent }}>
                        {roomStats.totalActivities}
                      </div>
                      <div className="text-slate-300 text-sm">Total Activities</div>
                    </div>
                    
                    <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
                      <div className="text-3xl font-bold" style={{ color: themeColors.accent }}>
                        {roomStats.completedActivities}
                      </div>
                      <div className="text-slate-300 text-sm">Completed</div>
                    </div>
                    
                    <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
                      <div className="text-3xl font-bold" style={{ color: themeColors.accent }}>
                        {roomStats.totalResponses}
                      </div>
                      <div className="text-slate-300 text-sm">Total Responses</div>
                    </div>
                    
                    <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
                      <div className="text-3xl font-bold" style={{ color: themeColors.accent }}>
                        {roomStats.participants}
                      </div>
                      <div className="text-slate-300 text-sm">Participants</div>
                    </div>
                  </div>
                )}
                
                <p className="text-slate-400 text-lg mb-8">
                  {allActivities.length === 0
                    ? "No activities have been created yet. The presenter will start activities soon."
                    : "Waiting for the next activity to begin..."
                  }
                </p>
              </div>

              {/* Activity History/Preview */}
              {allActivities.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-64 overflow-hidden">
                  {allActivities.slice(0, 8).map((activity, index) => {
                    const Icon = getActivityIcon(activity.type);
                    const totalResponses = activity.total_responses;
                    
                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-lg p-4"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Icon className="w-4 h-4" style={{ color: themeColors.accent }} />
                          <span className="text-xs font-medium text-slate-300">
                            {getActivityTypeLabel(activity.type)}
                          </span>
                        </div>
                        <h4 className="font-medium text-white text-sm mb-2 line-clamp-2">
                          {activity.title}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{totalResponses} responses</span>
                          <span>{activity.options?.length || 0} options</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              <div className="mt-8 text-sm opacity-50" style={{ color: themeColors.text }}>
                Join at <span className="font-mono font-bold">{window.location.origin}/game</span> • Code: <span className="font-mono font-bold">{currentRoom.code}</span>
              </div>
              
              {/* Debug info in development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 text-xs text-slate-500">
                  Last update: {lastUpdateTime.toLocaleTimeString()} • Active activity: {activeActivity?.id || 'none'}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};