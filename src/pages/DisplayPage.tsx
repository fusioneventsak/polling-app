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

  // Find the current active activity or show room overview
  const activeActivity = currentRoom?.activities?.find(a => a.is_active);
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
      const room = await roomService.getRoomByCode(pollId);
      setCurrentRoom(room);
      console.log('Loaded room data:', room);
    } catch (error) {
      console.error('Error loading room:', error);
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

  // Set up real-time subscriptions
  useEffect(() => {
    if (!pollId || !currentRoom || !supabase) return;

    console.log('Setting up real-time subscriptions for room:', currentRoom.id);

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
        console.log('Room change received:', payload);
        await loadRoom();
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
        console.log('Activity change received:', payload);
        await loadRoom();
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
        console.log('Activity options change received:', payload);
        // Reload room data for any option changes (simpler and more reliable)
        await loadRoom();
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
        console.log('Response change received:', payload);
        await loadRoom();
      }
    );

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      console.log('Display subscription status:', status);
      if (err) {
        console.error('Display subscription error:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ Display real-time subscriptions active');
      }
    });

    return () => {
      console.log('Cleaning up display subscriptions');
      channel.unsubscribe();
    };
  }, [pollId, currentRoom?.id]);

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
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="w-24 h-24 bg-slate-800 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <BarChart className="w-12 h-12 text-slate-400 animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Loading...</h1>
          <p className="text-lg text-slate-400">Connecting to room...</p>
        </div>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="w-24 h-24 bg-slate-800 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <BarChart className="w-12 h-12 text-slate-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Service Unavailable</h1>
          <p className="text-lg text-slate-400">Real-time features are not configured.</p>
        </div>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="w-24 h-24 bg-slate-800 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <BarChart className="w-12 h-12 text-slate-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Room Not Found</h1>
          <p className="text-lg text-slate-400">The requested room doesn't exist.</p>
        </div>
      </div>
    );
  }

  const getPercentage = (votes: number, total: number) => {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  };

  // Get theme-aware styles
  const getThemeStyles = () => {
    const settings = currentRoom?.settings;
    if (!settings?.theme) return {};
    
    return {
      background: settings.theme.background_gradient 
        ? `linear-gradient(to bottom right, ${settings.theme.background_gradient.replace('from-', '').replace('via-', '').replace('to-', '').split(' ').map(color => {
            // Convert Tailwind color classes to actual colors
            const colorMap: Record<string, string> = {
              'slate-900': '#0f172a',
              'blue-900': '#1e3a8a',
              'purple-900': '#581c87',
              'green-900': '#14532d',
              'red-900': '#7f1d1d',
              'orange-900': '#7c2d12',
              'gray-900': '#111827',
              'blue-950': '#172554',
              'slate-950': '#020617',
              'black': '#000000',
              'slate-800': '#1e293b'
            };
            return colorMap[color] || color;
          }).join(', ')})`
        : undefined,
      color: settings.theme.text_color
    };
  };

  const themeStyles = getThemeStyles();

  // Get theme colors for 3D visualization
  const getThemeColors = () => {
    const settings = currentRoom?.settings;
    return {
      primaryColor: settings?.theme?.primary_color || '#2563eb',
      secondaryColor: settings?.theme?.secondary_color || '#0891b2',
      accentColor: settings?.theme?.accent_color || '#06b6d4'
    };
  };

  const themeColors = getThemeColors();

  return (
    <div 
      className={`h-screen w-screen overflow-hidden flex flex-col ${
        !currentRoom?.settings?.theme?.background_gradient 
          ? 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900' 
          : ''
      }`}
      style={themeStyles}
    >
      {/* Header - Fixed height */}
      <div className="flex items-center justify-between px-8 py-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <motion.div
            className="px-4 py-2 rounded-xl shadow-xl"
            style={{
              background: currentRoom?.settings?.theme?.primary_color 
                ? `linear-gradient(to right, ${currentRoom.settings.theme.primary_color}, ${currentRoom.settings.theme.secondary_color || currentRoom.settings.theme.primary_color})`
                : 'linear-gradient(to right, #2563eb, #0891b2)'
            }}
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-xl font-mono font-bold text-white">{currentRoom.code}</span>
          </motion.div>
          
          <div className="flex items-center gap-4">
            {currentRoom?.settings?.branding?.logo_url && (
              <img
                src={currentRoom.settings.branding.logo_url}
                alt="Organization logo"
                className="h-8 object-contain"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold" style={{ color: themeStyles.color || '#ffffff' }}>
                {currentRoom.name}
              </h1>
              {currentRoom?.settings?.branding?.organization_name && (
                <p className="text-sm opacity-75" style={{ color: themeStyles.color || '#ffffff' }}>
                  {currentRoom.settings.branding.organization_name}
                </p>
              )}
              {currentRoom.description && (
                <p className="text-sm opacity-75" style={{ color: themeStyles.color || '#ffffff' }}>
                  {currentRoom.description}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6" style={{ color: themeStyles.color || '#ffffff' }}>
          {currentRoom?.settings?.display?.show_participant_count !== false && (
            <div className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5" style={{ color: currentRoom?.settings?.theme?.accent_color || '#06b6d4' }} />
              <span className="font-bold">{currentRoom.participants}</span>
              <span className="text-sm opacity-75">participants</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-lg">
            <BarChart className="w-5 h-5" style={{ color: currentRoom?.settings?.theme?.secondary_color || '#0891b2' }} />
            <span className="font-bold">{allActivities.length}</span>
            <span className="text-sm opacity-75">activities</span>
          </div>

          {currentRoom?.settings?.display?.show_timer !== false && (
            <div className="flex items-center gap-2 text-sm opacity-75">
              <Clock className="w-4 h-4" />
              {currentTime.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area - Flexible height */}
      <div className="flex-1 px-8 pb-4 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeActivity ? (
            /* Active Activity View with 3D Visualization */
            <motion.div
              key={activeActivity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="h-full flex flex-col"
            >
              {/* Activity Header - Fixed height */}
              <div className="text-center mb-6 flex-shrink-0">
                <div className="flex items-center justify-center gap-3 mb-3">
                  {React.createElement(getActivityIcon(activeActivity.type), {
                    className: "w-8 h-8",
                    style: { color: currentRoom?.settings?.theme?.accent_color || '#06b6d4' }
                  })}
                  <div className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm font-semibold">
                    ● LIVE {getActivityTypeLabel(activeActivity.type).toUpperCase()}
                  </div>
                </div>
                
                <h2 className="text-4xl font-bold mb-2 leading-tight" style={{ color: themeStyles.color || '#ffffff' }}>
                  {activeActivity.title}
                </h2>
                
                {activeActivity.description && (
                  <p className="text-lg mb-2 opacity-75" style={{ color: themeStyles.color || '#ffffff' }}>
                    {activeActivity.description}
                  </p>
                )}

                {/* Activity Media */}
                {activeActivity.media_url && (
                  <div className="mb-4">
                    <img
                      src={activeActivity.media_url}
                      alt="Activity media"
                      className="max-w-md max-h-32 object-contain mx-auto rounded-lg border border-slate-600"
                    />
                  </div>
                )}

                <div className="flex items-center justify-center gap-6 text-sm opacity-75" style={{ color: themeStyles.color || '#ffffff' }}>
                  <span>{activeActivity.total_responses} responses</span>
                  <span>•</span>
                  <span>{activeActivity.options?.length || 0} options</span>
                </div>
              </div>

              {/* 3D Visualization - Takes remaining space */}
              <div className="flex-1 min-h-0">
                <Poll3DVisualization
                  options={activeActivity.options || []}
                  totalResponses={activeActivity.total_responses}
                  themeColors={themeColors}
                  className="h-full"
                />
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
                    <Users className="w-12 h-12" style={{ color: currentRoom?.settings?.theme?.accent_color || '#94a3b8' }} />
                  </div>
                  <h2 className="text-4xl font-bold mb-3" style={{ color: themeStyles.color || '#ffffff' }}>
                    Welcome to {currentRoom.name}
                  </h2>
                  <p className="text-lg mb-6 opacity-75" style={{ color: themeStyles.color || '#ffffff' }}>
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
                            <Icon className="w-4 h-4" style={{ color: currentRoom?.settings?.theme?.accent_color || '#06b6d4' }} />
                            <span className="text-xs font-medium text-slate-300">
                              {getActivityTypeLabel(activity.type)}
                            </span>
                            {activity.is_active && (
                              <div className="px-1 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                                LIVE
                              </div>
                            )}
                          </div>
                          
                          <h3 className="text-sm font-semibold text-white mb-2 line-clamp-2">
                            {activity.title}
                          </h3>
                          
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>{totalResponses} responses</span>
                            <span>{activity.options?.length || 0} options</span>
                          </div>
                          
                          {totalResponses > 0 && (
                            <div className="mt-3 space-y-1">
                              {activity.options?.slice(0, 2).map((option) => {
                                const percentage = getPercentage(option.responses, totalResponses);
                                return (
                                  <div key={option.id} className="flex items-center gap-1">
                                    <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-400 w-6">{percentage}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer - Fixed height */}
      <motion.div
        className="text-center py-3 flex-shrink-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <p className="text-lg opacity-75" style={{ color: themeStyles.color || '#ffffff' }}>
          Join at <span className="font-bold" style={{ color: currentRoom?.settings?.theme?.accent_color || '#06b6d4' }}>pollstream.app/game</span> with code <span className="font-mono text-xl" style={{ color: themeStyles.color || '#ffffff' }}>{currentRoom.code}</span>
        </p>
        {currentRoom?.settings?.branding?.show_powered_by !== false && (
          <p className="text-sm opacity-50 mt-1" style={{ color: themeStyles.color || '#ffffff' }}>
            Powered by PollStream
          </p>
        )}
      </motion.div>
    </div>
  );
};