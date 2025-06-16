import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useTheme } from '../components/ThemeProvider';
import { supabase } from '../lib/supabase';
import { roomService } from '../services/roomService';
import { Check, Users, BarChart, MessageSquare, HelpCircle, Target, Cloud, Image as ImageIcon } from 'lucide-react';
import type { Activity, ActivityType } from '../types';

export const VotePage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [participantId] = useState(() => 
    `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const { applyTheme, resetTheme } = useTheme();

  // Load activity data
  const loadActivity = async () => {
    if (!pollId || !supabase) return;
    
    try {
      // Get activity with room information
      const { data: activityData, error } = await supabase
        .from('activities')
        .select(`
          *,
          activity_options (*),
          rooms!activities_room_id_fkey (
            id,
            code,
            name,
            participants,
            is_active,
            settings
          )
        `)
        .eq('id', pollId)
        .single();

      if (error) {
        console.error('Error loading activity:', error);
        setActivity(null);
        return;
      }

      if (activityData) {
        const formattedActivity = {
          ...activityData,
          options: activityData.activity_options?.sort((a, b) => a.option_order - b.option_order) || [],
          room: activityData.rooms
        };
        setActivity(formattedActivity);
        setRoomCode(activityData.rooms?.code || null);
      } else {
        setActivity(null);
      }
    } catch (error) {
      console.error('Error loading activity:', error);
      setActivity(null);
    }
  };

  useEffect(() => {
    const initializeActivity = async () => {
      setLoading(true);
      await loadActivity();
      setLoading(false);
    };

    initializeActivity();
  }, [pollId]);

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

  // Set up real-time subscriptions
  useEffect(() => {
    if (!pollId || !supabase || !activity?.room_id) return;

    console.log('Setting up real-time subscriptions for activity:', pollId);

    // Create a unique channel for this vote session
    const channelName = `activity-vote-${pollId}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Subscribe to room changes to detect new active activities
    channel.on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'rooms',
        filter: `id=eq.${activity.room_id}`
      },
      async (payload) => {
        console.log('Room change received:', payload);
        
        // Check if a new activity was started
        if (payload.eventType === 'UPDATE' && 
            payload.new?.current_activity_id && 
            payload.new.current_activity_id !== pollId) {
          console.log('New activity started, redirecting to:', payload.new.current_activity_id);
          navigate(`/vote/${payload.new.current_activity_id}`);
          return;
        }
        
        // If current activity was cleared, go back to room waiting area
        if (payload.eventType === 'UPDATE' && 
            payload.old?.current_activity_id === pollId && 
            !payload.new?.current_activity_id) {
          console.log('Activity ended, redirecting to room waiting area');
          if (roomCode) {
            navigate(`/game?joined=${roomCode}`);
          } else {
            navigate('/game');
          }
          return;
        }
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
        console.log('Activity change received:', payload);
        
        // If activity was stopped, redirect back to room waiting area
        if (payload.eventType === 'UPDATE' && payload.new?.is_active === false && payload.old?.is_active === true) {
          console.log('Activity stopped, redirecting to room waiting area');
          if (roomCode) {
            navigate(`/game?joined=${roomCode}`);
          } else {
            navigate('/game');
          }
          return;
        }
        
        await loadActivity();
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
        console.log('Activity options change received:', payload);
        await loadActivity();
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
        console.log('Response change received:', payload);
        await loadActivity();
      }
    );

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      console.log('Vote subscription status:', status);
      if (err) {
        console.error('Vote subscription error:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ Vote real-time subscriptions active');
      }
    });

    return () => {
      console.log('Cleaning up vote subscriptions');
      channel.unsubscribe();
    };
  }, [pollId, navigate, roomCode, activity?.room_id, loadActivity]);

  const handleVote = async (optionId: string) => {
    if (!activity || hasVoted || voting || !supabase) return;

    setVoting(true);
    setSelectedOption(optionId);

    try {
      await roomService.submitResponse(activity.room_id, activity.id, optionId, participantId);
      
      setHasVoted(true);
      // Store vote in localStorage
      const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
      votedActivities.push(activity.id);
      localStorage.setItem('votedActivities', JSON.stringify(votedActivities));
      
      // Reload activity to get updated results
      await loadActivity();
    } catch (err) {
      console.error('Failed to cast vote:', err);
      setSelectedOption(null);
    } finally {
      setVoting(false);
    }
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

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
          <Card className="text-center">
            <div className="w-16 h-16 bg-slate-700 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <BarChart className="w-8 h-8 text-slate-400 animate-pulse" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Loading...</h2>
            <p className="text-slate-400">Connecting to activity...</p>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!supabase) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
          <Card className="text-center">
            <div className="w-16 h-16 bg-slate-700 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <BarChart className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Service Unavailable</h2>
            <p className="text-slate-400">Real-time features are not configured. Please contact the administrator.</p>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!activity) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
          <Card className="text-center">
            <div className="w-16 h-16 bg-slate-700 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <BarChart className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Activity not found</h2>
            <p className="text-slate-400">The activity you're looking for doesn't exist or has ended.</p>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!activity?.is_active) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
          <Card className="text-center">
            <div className="w-16 h-16 bg-slate-700 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              {React.createElement(getActivityIcon(activity.type), {
                className: "w-8 h-8 text-slate-400"
              })}
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Activity Inactive</h2>
            <p className="text-slate-400">This {getActivityTypeLabel(activity.type).toLowerCase()} is currently not accepting responses.</p>
          </Card>
        </div>
      </Layout>
    );
  }

  const getPercentage = (votes: number) => {
    return activity.total_responses > 0 ? Math.round((votes / activity.total_responses) * 100) : 0;
  };

  const Icon = getActivityIcon(activity.type);

  // Get theme-aware styles
  const getThemeStyles = () => {
    const settings = activity?.room?.settings;
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
      showBackground={!activity?.room?.settings?.theme?.background_gradient}
      className={activity?.room?.settings?.theme?.background_gradient ? `bg-gradient-to-br ${activity.room.settings.theme.background_gradient}` : ''}
    >
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span 
                  className="px-3 py-1 text-white text-sm font-mono rounded-full"
                  style={{ backgroundColor: themeStyles.primaryColor }}
                >
                  {activity.room?.code}
                </span>
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5" style={{ color: themeStyles.accentColor }} />
                  <span className="text-sm text-slate-400">
                    {getActivityTypeLabel(activity.type)}
                  </span>
                  <div className="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs font-semibold">
                    ● LIVE
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {activity.room?.participants || 0}
                </div>
                <div className="flex items-center gap-1">
                  <BarChart className="w-4 h-4" />
                  {activity.total_responses}
                </div>
              </div>
            </div>
            
            {activity.room?.settings?.branding?.logo_url && (
              <div className="flex justify-center mb-4">
                <img
                  src={activity.room.settings.branding.logo_url}
                  alt="Organization logo"
                  className="h-12 object-contain"
                />
              </div>
            )}

            {/* Activity Media */}
            {activity.media_url && (
              <div className="mb-4">
                <img
                  src={activity.media_url}
                  alt="Activity media"
                  className="w-full max-h-48 object-contain rounded-lg border border-slate-600"
                />
              </div>
            )}
            
            <h1 className="text-2xl font-bold text-white mb-2">
              {activity.title}
            </h1>
            
            {activity.description && (
              <p className="text-slate-300 text-sm mb-2">{activity.description}</p>
            )}
            
            {activity.room?.settings?.branding?.organization_name && (
              <p className="text-slate-400 text-xs mb-2">
                {activity.room.settings.branding.organization_name}
              </p>
            )}
            
            {hasVoted ? (
              <p className="text-green-400 text-sm">✓ Thank you for your response!</p>
            ) : (
              <p className="text-slate-300 text-sm">Tap an option to respond</p>
            )}
          </Card>

          <div className="space-y-4">
            <AnimatePresence>
              {activity.options?.map((option, index) => {
                const percentage = getPercentage(option.responses);
                const isSelected = selectedOption === option.id;
                const showResults = hasVoted;

                return (
                  <motion.div
                    key={option.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    layout
                  >
                    <motion.button
                      className={`w-full p-6 rounded-xl border-2 transition-all duration-300 relative overflow-hidden ${
                        hasVoted
                          ? 'cursor-default bg-slate-800/50 border-slate-700'
                          : isSelected
                          ? 'border-2'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800/70'
                      }`}
                      style={!hasVoted && isSelected ? {
                        backgroundColor: `${themeStyles.primaryColor}20`,
                        borderColor: themeStyles.primaryColor
                      } : {}}
                      onClick={() => !hasVoted && handleVote(option.id)}
                      disabled={hasVoted || voting}
                      whileHover={!hasVoted ? { scale: 1.02 } : {}}
                      whileTap={!hasVoted ? { scale: 0.98 } : {}}
                    >
                      {showResults && (
                        <motion.div
                          className="absolute inset-0"
                          style={{
                            background: option.is_correct 
                              ? 'linear-gradient(to right, rgba(5, 150, 105, 0.2), rgba(16, 185, 129, 0.2))'
                              : `linear-gradient(to right, ${themeStyles.primaryColor}33, ${themeStyles.secondaryColor}33)`
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                      )}

                      <div className="relative z-10">
                        {/* Option Image */}
                        {option.media_url && (
                          <div className="mb-4">
                            <img
                              src={option.media_url}
                              alt={`Option: ${option.text}`}
                              className="w-full max-h-32 object-contain rounded-lg border border-slate-600"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {hasVoted && isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0"
                              >
                                <Check className="w-4 h-4 text-white" />
                              </motion.div>
                            )}
                            <div className="text-left">
                              <span className="text-lg font-semibold text-white block">
                                {option.text}
                              </span>
                              {(activity.type === 'trivia' || activity.type === 'quiz') && option.is_correct && showResults && (
                                <span className="text-green-400 text-sm">✓ Correct Answer</span>
                              )}
                            </div>
                          </div>

                          {showResults && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.5 }}
                              className="text-right flex-shrink-0"
                            >
                              <div className="text-xl font-bold" style={{ color: themeStyles.accentColor }}>
                                {percentage}%
                              </div>
                              <div className="text-sm text-slate-400">
                                {option.responses} responses
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  </motion.div>
                );
              }) || []}
            </AnimatePresence>
          </div>

          {hasVoted && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-8 text-center"
            >
              <Card>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Thanks for participating! 🎉
                </h3>
                <p className="text-slate-300 text-sm">
                  Watch the results update in real-time as more people respond.
                </p>
                {activity.room?.settings?.branding?.show_powered_by !== false && (
                  <p className="text-slate-500 text-xs mt-2">
                    Powered by PollStream
                  </p>
                )}
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};