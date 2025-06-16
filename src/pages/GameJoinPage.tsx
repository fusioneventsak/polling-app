import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, Play, Target, MessageSquare, HelpCircle, Cloud, Trophy } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { roomService } from '../services/roomService';
import { supabase } from '../lib/supabase';
import { useTheme } from '../components/ThemeProvider';
import type { Room, ActivityType } from '../types';

export const GameJoinPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [joinedRoom, setJoinedRoom] = useState<Room | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { applyTheme, resetTheme } = useTheme();

  // Auto-join if room code is provided in URL
  useEffect(() => {
    const joinedCode = searchParams.get('joined');
    if (joinedCode && !joinedRoom) {
      autoRejoinRoom(joinedCode);
    }
  }, [searchParams, joinedRoom]);

  // Apply theme when room loads
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

  // Clock timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const autoRejoinRoom = async (roomCode: string) => {
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

  // Load room data when joined with enhanced error handling
  const loadJoinedRoom = useCallback(async (forceRefresh = false) => {
    if (!joinedRoom || !supabase) return;
    
    try {
      console.log('GameJoin: Loading joined room data:', joinedRoom.code, forceRefresh ? '(forced)' : '');
      const room = await roomService.getRoomByCode(joinedRoom.code);
      if (room) {
        setJoinedRoom(room);
        console.log('GameJoin: Room data updated:', {
          name: room.name,
          participants: room.participants,
          currentActivityId: room.current_activity_id,
          activitiesCount: room.activities?.length
        });
      }
    } catch (error) {
      console.error('GameJoin: Error loading joined room:', error);
    }
  }, [joinedRoom]);

  // Enhanced real-time subscriptions for joined room
  useEffect(() => {
    if (!joinedRoom || !supabase) return;

    console.log('GameJoin: Setting up real-time subscriptions for joined room:', joinedRoom.id);

    // Create a unique channel for this join session
    const channelName = `room-join-${joinedRoom.id}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Subscribe to room changes with immediate navigation
    channel.on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'rooms',
        filter: `id=eq.${joinedRoom.id}`
      },
      async (payload) => {
        console.log('GameJoin: Room change received:', {
          eventType: payload.eventType,
          oldCurrentActivityId: payload.old?.current_activity_id,
          newCurrentActivityId: payload.new?.current_activity_id
        });
        
        // Check if a new activity was started
        if (payload.eventType === 'UPDATE' && 
            payload.new?.current_activity_id && 
            payload.new?.current_activity_id !== payload.old?.current_activity_id) {
          console.log('GameJoin: New activity started, navigating to:', payload.new.current_activity_id);
          navigate(`/vote/${payload.new.current_activity_id}`);
          return;
        }
        
        // Update room data immediately
        await loadJoinedRoom(true);
      }
    );

    // Subscribe to activity changes for this room with immediate navigation
    channel.on('postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'activities',
        filter: `room_id=eq.${joinedRoom.id}`
      },
      async (payload) => {
        console.log('GameJoin: Activity change received:', {
          eventType: payload.eventType,
          activityId: payload.new?.id || payload.old?.id,
          oldIsActive: payload.old?.is_active,
          newIsActive: payload.new?.is_active
        });
        
        // Auto-navigate to newly started activity
        if (payload.eventType === 'UPDATE' && payload.new?.is_active === true && payload.old?.is_active === false) {
          console.log('GameJoin: Activity started, navigating to vote page:', payload.new.id);
          navigate(`/vote/${payload.new.id}`);
          return;
        }
        
        // Update room data immediately
        await loadJoinedRoom(true);
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
        console.log('GameJoin: Activity options change received:', payload);
        // Check if this option belongs to an activity in our room
        if (joinedRoom.activities?.some(a => 
          a.options?.some(o => o.id === payload.old?.id || o.id === payload.new?.id)
        )) {
          await loadJoinedRoom(true);
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
        console.log('GameJoin: Response change received:', payload);
        await loadJoinedRoom(true);
      }
    );

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      console.log('GameJoin: Subscription status:', status);
      if (err) {
        console.error('GameJoin: Subscription error:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ GameJoin: Real-time subscriptions active');
      }
    });

    return () => {
      console.log('GameJoin: Cleaning up subscriptions');
      channel.unsubscribe();
    };
  }, [joinedRoom?.id, navigate, loadJoinedRoom]);

  // Auto-navigate to active activity when room is first loaded
  useEffect(() => {
    if (joinedRoom) {
      const activeActivity = joinedRoom.activities?.find(a => a.is_active);
      if (activeActivity) {
        console.log('GameJoin: Found active activity on room load, navigating:', activeActivity.id);
        navigate(`/vote/${activeActivity.id}`);
      }
    }
  }, [joinedRoom?.id, navigate]);

  // Also check for activity changes when activities array updates
  useEffect(() => {
    if (joinedRoom?.activities) {
      const activeActivity = joinedRoom.activities.find(a => a.is_active);
      if (activeActivity) {
        console.log('GameJoin: Active activity detected, navigating:', activeActivity.id);
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

  const handleLeaveRoom = () => {
    if (joinedRoom) {
      // Decrement participant count
      roomService.updateRoom(joinedRoom.id, { 
        participants: Math.max(0, joinedRoom.participants - 1) 
      }).catch(console.error);
    }
    
    setJoinedRoom(null);
    setCode('');
    resetTheme();
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

  if (joinedRoom) {
    const themeColors = {
      primary: joinedRoom.settings?.theme?.primary_color || '#3B82F6',
      secondary: joinedRoom.settings?.theme?.secondary_color || '#1E40AF',
      accent: joinedRoom.settings?.theme?.accent_color || '#60A5FA',
      text: joinedRoom.settings?.theme?.text_color || '#FFFFFF'
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">{joinedRoom.name}</h1>
              {joinedRoom.description && (
                <p className="text-slate-300 mt-2">{joinedRoom.description}</p>
              )}
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-slate-300">
                <Users className="w-5 h-5" style={{ color: themeColors.accent }} />
                <span>{joinedRoom.participants} participants</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-5 h-5" style={{ color: themeColors.accent }} />
                <span className="font-mono">{currentTime.toLocaleTimeString()}</span>
              </div>
              <Button
                onClick={handleLeaveRoom}
                variant="secondary"
                className="bg-red-600/20 hover:bg-red-600/30 text-red-400"
              >
                Leave Room
              </Button>
            </div>
          </div>

          {/* Current Activity Status */}
          <AnimatePresence mode="wait">
            {joinedRoom.current_activity_id ? (
              <motion.div
                key="active-activity"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-8 p-6 bg-green-500/10 border border-green-500/20 rounded-lg"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-400 font-medium text-lg">Activity in Progress</span>
                </div>
                
                {(() => {
                  const currentActivity = joinedRoom.activities?.find(a => a.id === joinedRoom.current_activity_id);
                  return currentActivity ? (
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-2">{currentActivity.title}</h2>
                      {currentActivity.description && (
                        <p className="text-slate-300 mb-4">{currentActivity.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          {getActivityTypeLabel(currentActivity.type)}
                        </span>
                        <span>{currentActivity.total_responses} responses</span>
                        <span>{currentActivity.options?.length || 0} options</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-white">
                      <p className="text-lg">Loading activity details...</p>
                    </div>
                  );
                })()}
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center mb-8 p-8"
              >
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{ backgroundColor: `${themeColors.primary}20` }}
                >
                  <Play className="w-10 h-10" style={{ color: themeColors.primary }} />
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-4">
                  Waiting for the next activity
                </h2>
                
                <p className="text-slate-300 text-lg">
                  The presenter will start an activity soon. You'll be automatically redirected when it begins.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Room Statistics */}
          {joinedRoom.activities && joinedRoom.activities.length > 0 && (
            <Card className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Trophy className="w-5 h-5" style={{ color: themeColors.accent }} />
                Room Activity Summary
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2" style={{ color: themeColors.accent }}>
                    {joinedRoom.activities.length}
                  </div>
                  <div className="text-slate-400">Total Activities</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2" style={{ color: themeColors.accent }}>
                    {joinedRoom.activities.filter(a => a.total_responses > 0).length}
                  </div>
                  <div className="text-slate-400">Completed</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2" style={{ color: themeColors.accent }}>
                    {joinedRoom.activities.reduce((sum, a) => sum + a.total_responses, 0)}
                  </div>
                  <div className="text-slate-400">Total Responses</div>
                </div>
              </div>

              {/* Activity List */}
              <div className="space-y-3">
                {joinedRoom.activities.slice(0, 5).map((activity) => {
                  const Icon = getActivityIcon(activity.type);
                  const isCompleted = activity.total_responses > 0 && !activity.is_active;
                  
                  return (
                    <div
                      key={activity.id}
                      className={`p-4 rounded-lg border ${
                        activity.is_active
                          ? 'bg-green-500/10 border-green-500/30'
                          : isCompleted
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-slate-800/50 border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5" style={{ color: themeColors.accent }} />
                          <div>
                            <h4 className="font-medium text-white">{activity.title}</h4>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <span>{getActivityTypeLabel(activity.type)}</span>
                              <span>•</span>
                              <span>{activity.total_responses} responses</span>
                            </div>
                          </div>
                        </div>
                        
                        {activity.is_active && (
                          <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            LIVE
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {joinedRoom.activities.length > 5 && (
                  <div className="text-center text-slate-400 text-sm">
                    ... and {joinedRoom.activities.length - 5} more activities
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Room Code Display */}
          <div className="text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-slate-400">Room Code:</span>
              <span className="text-2xl font-mono font-bold" style={{ color: themeColors.accent }}>
                {joinedRoom.code}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Join Room</h1>
          <p className="text-slate-400">Enter the 4-digit room code to join</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-slate-300 mb-2">
              Room Code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="1234"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={4}
              autoComplete="off"
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
            >
              <p className="text-red-400 text-sm text-center">{error}</p>
            </motion.div>
          )}

          <Button
            type="submit"
            disabled={code.length !== 4 || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Joining...
              </div>
            ) : (
              'Join Room'
            )}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-400 text-sm">
            Don't have a room code? Ask your presenter for the 4-digit code.
          </p>
        </div>
      </Card>
    </div>
  );
};