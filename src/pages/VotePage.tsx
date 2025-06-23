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

  const checkVotingStatus = useCallback(async () => {
    if (!pollId) return;
    
    try {
      // Check if participant has already voted using localStorage first (faster)
      const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
      const hasVotedLocally = votedActivities.includes(pollId);
      
      if (hasVotedLocally) {
        console.log('VotePage: Found local vote record');
        setHasVoted(true);
        return;
      }

      // Only check database if no local record and supabase is available
      if (supabase) {
        try {
          const { data: response, error } = await supabase
            .from('participant_responses')
            .select('id')
            .eq('activity_id', pollId)
            .eq('participant_id', participantId)
            .maybeSingle(); // Use maybeSingle instead of single to avoid 406 errors

          if (error && error.code !== 'PGRST116') {
            console.warn('VotePage: Error checking database voting status:', error);
            // Don't throw, just use localStorage value
            setHasVoted(hasVotedLocally);
            return;
          }

          const hasVotedInDB = !!response;
          setHasVoted(hasVotedInDB);
          
          // Sync localStorage with database
          if (hasVotedInDB && !hasVotedLocally) {
            const updatedVotedActivities = [...votedActivities, pollId];
            localStorage.setItem('votedActivities', JSON.stringify(updatedVotedActivities));
          }
          
          console.log('VotePage: Vote status check:', {
            hasVotedLocally,
            hasVotedInDB,
            final: hasVotedInDB
          });
          
        } catch (dbError) {
          console.warn('VotePage: Database check failed, using localStorage only:', dbError);
          setHasVoted(hasVotedLocally);
        }
      } else {
        setHasVoted(hasVotedLocally);
      }
    } catch (error) {
      console.error('VotePage: Error checking voting status:', error);
      // Fallback to localStorage only
      const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
      setHasVoted(votedActivities.includes(pollId));
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
          room:rooms!activities_room_id_fkey(*),
          options:activity_options(*)
        `)
        .eq('id', pollId)
        .maybeSingle(); // Use maybeSingle to avoid 406 errors

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

      // Check if activity is still active
      if (!activityData.is_active) {
        console.log('VotePage: Activity is no longer active, redirecting');
        if (activityData.room?.code) {
          navigate(`/game?joined=${activityData.room.code}`);
        } else {
          navigate('/game');
        }
        return;
      }

      // Transform the data to match our Activity type
      const transformedActivity: Activity = {
        ...activityData,
        options: activityData.options?.map((opt: any) => ({
          id: opt.id,
          text: opt.text,
          media_url: opt.media_url,
          responses: opt.responses || 0,
          is_correct: opt.is_correct || false,
          option_order: opt.option_order || 0,
          created_at: opt.created_at,
          activity_id: opt.activity_id
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
      setRoomCode(activityData.room?.code || null);
    } catch (error) {
      console.error('VotePage: Error in loadActivity:', error);
    } finally {
      setLoading(false);
    }
  }, [pollId, navigate]);

  // Load activity on mount
  useEffect(() => {
    const initializeActivity = async () => {
      await loadActivity();
      await checkVotingStatus();
    };
    initializeActivity();
  }, [loadActivity, checkVotingStatus]);

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

  // Set up real-time subscriptions
  useEffect(() => {
    if (!pollId || !supabase || !activity) return;

    console.log('VotePage: Setting up real-time subscriptions for activity:', pollId);

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

    // Subscribe to room changes to detect resets
    if (activity.room_id) {
      channel.on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'rooms',
          filter: `id=eq.${activity.room_id}`
        },
        async (payload) => {
          console.log('VotePage: Room change received:', {
            eventType: payload.eventType,
            roomId: payload.new?.id || payload.old?.id,
            oldParticipants: payload.old?.participants,
            newParticipants: payload.new?.participants
          });
          
          // Detect room reset (participants count reset to 0)
          if (payload.eventType === 'UPDATE' && 
              payload.old?.participants > 0 && 
              payload.new?.participants === 0) {
            console.log('VotePage: Room reset detected - clearing all localStorage votes');
            
            // Clear all localStorage votes for this room's activities
            const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
            const roomActivityIds = activity.room?.activities?.map(a => a.id) || [pollId];
            const filteredVotes = votedActivities.filter((id: string) => !roomActivityIds.includes(id));
            localStorage.setItem('votedActivities', JSON.stringify(filteredVotes));
            
            // Reset voting status for current activity
            setHasVoted(false);
            setSelectedOption(null);
            
            console.log('VotePage: Cleared localStorage votes after room reset');
          }
          
          await loadActivity(true);
        }
      );
    }

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
      
      // Store vote in localStorage immediately
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit vote. Please try again.';
      alert(errorMessage);
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
                    } ${voting ? 'pointer-events-none' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      {option.media_url && (
                        <img
                          src={option.media_url}
                          alt={`Option ${index + 1}`}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      )}
                      
                      <div className="flex-1 text-left">
                        <p className="text-lg font-semibold text-white">
                          {option.text}
                        </p>
                      </div>
                      
                      {voting && selectedOption === option.id && (
                        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
              
              {isVotingLocked && (
                <p className="text-center text-red-400 text-sm mt-4">
                  Voting has been locked by the presenter
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};