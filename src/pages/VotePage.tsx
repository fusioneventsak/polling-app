import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Users, Loader2, Lock } from 'lucide-react';
import { roomService } from '../services/roomService';
import { supabase } from '../lib/supabase';
import { useTheme } from '../components/ThemeProvider';
import type { Activity } from '../types';

export const VotePage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [participantId] = useState(() => 
    `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const { applyTheme, resetTheme } = useTheme();

  const loadActivity = useCallback(async (forceRefresh = false) => {
    if (!pollId || !supabase) return;
    
    try {
      console.log('VotePage: Loading activity', pollId, forceRefresh ? '(forced)' : '');
      const activityData = await roomService.getActivityById(pollId);
      
      if (!activityData) {
        console.log('VotePage: Activity not found:', pollId);
        setActivity(null);
        return;
      }

      // Check if activity is still active
      if (!activityData.is_active) {
        console.log('VotePage: Activity is no longer active:', pollId);
        if (activityData.room?.code) {
          navigate(`/game?joined=${activityData.room.code}`);
        } else {
          navigate('/game');
        }
        return;
      }

      const formattedActivity = {
        ...activityData,
        options: activityData.options?.sort((a, b) => a.option_order - b.option_order) || [],
        room: activityData.room
      };
      
      setActivity(formattedActivity);
      setRoomCode(activityData.room?.code || null);
      
      console.log('VotePage: Activity loaded successfully:', {
        id: formattedActivity.id,
        title: formattedActivity.title,
        type: formattedActivity.type,
        optionsCount: formattedActivity.options.length,
        totalResponses: formattedActivity.total_responses,
        isActive: formattedActivity.is_active,
        votingLocked: formattedActivity.settings?.voting_locked || false
      });
    } catch (error) {
      console.error('VotePage: Error loading activity:', error);
      setActivity(null);
    }
  }, [pollId, navigate]);

  useEffect(() => {
    const initializeActivity = async () => {
      setLoading(true);
      await loadActivity(true);
      setLoading(false);
    };

    initializeActivity();
  }, [loadActivity]);

  // Apply room theme when activity loads
  useEffect(() => {
    if (activity?.room?.settings) {
      applyTheme(activity.room.settings);
    } else {
      resetTheme();
    }
    
    return () => {
      resetTheme();
    };
  }, [activity?.room?.settings, applyTheme, resetTheme]);

  useEffect(() => {
    // Check if user has already voted (localStorage)
    if (pollId) {
      const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
      setHasVoted(votedActivities.includes(pollId));
    }
  }, [pollId]);

  // Enhanced real-time subscriptions
  useEffect(() => {
    if (!pollId || !supabase) return;

    console.log('VotePage: Setting up real-time subscriptions for activity:', pollId);

    // Create a unique channel for this vote session
    const channelName = `activity-vote-${pollId}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Subscribe to all room changes to detect activity switches
    channel.on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'rooms'
      },
      async (payload) => {
        console.log('VotePage: Room change received:', {
          eventType: payload.eventType,
          roomId: payload.new?.id || payload.old?.id,
          oldCurrentActivityId: payload.old?.current_activity_id,
          newCurrentActivityId: payload.new?.current_activity_id
        });
        
        // Only handle changes for our room
        if (activity?.room_id && payload.new?.id === activity.room_id) {
          // Check if a new activity was started
          if (payload.eventType === 'UPDATE' && 
              payload.new?.current_activity_id && 
              payload.new.current_activity_id !== pollId) {
            console.log('VotePage: New activity started, redirecting to:', payload.new.current_activity_id);
            navigate(`/vote/${payload.new.current_activity_id}`);
            return;
          }
          
          // If current activity was cleared, go back to room waiting area
          if (payload.eventType === 'UPDATE' && 
              payload.old?.current_activity_id === pollId && 
              !payload.new?.current_activity_id) {
            console.log('VotePage: Activity ended, redirecting to room waiting area');
            if (roomCode) {
              navigate(`/game?joined=${roomCode}`);
            } else {
              navigate('/game');
            }
            return;
          }
        }
        
        await loadActivity(true);
      }
    );

    // Subscribe to activity changes
    channel.on('postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'activities',
        filter: `id=eq.${pollId}`
      },
      async (payload) => {
        console.log('VotePage: Activity change received:', {
          eventType: payload.eventType,
          activityId: payload.new?.id || payload.old?.id,
          oldIsActive: payload.old?.is_active,
          newIsActive: payload.new?.is_active,
          oldVotingLocked: payload.old?.settings?.voting_locked,
          newVotingLocked: payload.new?.settings?.voting_locked
        });
        
        // If activity was stopped, redirect back to room waiting area
        if (payload.eventType === 'UPDATE' && payload.new?.is_active === false && payload.old?.is_active === true) {
          console.log('VotePage: Activity stopped, redirecting to room waiting area');
          if (roomCode) {
            navigate(`/game?joined=${roomCode}`);
          } else {
            navigate('/game');
          }
          return;
        }
        
        await loadActivity(true);
      }
    );

    // Subscribe to activity options changes
    channel.on('postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'activity_options',
        filter: `activity_id=eq.${pollId}`
      },
      async (payload) => {
        console.log('VotePage: Activity options change received:', payload);
        await loadActivity(true);
      }
    );

    // Subscribe to participant responses for this activity
    channel.on('postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'participant_responses',
        filter: `activity_id=eq.${pollId}`
      },
      async (payload) => {
        console.log('VotePage: Response change received:', payload);
        await loadActivity(true);
      }
    );

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      console.log('VotePage: Subscription status:', status);
      if (err) {
        console.error('VotePage: Subscription error:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ VotePage: Real-time subscriptions active');
      }
    });

    return () => {
      console.log('VotePage: Cleaning up subscriptions');
      channel.unsubscribe();
    };
  }, [pollId, navigate, roomCode, activity?.room_id, loadActivity]);

  const handleVote = async (optionId: string) => {
    if (!activity || hasVoted || voting || !supabase) return;

    // Check if voting is locked
    if (activity.settings?.voting_locked) {
      alert('Voting has been locked by the presenter. No more votes can be submitted.');
      return;
    }

    setVoting(true);
    setSelectedOption(optionId);

    try {
      await roomService.submitResponse(activity.room_id, activity.id, optionId, participantId);
      
      setHasVoted(true);
      // Store vote in localStorage
      const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
      votedActivities.push(activity.id);
      localStorage.setItem('votedActivities', JSON.stringify(votedActivities));
      
      // Reload activity to get updated response counts
      setTimeout(() => loadActivity(true), 1000);
      
    } catch (error) {
      console.error('VotePage: Error submitting vote:', error);
      setSelectedOption(null);
      
      // Show error to user
      alert('Failed to submit vote. Please try again.');
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading activity...</p>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Activity Not Found</h1>
          <p className="text-red-300 mb-4">This activity may have ended or doesn't exist.</p>
          <button
            onClick={() => navigate('/game')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Join Another Room
          </button>
        </div>
      </div>
    );
  }

  const themeColors = {
    primary: activity.room?.settings?.theme?.primary_color || '#3B82F6',
    secondary: activity.room?.settings?.theme?.secondary_color || '#1E40AF',
    accent: activity.room?.settings?.theme?.accent_color || '#60A5FA',
    text: activity.room?.settings?.theme?.text_color || '#FFFFFF'
  };

  const isVotingLocked = activity.settings?.voting_locked || false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => {
              if (roomCode) {
                navigate(`/game?joined=${roomCode}`);
              } else {
                navigate('/game');
              }
            }}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Room
          </button>
          
          <div className="flex items-center gap-4 text-slate-300">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{activity.total_responses} responses</span>
            </div>
            {roomCode && (
              <span className="px-3 py-1 bg-slate-700 rounded-full text-sm font-mono">
                {roomCode}
              </span>
            )}
          </div>
        </div>

        {/* Activity Content */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <span 
              className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-4"
              style={{ 
                backgroundColor: `${themeColors.accent}20`,
                color: themeColors.accent 
              }}
            >
              {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
            </span>
            
            <h1 className="text-4xl font-bold text-white mb-4">
              {activity.title}
            </h1>
            
            {activity.description && (
              <p className="text-xl text-slate-300">
                {activity.description}
              </p>
            )}
          </motion.div>

          {activity.media_url && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8"
            >
              <img
                src={activity.media_url}
                alt="Activity media"
                className="max-w-md mx-auto rounded-lg shadow-lg"
              />
            </motion.div>
          )}
        </div>

        {/* Voting Locked Notice */}
        {isVotingLocked && !hasVoted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-red-900/20 border border-red-600/30 rounded-lg text-center"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-red-400" />
              <h2 className="text-xl font-bold text-red-400">Voting Locked</h2>
            </div>
            <p className="text-red-300">
              The presenter has locked voting for this activity. No more responses can be submitted.
            </p>
          </motion.div>
        )}

        {/* Voting Options */}
        <AnimatePresence mode="wait">
          {hasVoted ? (
            <motion.div
              key="voted"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: `${themeColors.accent}20` }}
              >
                <Check className="w-10 h-10" style={{ color: themeColors.accent }} />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-4">
                Thank you for voting!
              </h2>
              
              <p className="text-slate-300 mb-8">
                Your response has been recorded. Results will be shown when the presenter ends this activity.
              </p>
              
              <button
                onClick={() => {
                  if (roomCode) {
                    navigate(`/game?joined=${roomCode}`);
                  } else {
                    navigate('/game');
                  }
                }}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Return to Room
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="voting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="grid gap-4 max-w-2xl mx-auto">
                {activity.options?.map((option, index) => (
                  <motion.button
                    key={option.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => handleVote(option.id)}
                    disabled={voting || isVotingLocked}
                    className={`p-6 rounded-lg border-2 transition-all duration-200 ${
                      selectedOption === option.id
                        ? 'border-blue-500 bg-blue-500/10 scale-[0.98]'
                        : isVotingLocked
                        ? 'border-slate-600 bg-slate-800/50 opacity-50 cursor-not-allowed'
                        : 'border-slate-600 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800/70 hover:scale-[1.02] cursor-pointer'
                    } ${voting ? 'cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <span className="text-lg font-medium text-white block">
                          {option.text}
                        </span>
                        
                        {option.media_url && (
                          <img
                            src={option.media_url}
                            alt="Option media"
                            className="mt-3 max-w-xs rounded-md"
                          />
                        )}
                      </div>
                      
                      {voting && selectedOption === option.id && (
                        <Loader2 className="w-6 h-6 text-blue-400 animate-spin ml-4" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
              
              {voting && (
                <div className="text-center mt-6">
                  <p className="text-slate-300">Submitting your vote...</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};