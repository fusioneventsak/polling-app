import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { roomService } from '../services/roomService';
import { ArrowLeft, Users, CheckCircle, Clock, Loader2, Lock } from 'lucide-react';
import type { Activity } from '../types';

function VotePage() {
  const { pollId } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [participantId] = useState(() => `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const subscriptionRef = useRef<any>(null);

  // Get room code from URL params or localStorage
  const roomCode = new URLSearchParams(window.location.search).get('room') || 
                   localStorage.getItem('currentRoomCode');

  const checkVotingStatus = useCallback(async () => {
    if (!pollId) return;
    
    try {
      // Check if participant has already voted using localStorage and database
      const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
      const hasVotedLocally = votedActivities.includes(pollId);
      
      // Also check database for this participant
      if (supabase) {
        const { data: existingResponse } = await supabase
          .from('participant_responses')
          .select('id')
          .eq('activity_id', pollId)
          .eq('participant_id', participantId)
          .single();
        
        const hasVotedInDB = !!existingResponse;
        setHasVoted(hasVotedLocally || hasVotedInDB);
        
        console.log('VotePage: Voting status check:', {
          hasVotedLocally,
          hasVotedInDB,
          finalStatus: hasVotedLocally || hasVotedInDB
        });
      } else {
        setHasVoted(hasVotedLocally);
      }
    } catch (error) {
      console.error('VotePage: Error checking voting status:', error);
    }
  }, [pollId, participantId]);

  const loadActivity = useCallback(async (forceRefresh = false) => {
    if (!pollId || !supabase) return;
    
    try {
      console.log('VotePage: Loading activity:', pollId, forceRefresh ? '(forced)' : '');
      
      const { data: activityData, error } = await supabase
        .from('activities')
        .select(`
          *,
          room:rooms(*),
          options:activity_options(*)
        `)
        .eq('id', pollId)
        .single();

      if (error) {
        console.error('VotePage: Error loading activity:', error);
        setActivity(null);
        return;
      }

      if (!activityData) {
        console.log('VotePage: Activity not found');
        setActivity(null);
        return;
      }

      // Transform the data to match our Activity type
      const transformedActivity: Activity = {
        ...activityData,
        options: activityData.options?.map((opt: any) => ({
          id: opt.id,
          text: opt.text,
          media_url: opt.media_url,
          responses: opt.responses || 0
        })) || []
      };

      console.log('VotePage: Activity loaded successfully:', {
        id: transformedActivity.id,
        title: transformedActivity.title,
        optionsCount: transformedActivity.options?.length || 0,
        totalResponses: transformedActivity.total_responses || 0,
        isActive: transformedActivity.is_active,
        votingLocked: transformedActivity.settings?.voting_locked
      });

      setActivity(transformedActivity);
    } catch (error) {
      console.error('VotePage: Error in loadActivity:', error);
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  // Load activity on mount
  useEffect(() => {
    loadActivity();
    checkVotingStatus();
  }, [loadActivity, checkVotingStatus]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!pollId || !supabase) return;

    console.log('VotePage: Setting up real-time subscriptions for activity:', pollId);

    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    const channel = supabase
      .channel(`vote-page-${pollId}`)
      .on('postgres_changes',
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
      )
      .on('postgres_changes',
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
      )
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'participant_responses',
          filter: `activity_id=eq.${pollId}`
        },
        async (payload) => {
          console.log('VotePage: Participant response change received:', {
            eventType: payload.eventType,
            activityId: payload.new?.activity_id || payload.old?.activity_id,
            participantId: payload.new?.participant_id || payload.old?.participant_id,
            optionId: payload.new?.option_id || payload.old?.option_id
          });
          
          // If this is a DELETE event (could be from room reset), recheck voting status
          if (payload.eventType === 'DELETE') {
            console.log('VotePage: Response deleted - rechecking vote status');
            await checkVotingStatus();
          }
          
          // Always reload activity to get updated counts
          await loadActivity(true);
        }
      );

    // Subscribe to bulk deletes at room level for reset detection
    if (activity?.room_id) {
      channel.on('postgres_changes',
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'participant_responses',
          filter: `room_id=eq.${activity.room_id}`
        },
        async (payload) => {
          console.log('VotePage: Bulk participant responses deleted - likely room reset');
          
          // Clear all localStorage votes for this room's activities
          if (activity.room?.activities) {
            const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
            const roomActivityIds = activity.room.activities.map(a => a.id);
            const filteredVotes = votedActivities.filter((id: string) => !roomActivityIds.includes(id));
            localStorage.setItem('votedActivities', JSON.stringify(filteredVotes));
            console.log('VotePage: Cleared localStorage votes for room activities');
          }
          
          // Recheck voting status
          await checkVotingStatus();
          await loadActivity(true);
        }
      );
    }

    // Subscribe to the channel
    subscriptionRef.current = channel;
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
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [pollId, navigate, roomCode, activity?.room_id, loadActivity, checkVotingStatus]);

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
      console.log('VotePage: Submitting vote:', {
        activityId: activity.id,
        optionId,
        participantId,
        roomId: activity.room_id
      });

      // Submit response using roomService
      await roomService.submitResponse(activity.room_id, activity.id, optionId, participantId);
      
      console.log('VotePage: Vote submitted successfully');
      
      setHasVoted(true);
      
      // Store vote in localStorage
      const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
      if (!votedActivities.includes(activity.id)) {
        votedActivities.push(activity.id);
        localStorage.setItem('votedActivities', JSON.stringify(votedActivities));
      }
      
      // Force reload activity to get updated response counts
      setTimeout(() => {
        loadActivity(true);
      }, 500);
      
    } catch (error) {
      console.error('VotePage: Error submitting vote:', error);
      setSelectedOption(null);
      
      // Show error to user
      alert('Failed to submit vote. Please try again.');
    } finally {
      setVoting(false);
    }
  };

  const themeColors = {
    primary: activity?.room?.settings?.primaryColor || '#3b82f6',
    accent: activity?.room?.settings?.accentColor || '#10b981',
    background: activity?.room?.settings?.backgroundColor || '#1e293b'
  };

  const isVotingLocked = activity?.settings?.voting_locked || false;

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-white">Loading activity...</p>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Activity Not Found</h1>
          <p className="text-red-300 mb-6">This activity may have been deleted or is no longer active.</p>
          <button
            onClick={() => navigate('/game')}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Return to Join Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-x-hidden">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => {
              if (roomCode) {
                navigate(`/game?joined=${roomCode}`);
              } else {
                navigate('/game');
              }
            }}
            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">Room {roomCode}</span>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Users className="w-4 h-4" />
              <span>{activity.total_responses || 0} responses</span>
            </div>
          </div>
        </div>

        {/* Activity Content */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <span 
              className="inline-block px-4 py-2 rounded-full text-sm font-semibold mb-6"
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
              The presenter has locked voting for this activity.
            </p>
          </motion.div>
        )}

        {/* Vote Success Message */}
        {hasVoted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-green-900/20 border border-green-600/30 rounded-lg text-center"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <h2 className="text-2xl font-bold text-green-400">Vote Recorded!</h2>
            </div>
            <p className="text-green-300 mb-4">
              Thank you for participating. Your response has been recorded.
            </p>
            {selectedOption && (
              <div className="inline-block px-4 py-2 bg-green-800/30 border border-green-600/50 rounded-lg">
                <span className="text-green-200 text-sm">
                  Your choice: {activity.options?.find(opt => opt.id === selectedOption)?.text}
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* Options */}
        {!hasVoted && !isVotingLocked && (
          <div className="grid gap-4 md:gap-6">
            <AnimatePresence>
              {activity.options?.map((option, index) => (
                <motion.button
                  key={option.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleVote(option.id)}
                  disabled={voting}
                  className={`
                    relative p-6 md:p-8 rounded-xl border-2 transition-all duration-300 text-left
                    ${voting && selectedOption === option.id
                      ? 'border-blue-500 bg-blue-900/30 scale-[0.98]'
                      : 'border-slate-600 hover:border-blue-400 bg-slate-800/50 hover:bg-slate-700/50 hover:scale-[1.02]'
                    }
                    ${voting ? 'cursor-not-allowed' : 'cursor-pointer'}
                  `}
                  style={{
                    boxShadow: voting && selectedOption === option.id
                      ? `0 0 30px ${themeColors.accent}40`
                      : undefined
                  }}
                >
                  {voting && selectedOption === option.id && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl animate-pulse" />
                  )}
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ 
                          borderColor: themeColors.accent,
                          color: themeColors.accent 
                        }}
                      >
                        {String.fromCharCode(65 + index)}
                      </div>
                      
                      <div className="flex-1">
                        <p className="text-lg md:text-xl font-semibold text-white mb-2">
                          {option.text}
                        </p>
                        
                        {option.media_url && (
                          <img
                            src={option.media_url}
                            alt="Option media"
                            className="max-w-xs rounded-lg shadow-md"
                          />
                        )}
                      </div>
                      
                      {voting && selectedOption === option.id && (
                        <div className="flex-shrink-0">
                          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Real-time Counter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-slate-800/50 border border-slate-600/50 rounded-full">
            <Users className="w-5 h-5 text-slate-400" />
            <span className="text-slate-300">
              {activity.total_responses || 0} total responses
            </span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
        </motion.div>

        {/* Display Page Link */}
        {roomCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 text-center"
          >
            <p className="text-slate-400 mb-4">
              View live results at:
            </p>
            <div className="inline-block px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg">
              <code className="text-blue-400 text-sm">
                {window.location.origin}/display/{roomCode}
              </code>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export { VotePage };