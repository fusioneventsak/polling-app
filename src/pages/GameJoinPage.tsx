import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { roomService } from '../services/roomService';
import { useTheme } from '../components/ThemeProvider';
import { Users, Target, Clock, CheckCircle, ArrowRight, Loader2, AlertCircle, Home } from 'lucide-react';
import { Card } from '../components/Card';
import type { Room, ActivityType } from '../types';

function GameJoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { applyTheme, resetTheme } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [joinedRoom, setJoinedRoom] = useState<Room | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const subscriptionRef = useRef<any>(null);

  // Check for code in URL params
  useEffect(() => {
    const urlCode = searchParams.get('code');
    const joinedCode = searchParams.get('joined');
    
    if (urlCode && !joinedRoom) {
      setCode(urlCode);
      // Auto-join if code is provided in URL
      handleSubmitWithCode(urlCode);
    } else if (joinedCode) {
      // User is returning to a previously joined room
      loadJoinedRoom(joinedCode);
    }
  }, [searchParams]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadJoinedRoom = useCallback(async (roomCode: string) => {
    try {
      setLoading(true);
      const room = await roomService.getRoomByCode(roomCode);
      if (room) {
        setJoinedRoom(room);
        // Store current room code
        localStorage.setItem('currentRoomCode', roomCode);
      } else {
        setError('Room no longer exists or has been deactivated');
        // Clean up invalid room from URL
        navigate('/game', { replace: true });
      }
    } catch (err) {
      console.error('Failed to load joined room:', err);
      setError('Failed to load room');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Check and clean voting status
  const checkAndCleanVotingStatus = useCallback(() => {
    if (!joinedRoom?.activities) return;
    
    try {
      const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
      const currentActivityIds = joinedRoom.activities.map(a => a.id);
      
      // Remove any voted activities that no longer exist in the room
      const validVotedActivities = votedActivities.filter((id: string) => 
        currentActivityIds.includes(id)
      );
      
      if (validVotedActivities.length !== votedActivities.length) {
        localStorage.setItem('votedActivities', JSON.stringify(validVotedActivities));
        console.log('GameJoin: Cleaned up invalid voted activities');
      }
    } catch (error) {
      console.error('GameJoin: Error cleaning voting status:', error);
    }
  }, [joinedRoom?.activities]);

  // SIMPLIFIED: Listen to custom events from global subscription
  useEffect(() => {
    if (!joinedRoom?.id) return;

    console.log('🎧 GameJoin: Setting up custom event listeners for room:', joinedRoom.id);

    const handleRoomUpdate = (event: CustomEvent<{ roomId: string; roomCode?: string }>) => {
      console.log('🏠 GameJoin: Room update event received:', event.detail);
      if (event.detail.roomId === joinedRoom.id) {
        // Room was reset - clear voting status
        console.log('GameJoin: Room reset detected - clearing localStorage votes');
        if (joinedRoom.activities) {
          const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
          const roomActivityIds = joinedRoom.activities.map(a => a.id);
          const filteredVotes = votedActivities.filter((id: string) => !roomActivityIds.includes(id));
          localStorage.setItem('votedActivities', JSON.stringify(filteredVotes));
        }
        loadJoinedRoom(joinedRoom.code);
      }
    };

    const handleActivityUpdate = (event: CustomEvent<{ activityId: string; roomId: string; isActive?: boolean }>) => {
      console.log('🎯 GameJoin: Activity update event received:', event.detail);
      if (event.detail.roomId === joinedRoom.id) {
        loadJoinedRoom(joinedRoom.code);
        
        // Navigate to active activity if one becomes active
        if (event.detail.isActive === true) {
          console.log('GameJoin: Activity activated, navigating:', event.detail.activityId);
          navigate(`/vote/${event.detail.activityId}`);
        }
      }
    };

    // Add event listeners
    window.addEventListener('room-updated', handleRoomUpdate);
    window.addEventListener('activity-updated', handleActivityUpdate);

    return () => {
      console.log('🧹 GameJoin: Cleaning up event listeners');
      window.removeEventListener('room-updated', handleRoomUpdate);
      window.removeEventListener('activity-updated', handleActivityUpdate);
    };
  }, [joinedRoom?.id, navigate, loadJoinedRoom, joinedRoom?.code, joinedRoom?.activities]);

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

  // Clean up voting status when room changes
  useEffect(() => {
    checkAndCleanVotingStatus();
    
    // Apply room theme when room loads
    if (joinedRoom?.settings) {
      applyTheme(joinedRoom.settings);
    } else {
      resetTheme();
    }
  }, [checkAndCleanVotingStatus]);

  // Cleanup theme on unmount
  useEffect(() => {
    return () => {
      resetTheme();
    };
  }, [resetTheme]);

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
      
      // Store current room code
      localStorage.setItem('currentRoomCode', roomCode);

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
        return Target; // Using Target for consistency
      case 'quiz':
        return Target;
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

  const handleLeaveRoom = () => {
    setJoinedRoom(null);
    resetTheme();
    localStorage.removeItem('currentRoomCode');
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    navigate('/game', { replace: true });
  };

  if (joinedRoom) {
    const themeColors = {
      primary: joinedRoom.settings?.theme?.primary_color || '#3b82f6',
      secondary: joinedRoom.settings?.theme?.secondary_color || '#06b6d4',
      accent: joinedRoom.settings?.theme?.accent_color || '#8b5cf6'
    };

    const backgroundStyle = joinedRoom.settings?.theme?.background_gradient 
      ? {
          background: `linear-gradient(to bottom right, ${joinedRoom.settings.theme.background_gradient.replace('from-', '').replace('via-', '').replace('to-', '').split(' ').map(color => {
            const colorMap: { [key: string]: string } = {
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
        }
      : {};

    return (
      <div 
        className="min-h-screen"
        style={backgroundStyle.background ? backgroundStyle : { background: 'linear-gradient(to bottom right, #0f172a, #1e3a8a, #0f172a)' }}
      >
        <div className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            {/* Room Header */}
            <Card className="p-8 mb-8 text-center relative">
              <button
                onClick={handleLeaveRoom}
                className="absolute top-4 right-4 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-white transition-colors"
                title="Leave Room"
              >
                <Home className="w-5 h-5" />
              </button>

              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="mb-6"
              >
                <div 
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
                  style={{
                    background: `linear-gradient(to bottom right, ${themeColors.primary}, ${themeColors.accent})`
                  }}
                >
                  <Users className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-2">{joinedRoom.name}</h1>
                <p className="text-xl text-slate-400">Room Code: {joinedRoom.code}</p>
                {joinedRoom.settings?.branding?.organization_name && (
                  <p className="text-lg text-slate-300 mt-2">
                    by {joinedRoom.settings.branding.organization_name}
                  </p>
                )}
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
                  {joinedRoom.activities.map((activity, index) => {
                    const Icon = getActivityIcon(activity.type);
                    const hasVoted = getActivityVotingStatus(activity.id);
                    const isActive = activity.is_active;
                    const isLocked = activity.settings?.voting_locked;

                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`
                          relative p-6 rounded-lg border-2 transition-all duration-300
                          ${isActive 
                            ? 'border-green-500 bg-green-900/20' 
                            : 'border-slate-600 bg-slate-800/50'
                          }
                        `}
                      >
                        {/* Activity Status Indicators */}
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                          {isActive && (
                            <span className="px-2 py-1 bg-green-600 text-green-100 text-xs rounded-full font-medium animate-pulse">
                              Live
                            </span>
                          )}
                          {hasVoted && (
                            <span className="px-2 py-1 bg-blue-600 text-blue-100 text-xs rounded-full font-medium flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Voted
                            </span>
                          )}
                          {isLocked && (
                            <span className="px-2 py-1 bg-red-600/20 border border-red-600/30 text-red-400 text-xs rounded-full font-medium">
                              Locked
                            </span>
                          )}
                        </div>

                        <div className="flex items-start gap-4">
                          <div className={`
                            w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
                            ${isActive ? 'bg-green-600' : 'bg-slate-600'}
                          `}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-white mb-2">
                              {activity.title}
                            </h3>
                            
                            {activity.description && (
                              <p className="text-slate-300 mb-4">
                                {activity.description}
                              </p>
                            )}

                            {activity.media_url && (
                              <div className="mb-4">
                                <img
                                  src={activity.media_url}
                                  alt="Activity media"
                                  className="max-w-xs rounded-lg shadow-md"
                                />
                              </div>
                            )}
                            
                            <div className="flex items-center gap-6 text-sm text-slate-400">
                              <span>{getActivityTypeLabel(activity.type)}</span>
                              <span>{activity.options?.length || 0} options</span>
                              <span>{activity.total_responses || 0} responses</span>
                            </div>
                          </div>
                          
                          {isActive && !hasVoted && !isLocked && (
                            <button
                              onClick={() => navigate(`/vote/${activity.id}`)}
                              className="px-6 py-3 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                              style={{
                                backgroundColor: themeColors.accent,
                                filter: 'brightness(1.1)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.filter = 'brightness(1.2)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.filter = 'brightness(1.1)';
                              }}
                            >
                              Vote Now
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          )}
                          
                          {isActive && hasVoted && (
                            <button
                              onClick={() => navigate(`/vote/${activity.id}`)}
                              className="px-6 py-3 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                              style={{
                                backgroundColor: themeColors.primary,
                                filter: 'brightness(1.1)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.filter = 'brightness(1.2)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.filter = 'brightness(1.1)';
                              }}
                            >
                              View Results
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Target className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                  <p className="text-xl text-slate-400 mb-2">No Activities Yet</p>
                  <p className="text-slate-500">
                    Activities will appear here when the presenter creates them
                  </p>
                </div>
              )}
            </Card>

            {/* Display Link */}
            <Card className="p-6 mt-6 text-center">
              <p className="text-slate-400 mb-4">
                View live results on the display page:
              </p>
              <div className="inline-block px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg">
                <code className="text-sm" style={{ color: themeColors.primary }}>
                  {window.location.origin}/display/{joinedRoom.code}
                </code>
              </div>
              {joinedRoom.settings?.branding?.show_powered_by !== false && (
                <p className="text-xs text-slate-500 mt-4">
                  Powered by PollStream
                </p>
              )}
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Join Room</h1>
          <p className="text-slate-400">
            Enter the 4-digit room code to participate
          </p>
        </motion.div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-slate-300 mb-2">
                Room Code
              </label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={(e) => {
                  // Only allow digits and limit to 4 characters
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setCode(value);
                  if (error) setError('');
                }}
                placeholder="1234"
                maxLength={4}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white text-center text-2xl font-mono tracking-widest placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="off"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-600/30 rounded-lg"
              >
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 4}
              className={`
                w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2
                ${code.length === 4 && !loading
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  Join Room
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-center text-slate-400 text-sm">
              Don't have a room code?{' '}
              <button
                onClick={() => navigate('/admin')}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Create a room
              </button>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

export { GameJoinPage };