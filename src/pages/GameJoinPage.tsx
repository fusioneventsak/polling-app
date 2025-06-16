import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { roomService } from '../services/roomService';
import { supabase } from '../lib/supabase';
import { useTheme } from '../components/ThemeProvider';
import { Users, Clock, Play, Target, MessageSquare, HelpCircle, Cloud, Trophy } from 'lucide-react';
import type { Room, ActivityType } from '../types';

export const GameJoinPage: React.FC = () => {
  const [code, setCode] = useState('');
  const [joinedRoom, setJoinedRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { applyTheme, resetTheme } = useTheme();
  
  // Add participant ID for tracking user responses
  const [participantId] = useState(() => 
    `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  // Check if user was auto-redirected from a joined room
  useEffect(() => {
    const joinedCode = searchParams.get('joined');
    if (joinedCode) {
      setCode(joinedCode);
      // Auto-submit if we have a joined code
      handleSubmitWithCode(joinedCode);
    }
  }, [searchParams]);

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Function to check and clean localStorage voting status after room reset
  const checkAndCleanVotingStatus = useCallback(async () => {
    if (!joinedRoom || !supabase) return;
    
    try {
      console.log('GameJoin: Checking voting status consistency');
      
      // Get current localStorage voted activities
      const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
      
      if (votedActivities.length === 0) {
        return; // Nothing to check
      }
      
      // Get all activity IDs for this room
      const roomActivityIds = joinedRoom.activities?.map(activity => activity.id) || [];
      
      // Check which voted activities belong to this room
      const roomVotedActivities = votedActivities.filter((activityId: string) => 
        roomActivityIds.includes(activityId)
      );
      
      if (roomVotedActivities.length === 0) {
        return; // No votes for this room in localStorage
      }
      
      // Check database for actual responses for these activities
      const { data: responses, error } = await supabase
        .from('participant_responses')
        .select('activity_id')
        .in('activity_id', roomVotedActivities)
        .eq('participant_id', participantId);
      
      if (error) {
        console.error('GameJoin: Error checking responses:', error);
        return;
      }
      
      const dbVotedActivityIds = responses?.map(r => r.activity_id) || [];
      
      // Find localStorage votes that don't exist in database (indicating reset)
      const invalidVotes = roomVotedActivities.filter((activityId: string) => 
        !dbVotedActivityIds.includes(activityId)
      );
      
      if (invalidVotes.length > 0) {
        console.log('GameJoin: Detected room reset - clearing invalid localStorage votes:', invalidVotes);
        
        // Remove invalid votes from localStorage
        const cleanedVotedActivities = votedActivities.filter((activityId: string) => 
          !invalidVotes.includes(activityId)
        );
        
        localStorage.setItem('votedActivities', JSON.stringify(cleanedVotedActivities));
        
        console.log('GameJoin: Cleaned localStorage votes');
      }
      
    } catch (error) {
      console.error('GameJoin: Error checking voting status:', error);
    }
  }, [joinedRoom, participantId]);

  const loadJoinedRoom = useCallback(async (forceRefresh = false) => {
    if (!joinedRoom) return;
    
    try {
      console.log('GameJoin: Loading joined room data', forceRefresh ? '(forced)' : '');
      const room = await roomService.getRoomByCode(joinedRoom.code);
      if (room) {
        setJoinedRoom(room);
        
        // Check and clean voting status after loading room data
        await checkAndCleanVotingStatus();
        
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
  }, [joinedRoom, checkAndCleanVotingStatus]);

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

    // Enhanced participant responses subscription with reset detection
    channel.on('postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'participant_responses',
        filter: `room_id=eq.${joinedRoom.id}`
      },
      async (payload) => {
        console.log('GameJoin: Participant response change received:', {
          eventType: payload.eventType,
          activityId: payload.new?.activity_id || payload.old?.activity_id,
          participantId: payload.new?.participant_id || payload.old?.participant_id
        });
        
        // If this is a DELETE event (could be from room reset), check localStorage consistency
        if (payload.eventType === 'DELETE') {
          console.log('GameJoin: Response deleted - checking for room reset');
          await checkAndCleanVotingStatus();
        }
        
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
  }, [joinedRoom?.id, navigate, loadJoinedRoom, checkAndCleanVotingStatus]);

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

  const handleSubmitWithCode = async (roomCode: string) => {
    if (roomCode.length !== 4) {
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

      const result = await roomService.getRoomByCode(roomCode);
      
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmitWithCode(code);
  };

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

  // Check if any activity has user responses (for display purposes)
  const getActivityVotingStatus = (activityId: string) => {
    const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
    return votedActivities.includes(activityId);
  };

  if (joinedRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            {/* Room Header */}
            <Card className="p-8 mb-8 text-center">
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="mb-6"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
                  <Users className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-2">{joinedRoom.name}</h1>
                <p className="text-xl text-slate-400">Room Code: {joinedRoom.code}</p>
              </motion.div>

              <div className="flex items-center justify-center gap-8 text-slate-300">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <span>{joinedRoom.participants} participants</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  <span>{joinedRoom.activities?.length || 0} activities</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>{currentTime.toLocaleTimeString()}</span>
                </div>
              </div>
            </Card>

            {/* Activities List */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Activities</h2>
              
              {joinedRoom.activities && joinedRoom.activities.length > 0 ? (
                <div className="space-y-4">
                  {joinedRoom.activities
                    .sort((a, b) => a.activity_order - b.activity_order)
                    .map((activity, index) => {
                      const IconComponent = getActivityIcon(activity.type);
                      const hasVoted = getActivityVotingStatus(activity.id);
                      const isActive = activity.is_active;
                      
                      return (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`p-6 rounded-lg border transition-all ${
                            isActive
                              ? 'bg-green-900/30 border-green-600 shadow-lg shadow-green-900/20'
                              : hasVoted
                              ? 'bg-blue-900/30 border-blue-600'
                              : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-lg ${
                                isActive
                                  ? 'bg-green-600/20 text-green-400'
                                  : hasVoted
                                  ? 'bg-blue-600/20 text-blue-400'
                                  : 'bg-slate-700/50 text-slate-400'
                              }`}>
                                <IconComponent className="w-6 h-6" />
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-xl font-semibold text-white">
                                    {activity.title}
                                  </h3>
                                  
                                  {isActive && (
                                    <span className="px-3 py-1 bg-green-600 text-green-100 text-sm rounded-full font-medium animate-pulse">
                                      Live
                                    </span>
                                  )}
                                  
                                  {hasVoted && !isActive && (
                                    <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-sm rounded-full font-medium">
                                      Completed
                                    </span>
                                  )}
                                </div>
                                
                                {activity.description && (
                                  <p className="text-slate-400 mb-3">{activity.description}</p>
                                )}
                                
                                <div className="flex items-center gap-6 text-sm text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <Target className="w-4 h-4" />
                                    {getActivityTypeLabel(activity.type)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="w-4 h-4" />
                                    {activity.options?.length || 0} options
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Trophy className="w-4 h-4" />
                                    {activity.total_responses || 0} responses
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              {isActive && (
                                <Button
                                  onClick={() => navigate(`/vote/${activity.id}`)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Play className="w-4 h-4" />
                                  Join Now
                                </Button>
                              )}
                              
                              {hasVoted && !isActive && (
                                <div className="flex items-center gap-2 text-blue-400">
                                  <Trophy className="w-4 h-4" />
                                  <span className="text-sm font-medium">Voted</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-semibold mb-2">No Activities Yet</h3>
                  <p>The host hasn't created any activities for this room yet.</p>
                  <p className="text-sm mt-2">Check back soon or ask the host to add some activities!</p>
                </div>
              )}
            </Card>

            {/* Waiting for Activity */}
            {(!joinedRoom.current_activity_id && joinedRoom.activities && joinedRoom.activities.length > 0) && (
              <Card className="p-6 mt-6 bg-slate-800/30">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Waiting for Host</h3>
                  <p className="text-slate-400">The host will start an activity soon. Stay tuned!</p>
                </div>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="p-8 text-center">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="mb-8"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Join Room</h1>
            <p className="text-slate-400">Enter the 4-digit room code to participate</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setCode(value);
                }}
                placeholder="Enter room code"
                className="w-full px-4 py-4 text-center text-2xl font-bold bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all tracking-widest"
                maxLength={4}
                autoComplete="off"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={loading || code.length !== 4}
              className="w-full py-4 text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Joining...
                </div>
              ) : (
                'Join Room'
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-700">
            <p className="text-slate-500 text-sm">
              Don't have a room code? Ask the host to share it with you.
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};