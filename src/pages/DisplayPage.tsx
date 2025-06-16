import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { roomService } from '../services/roomService';
import { useTheme } from '../components/ThemeProvider';
import { Poll3DVisualization } from '../components/Poll3DVisualization';
import { Users, BarChart, Clock, MessageSquare, HelpCircle, Cloud, Trophy, Target } from 'lucide-react';
import type { ActivityType, Room } from '../types';

export const DisplayPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const { applyTheme, resetTheme } = useTheme();

  // Find the current active activity - use both is_active flag and current_activity_id for redundancy
  const activeActivity = currentRoom?.activities?.find(a => a.is_active) || 
                        (currentRoom?.current_activity_id ? 
                         currentRoom.activities?.find(a => a.id === currentRoom.current_activity_id) : 
                         null);
  const allActivities = currentRoom?.activities || [];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load initial room data
  const loadRoom = async () => {
    if (!pollId || !supabase) return;
    
    try {
      console.log('DisplayPage: Loading room data for code:', pollId);
      const room = await roomService.getRoomByCode(pollId);
      setCurrentRoom(room);
      
      console.log('DisplayPage: Loaded room data:', {
        roomName: room?.name,
        currentActivityId: room?.current_activity_id,
        currentActivityType: room?.current_activity_type,
        activitiesCount: room?.activities?.length
      });
      
      // Debug log the active activity and its options
      if (room?.activities) {
        const activeByFlag = room.activities.find(a => a.is_active);
        const activeByCurrent = room.current_activity_id ? 
          room.activities.find(a => a.id === room.current_activity_id) : null;
        
        console.log('DisplayPage: Activity status check:', {
          activeByFlag: activeByFlag ? { id: activeByFlag.id, title: activeByFlag.title, is_active: activeByFlag.is_active } : null,
          activeByCurrent: activeByCurrent ? { id: activeByCurrent.id, title: activeByCurrent.title, is_active: activeByCurrent.is_active } : null,
          roomCurrentActivityId: room.current_activity_id
        });
        
        const finalActiveActivity = activeByFlag || activeByCurrent;
        if (finalActiveActivity) {
          console.log('DisplayPage: Found active activity:', {
            id: finalActiveActivity.id,
            title: finalActiveActivity.title,
            type: finalActiveActivity.type,
            options: finalActiveActivity.options?.length || 0,
            totalResponses: finalActiveActivity.total_responses
          });
        } else {
          console.log('DisplayPage: No active activity found');
        }
      }
    } catch (error) {
      console.error('DisplayPage: Error loading room:', error);
    }
  };

  useEffect(() => {
    const initializeRoom = async () => {
      setLoading(true);
      await loadRoom();
      setLoading(false);
    };

    initializeRoom();
  }, [pollId]);

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

  // Set up real-time subscriptions with better logging
  useEffect(() => {
    if (!pollId || !currentRoom || !supabase) return;

    console.log('DisplayPage: Setting up real-time subscriptions for room:', currentRoom.id);

    // Create a unique channel for this display session
    const channelName = `room-display-${currentRoom.id}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Subscribe to room changes
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
        
        // Add a small delay to ensure database consistency
        setTimeout(async () => {
          await loadRoom();
        }, 100);
      }
    );

    // Subscribe to activity changes for this room
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
        
        // Add a small delay to ensure database consistency
        setTimeout(async () => {
          await loadRoom();
        }, 100);
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
        // Add a small delay to ensure database consistency
        setTimeout(async () => {
          await loadRoom();
        }, 100);
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
        // Add a small delay to ensure database consistency
        setTimeout(async () => {
          await loadRoom();
        }, 100);
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
  }, [pollId, currentRoom?.id]);

  // Add a periodic refresh to ensure we don't miss updates
  useEffect(() => {
    if (!currentRoom) return;
    
    const interval = setInterval(async () => {
      console.log('DisplayPage: Periodic refresh');
      await loadRoom();
    }, 10000); // Refresh every 10 seconds as a backup

    return () => clearInterval(interval);
  }, [currentRoom?.id]);

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
    primary: currentRoom.settings?.theme?.primary_color || '#1e293b',
    secondary: currentRoom.settings?.theme?.secondary_color || '#334155',
    accent: currentRoom.settings?.theme?.accent_color || '#06b6d4',
    background: currentRoom.settings?.theme?.background_gradient || 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    text: currentRoom.settings?.theme?.text_color || '#ffffff'
  };

  const themeStyles = {
    background: themeColors.background,
    color: themeColors.text
  };

  return (
    <div 
      className="h-screen w-screen overflow-hidden relative flex flex-col"
      style={themeStyles}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: themeColors.accent }}
              ></div>
              <span className="text-sm font-medium opacity-75">
                Live • Room {currentRoom.code}
              </span>
            </div>
            <div className="text-sm opacity-75">
              {currentTime.toLocaleTimeString()}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: themeColors.accent }} />
              <span className="text-sm font-medium">
                {currentRoom.participants} participants
              </span>
            </div>
            {activeActivity && (
              <div className="flex items-center gap-2">
                <BarChart className="w-4 h-4" style={{ color: themeColors.accent }} />
                <span className="text-sm font-medium">
                  {activeActivity.total_responses} responses
                </span>
              </div>
            )}
            {/* Debug info - remove in production */}
            <div className="text-xs opacity-50 bg-black/20 px-2 py-1 rounded">
              Active: {activeActivity ? activeActivity.title : 'None'} | 
              Current ID: {currentRoom.current_activity_id || 'None'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6 pt-20">
        <AnimatePresence mode="wait">
          {activeActivity ? (
            /* Active Activity Display */
            <motion.div
              key={`activity-${activeActivity.id}`}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-7xl h-full flex flex-col"
            >
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  {React.createElement(getActivityIcon(activeActivity.type), {
                    className: "w-8 h-8",
                    style: { color: themeColors.accent }
                  })}
                  <span 
                    className="px-3 py-1 rounded-full text-sm font-medium"
                    style={{ 
                      backgroundColor: `${themeColors.accent}20`, 
                      color: themeColors.accent,
                      border: `1px solid ${themeColors.accent}40`
                    }}
                  >
                    {getActivityTypeLabel(activeActivity.type)} • Live
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: themeColors.text }}>
                  {activeActivity.title}
                </h1>
                {activeActivity.description && (
                  <p className="text-lg opacity-75 max-w-3xl mx-auto" style={{ color: themeColors.text }}>
                    {activeActivity.description}
                  </p>
                )}
              </div>

              <div className="flex-1 flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="w-full h-full max-h-[600px]"
                >
                  {activeActivity.media_url && (
                    <div className="mb-6 flex justify-center">
                      <img
                        src={activeActivity.media_url}
                        alt="Activity media"
                        className="max-w-md max-h-64 object-contain rounded-lg shadow-lg"
                      />
                    </div>
                  )}
                  <Poll3DVisualization
                    options={activeActivity.options || []}
                    totalResponses={activeActivity.total_responses}
                    themeColors={themeColors}
                    className="h-full"
                  />
                </motion.div>
              </div>
            </motion.div>
          ) : (
            /* Room Overview - No Active Activity */
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="h-full flex flex-col items-center justify-center text-center"
            >
              <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                  <div className="w-24 h-24 bg-slate-800/50 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                    <Users className="w-12 h-12" style={{ color: themeColors.accent }} />
                  </div>
                  <h2 className="text-4xl font-bold mb-3" style={{ color: themeColors.text }}>
                    Welcome to {currentRoom.name}
                  </h2>
                  <p className="text-lg mb-6 opacity-75" style={{ color: themeColors.text }}>
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};