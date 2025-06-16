import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useTheme } from '../components/ThemeProvider';
import { supabase } from '../lib/supabase';
import { roomService } from '../services/roomService';
import { ArrowRight, Hash, AlertCircle, Users, BarChart, Play, Clock, MessageSquare, HelpCircle, Target, Cloud } from 'lucide-react';
import type { Room, Activity, ActivityType } from '../types';

export const GameJoinPage: React.FC = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState<Room | null>(null);
  const [participantId] = useState(() => 
    `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const { applyTheme, resetTheme } = useTheme();

  // Check if user is returning from a stopped activity
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const joinedCode = urlParams.get('joined');
    
    if (joinedCode && !joinedRoom) {
      // Auto-rejoin the room they were in
      setCode(joinedCode);
      handleAutoRejoin(joinedCode);
    }
  }, []);

  // Apply room theme when joined
  useEffect(() => {
    if (joinedRoom?.settings) {
      applyTheme(joinedRoom.settings);
    } else {
      resetTheme();
    }
    
    return () => {
      resetTheme();
    };
  }, [joinedRoom?.settings, applyTheme, resetTheme]);

  const handleAutoRejoin = async (roomCode: string) => {
    try {
      if (!supabase) return;
      
      const room = await roomService.getRoomByCode(roomCode);
      if (room && room.is_active) {
        setJoinedRoom(room);
        // Clear the URL parameter
        window.history.replaceState({}, '', '/game');
      }
    } catch (error) {
      console.error('Failed to auto-rejoin room:', error);
    }
  };

  const handleCodeChange = (value: string) => {
    // Only allow digits and limit to 4 characters
    const numericValue = value.replace(/\D/g, '').slice(0, 4);
    setCode(numericValue);
    setError('');
  };

  // Load room data when joined
  const loadJoinedRoom = async () => {
    if (!joinedRoom || !supabase) return;
    
    try {
      const room = await roomService.getRoomByCode(joinedRoom.code);
      if (room) {
        setJoinedRoom(room);
      }
    } catch (error) {
      console.error('Error loading joined room:', error);
    }
  };

  // Set up real-time subscriptions for joined room
  useEffect(() => {
    if (!joinedRoom || !supabase) return;

    console.log('Setting up real-time subscriptions for joined room:', joinedRoom.id);

    // Create a unique channel for this join session
    const channelName = `room-join-${joinedRoom.id}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Subscribe to room changes
    channel.on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'rooms',
        filter: `id=eq.${joinedRoom.id}`
      },
      async (payload) => {
        console.log('Room change received:', payload);
        
        // Check if a new activity was started
        if (payload.eventType === 'UPDATE' && 
            payload.new?.current_activity_id && 
            payload.new?.current_activity_id !== payload.old?.current_activity_id) {
          console.log('New activity started, navigating to:', payload.new.current_activity_id);
          navigate(`/vote/${payload.new.current_activity_id}`);
          return;
        }
        
        await loadJoinedRoom();
      }
    );

    // Subscribe to activity changes for this room
    channel.on('postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'activities',
        filter: `room_id=eq.${joinedRoom.id}`
      },
      async (payload) => {
        console.log('Activity change received:', payload);
        
        // Auto-navigate to newly started activity
        if (payload.eventType === 'UPDATE' && payload.new?.is_active === true && payload.old?.is_active === false) {
          console.log('Activity started, navigating to vote page:', payload.new.id);
          navigate(`/vote/${payload.new.id}`);
          return;
        }
        
        await loadJoinedRoom();
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
        // Check if this option belongs to an activity in our room
        if (joinedRoom.activities?.some(a => 
          a.options?.some(o => o.id === payload.old?.id || o.id === payload.new?.id)
        )) {
          await loadJoinedRoom();
        }
      }
    );

    // Subscribe to participant responses
    channel.on('postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'participant_responses',
        filter: `room_id=eq.${joinedRoom.id}`
      },
      async (payload) => {
        console.log('Response change received:', payload);
        await loadJoinedRoom();
      }
    );

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      console.log('Join subscription status:', status);
      if (err) {
        console.error('Join subscription error:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ Join real-time subscriptions active');
      }
    });

    return () => {
      console.log('Cleaning up join subscriptions');
      channel.unsubscribe();
    };
  }, [joinedRoom?.id, navigate]);

  // Auto-navigate to active activity when room is first loaded
  useEffect(() => {
    if (joinedRoom) {
      const activeActivity = joinedRoom.activities?.find(a => a.is_active);
      if (activeActivity) {
        console.log('Found active activity on room load, navigating:', activeActivity.id);
        navigate(`/vote/${activeActivity.id}`);
      }
    }
  }, [joinedRoom?.id, joinedRoom?.activities, navigate]);

  // Also check for activity changes when activities array updates
  useEffect(() => {
    if (joinedRoom?.activities) {
      const activeActivity = joinedRoom.activities.find(a => a.is_active);
      if (activeActivity) {
        console.log('Active activity detected, navigating:', activeActivity.id);
        navigate(`/vote/${activeActivity.id}`);
      }
    }
  }, [joinedRoom?.activities?.map(a => `${a.id}:${a.is_active}`).join(','), navigate]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.length !== 4) {
      setError('Please enter a 4-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!supabase) {
        setError('Real-time features are not available. Please contact the administrator.');
        return;
      }

      const result = await roomService.getRoomByCode(code);
      
      if (!result) {
        setError('Room not found');
        return;
      }

      if (!result.is_active) {
        setError('Room is not active');
        return;
      }

      // Increment participant count
      await roomService.updateRoom(result.id, { 
        participants: result.participants + 1 
      });

      // Set joined room to enable real-time updates
      setJoinedRoom(result);

      // Note: Auto-navigation to active activity is handled by useEffect above
      
    } catch (err) {
      console.error('Failed to join room:', err);
      setError('Failed to join room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  const handleJoinActivity = (activityId: string) => {
    navigate(`/vote/${activityId}`);
  };

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

  // If user has joined a room, show the room waiting area
  if (joinedRoom) {
    const activeActivity = joinedRoom.activities?.find(a => a.is_active);
    const upcomingActivities = joinedRoom.activities?.filter(a => !a.is_active) || [];

    // Get theme-aware styles
    const getThemeStyles = () => {
      const settings = joinedRoom?.settings;
      if (!settings?.theme) return {};
      
      return {
        primaryColor: settings.theme.primary_color || '#2563eb',
        secondaryColor: settings.theme.secondary_color || '#0891b2',
        accentColor: settings.theme.accent_color || '#06b6d4',
        textColor: settings.theme.text_color || '#ffffff'
      };
    };

    const themeStyles = getThemeStyles();

    return (
      <Layout 
        showBackground={!joinedRoom?.settings?.theme?.background_gradient}
        className={joinedRoom?.settings?.theme?.background_gradient ? `bg-gradient-to-br ${joinedRoom.settings.theme.background_gradient}` : ''}
      >
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Room Header */}
            <Card className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <span 
                    className="px-4 py-2 text-white text-lg font-mono rounded-xl"
                    style={{
                      background: `linear-gradient(to right, ${themeStyles.primaryColor}, ${themeStyles.secondaryColor})`
                    }}
                  >
                    {joinedRoom.code}
                  </span>
                  <div className="flex items-center gap-3">
                    {joinedRoom?.settings?.branding?.logo_url && (
                      <div className="relative">
                        <div 
                          className="absolute inset-0 blur-lg opacity-25 rounded-xl"
                          style={{
                            background: `radial-gradient(circle, ${themeStyles.accentColor}30, transparent 70%)`
                          }}
                        />
                        <img
                          src={joinedRoom.settings.branding.logo_url}
                          alt="Organization logo"
                          className="relative h-10 object-contain drop-shadow-lg"
                        />
                      </div>
                    )}
                    <div>
                      <h1 className="text-2xl font-bold text-white">{joinedRoom.name}</h1>
                      {joinedRoom?.settings?.branding?.organization_name && (
                        <p className="text-slate-400 text-sm">
                          {joinedRoom.settings.branding.organization_name}
                        </p>
                      )}
                      {joinedRoom.description && (
                        <p className="text-slate-300">{joinedRoom.description}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-slate-300">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <span>{joinedRoom.participants} participants</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart className="w-5 h-5" />
                    <span>{joinedRoom.activities?.length || 0} activities</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm">Connected - waiting for activities</span>
              </div>
            </Card>

            <AnimatePresence mode="wait">
              {activeActivity ? (
                /* Active Activity Available */
                <motion.div
                  key="active-activity"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className="text-center mb-6 border-2 border-green-500/30 bg-green-500/10">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      {React.createElement(getActivityIcon(activeActivity.type), {
                        className: "w-8 h-8 text-green-400"
                      })}
                      <div className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm font-semibold">
                        ● LIVE {getActivityTypeLabel(activeActivity.type).toUpperCase()}
                      </div>
                    </div>
                    
                    <h2 className="text-2xl font-bold text-white mb-2">
                      {activeActivity.title}
                    </h2>
                    
                    {activeActivity.description && (
                      <p className="text-slate-300 mb-4">{activeActivity.description}</p>
                    )}
                    
                    <div className="flex items-center justify-center gap-6 text-sm text-slate-400 mb-6">
                      <span>{activeActivity.total_responses} responses</span>
                      <span>•</span>
                      <span>{activeActivity.options?.length || 0} options</span>
                    </div>

                    <Button
                      size="lg"
                      onClick={() => handleJoinActivity(activeActivity.id)}
                      className="w-full max-w-md mx-auto"
                    >
                      <Play className="w-5 h-5" />
                      Join {getActivityTypeLabel(activeActivity.type)}
                    </Button>
                  </Card>
                </motion.div>
              ) : (
                /* No Active Activity */
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className="text-center mb-6">
                    <div className="w-16 h-16 bg-slate-700 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                      <Clock className="w-8 h-8 text-slate-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Waiting for Activity</h2>
                    <p className="text-slate-400">
                      {upcomingActivities.length === 0 
                        ? "No activities have been created yet. The presenter will start activities soon."
                        : "The presenter will start the next activity shortly."
                      }
                    </p>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upcoming Activities */}
            {upcomingActivities.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="text-lg font-semibold text-white mb-4">Upcoming Activities</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {upcomingActivities.slice(0, 6).map((activity, index) => {
                    const Icon = getActivityIcon(activity.type);
                    
                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className="opacity-60">
                          <div className="flex items-center gap-3 mb-3">
                            <Icon className="w-5 h-5 text-cyan-400" />
                            <span className="text-sm font-medium text-slate-300">
                              {getActivityTypeLabel(activity.type)}
                            </span>
                            <span className="px-2 py-1 bg-slate-600/50 text-slate-400 text-xs rounded-full">
                              Coming Soon
                            </span>
                          </div>
                          
                          <h4 className="text-white font-semibold mb-2 line-clamp-2">
                            {activity.title}
                          </h4>
                          
                          <div className="flex items-center justify-between text-sm text-slate-400">
                            <span>{activity.options?.length || 0} options</span>
                            <span>#{activity.activity_order}</span>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </Layout>
    );
  }

  // Default join form
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md"
        >
          <Card className="text-center">
            <motion.div
              className="mb-8"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl">
                <Hash className="w-10 h-10 text-white" />
              </div>
            </motion.div>

            <h1 className="text-3xl font-bold text-white mb-2">Join Poll</h1>
            <p className="text-slate-300 mb-8">
              Enter the 4-digit room code to participate
            </p>
            
            {!supabase && (
              <div className="mb-6 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">
                  ⚠️ Real-time features unavailable - Supabase not configured
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <motion.input
                  type="text"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="0000"
                  className="w-full px-6 py-4 text-3xl font-mono text-center bg-slate-700 border-2 border-slate-600 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors tracking-widest"
                  maxLength={4}
                  autoFocus
                  whileFocus={{ scale: 1.02 }}
                />
                
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 mt-3 text-red-400 text-sm"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                loading={loading}
                disabled={code.length !== 4 || !supabase}
                className="w-full"
              >
                {loading ? 'Joining...' : 'Join Room'}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-700">
              <p className="text-slate-400 text-sm">
                Don't have a room code? Ask your presenter or{' '}
                <a href="/admin" className="text-blue-400 hover:text-blue-300 transition-colors">
                  create your own room
                </a>
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
};