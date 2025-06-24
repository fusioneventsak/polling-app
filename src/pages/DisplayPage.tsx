// DisplayPage.tsx - FIXED VERSION with Proper Real-time Updates
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Users, BarChart3, Wifi, WifiOff } from 'lucide-react';
import { Enhanced3DPollVisualization } from '../components/Enhanced3DPollVisualization';
import { roomService } from '../services/roomService';
import { useSocket } from '../contexts/SocketContext';
import type { Room, Activity } from '../types';

// FIXED: Stats component with real-time animations
const StatsCard: React.FC<{ 
  title: string; 
  value: string | number; 
  icon: React.ReactNode;
  delay?: number;
}> = ({ title, value, icon, delay = 0 }) => (
  <motion.div
    className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
  >
    <div className="flex items-center gap-3">
      <div className="text-cyan-400">{icon}</div>
      <div>
        <div className="text-slate-400 text-sm">{title}</div>
        <motion.div 
          className="text-white text-xl font-bold"
          key={value} // FIXED: Animate value changes
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {value}
        </motion.div>
      </div>
    </div>
  </motion.div>
);

// FIXED: Activity display component with proper real-time handling
const ActivityDisplay: React.FC<{
  activity: Activity;
  className?: string;
  isVotingLocked?: boolean;
}> = ({ activity, className = "", isVotingLocked = false }) => {
  // FIXED: Force re-render when activity data changes
  const [renderKey, setRenderKey] = useState(0);
  
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [activity.total_responses, activity.options?.map(o => o.responses).join(',')]);

  const themeColors = {
    primaryColor: '#3b82f6',
    secondaryColor: '#06b6d4', 
    accentColor: '#8b5cf6'
  };

  return (
    <div className={`space-y-0 ${className}`}>
      {/* Activity header with real-time updates */}
      <motion.div 
        className="text-center py-4"
        key={`header-${renderKey}`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold text-white mb-1">
          {activity.title}
        </h1>
        {activity.description && (
          <p className="text-slate-300 text-sm">{activity.description}</p>
        )}
        <motion.div 
          className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/20 rounded-full border border-cyan-500/30 text-xs"
          animate={{ 
            boxShadow: activity.is_active 
              ? "0 0 15px rgba(6, 182, 212, 0.3)" 
              : "0 0 8px rgba(100, 116, 139, 0.2)" 
          }}
          transition={{ duration: 0.5 }}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${activity.is_active ? 'bg-green-400' : 'bg-slate-400'}`} />
          <span className="font-medium text-white">
            {activity.is_active ? 'Live Poll' : 'Poll Ended'}
          </span>
        </motion.div>
      </motion.div>

      {/* MAXIMIZED: 3D Visualization takes full space below header */}
      <div className="h-[calc(100vh-80px)] w-full">
        <Enhanced3DPollVisualization
          key={`viz-${renderKey}`} // FIXED: Force re-render on data changes
          options={activity.options || []}
          totalResponses={activity.total_responses || 0}
          themeColors={themeColors}
          activityTitle={activity.title}
          activityMedia={activity.media_url}
          isVotingLocked={isVotingLocked}
          className="h-full w-full"
        />
      </div>
    </div>
  );
};

// FIXED: Main DisplayPage component with enhanced real-time handling
export const DisplayPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  const { connectionStatus } = useSocket();
  
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // FIXED: Use refs to prevent stale closure issues
  const currentRoomRef = useRef<Room | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Update ref when state changes
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  // Get all activities for stats
  const allActivities = currentRoom?.activities || [];
  const activeActivity = allActivities.find(a => a.is_active);

  // Time update effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // FIXED: Enhanced room loading with better error handling
  const loadRoom = useCallback(async () => {
    if (!pollId) return;

    try {
      setLoading(true);
      setError(null);
      
      const room = await roomService.getRoomByCode(pollId);
      if (!room) {
        setError('Room not found');
        return;
      }

      console.log('🏠 DisplayPage: Loaded room:', {
        id: room.id,
        code: room.code,
        activities: room.activities?.length || 0,
        currentActivityId: room.current_activity_id,
        totalResponses: room.activities?.reduce((sum, a) => sum + (a.total_responses || 0), 0) || 0
      });

      setCurrentRoom(room);
    } catch (err) {
      console.error('Failed to load room:', err);
      setError('Failed to load room');
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  // Initial load
  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  // FIXED: Enhanced real-time event handling with debouncing
  useEffect(() => {
    if (!pollId) return;

    console.log('🎧 DisplayPage: Setting up enhanced real-time listeners for room:', pollId);

    // FIXED: Debounced update function to prevent rapid re-renders
    const debouncedUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      updateTimeoutRef.current = setTimeout(() => {
        console.log('🔄 DisplayPage: Performing debounced room reload');
        loadRoom();
      }, 100); // 100ms debounce
    };

    // FIXED: Enhanced room update handler
    const handleRoomUpdate = (event: CustomEvent<{ roomId: string; roomCode?: string }>) => {
      console.log('🏠 DisplayPage: Room update event received:', event.detail);
      if (event.detail.roomCode === pollId || currentRoomRef.current?.id === event.detail.roomId) {
        debouncedUpdate();
      }
    };

    // FIXED: Enhanced activity update handler
    const handleActivityUpdate = (event: CustomEvent<{ activityId: string; roomId: string; isActive?: boolean }>) => {
      console.log('🎯 DisplayPage: Activity update event received:', event.detail);
      if (currentRoomRef.current?.id === event.detail.roomId) {
        debouncedUpdate();
      }
    };

    // FIXED: Enhanced response update handler
    const handleResponseUpdate = (event: CustomEvent<{ activityId: string; roomId: string }>) => {
      console.log('📊 DisplayPage: Response update event received:', event.detail);
      if (currentRoomRef.current?.id === event.detail.roomId) {
        debouncedUpdate();
      }
    };

    // FIXED: Granular data change handlers for faster updates
    const handleActivityDataChange = (event: CustomEvent<{
      id: string; 
      room_id: string; 
      total_responses: number; 
      is_active: boolean;
      title?: string;
      description?: string;
      media_url?: string;
    }>) => {
      console.log('🎯 DisplayPage: Activity data change:', event.detail);
      
      if (currentRoomRef.current?.id === event.detail.room_id) {
        // FIXED: Update activity data in-place for faster response
        setCurrentRoom(prevRoom => {
          if (!prevRoom || prevRoom.id !== event.detail.room_id) return prevRoom;
          
          const updatedActivities = prevRoom.activities?.map(activity => 
            activity.id === event.detail.id 
              ? {
                  ...activity,
                  total_responses: event.detail.total_responses,
                  is_active: event.detail.is_active,
                  title: event.detail.title || activity.title,
                  description: event.detail.description || activity.description,
                  media_url: event.detail.media_url || activity.media_url
                }
              : activity
          ) || [];
          
          return {
            ...prevRoom,
            activities: updatedActivities
          };
        });
      }
    };

    // FIXED: Option data change handler for immediate response updates
    const handleOptionDataChange = (event: CustomEvent<{
      id: string; 
      activity_id: string; 
      responses: number; 
      is_correct: boolean; 
      text: string; 
      media_url?: string; 
      option_order: number;
    }>) => {
      console.log('📝 DisplayPage: Option data change:', event.detail);
      
      // FIXED: Update option data in-place for fastest response
      setCurrentRoom(prevRoom => {
        if (!prevRoom) return prevRoom;
        
        const updatedActivities = prevRoom.activities?.map(activity => {
          if (activity.id === event.detail.activity_id) {
            const updatedOptions = activity.options?.map(option =>
              option.id === event.detail.id
                ? {
                    ...option,
                    responses: event.detail.responses,
                    is_correct: event.detail.is_correct,
                    text: event.detail.text,
                    media_url: event.detail.media_url
                  }
                : option
            ) || [];
            
            // Recalculate total responses
            const totalResponses = updatedOptions.reduce((sum, opt) => sum + opt.responses, 0);
            
            return {
              ...activity,
              options: updatedOptions,
              total_responses: totalResponses
            };
          }
          return activity;
        }) || [];
        
        return {
          ...prevRoom,
          activities: updatedActivities
        };
      });
    };

    // FIXED: Add all event listeners
    window.addEventListener('room-updated', handleRoomUpdate);
    window.addEventListener('activity-updated', handleActivityUpdate);
    window.addEventListener('responses-updated', handleResponseUpdate);
    window.addEventListener('activity-data-changed', handleActivityDataChange);
    window.addEventListener('option-data-changed', handleOptionDataChange);

    // Cleanup
    return () => {
      console.log('🧹 DisplayPage: Cleaning up event listeners');
      
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      window.removeEventListener('room-updated', handleRoomUpdate);
      window.removeEventListener('activity-updated', handleActivityUpdate);
      window.removeEventListener('responses-updated', handleResponseUpdate);
      window.removeEventListener('activity-data-changed', handleActivityDataChange);
      window.removeEventListener('option-data-changed', handleOptionDataChange);
    };
  }, [pollId, loadRoom]);

  // FIXED: Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-white mb-2">Loading Poll Display</h2>
          <p className="text-slate-400">Connecting to real-time data...</p>
        </motion.div>
      </div>
    );
  }

  // FIXED: Error state
  if (error || !currentRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div 
          className="text-center max-w-md mx-auto px-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">!</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            {error || 'Room Not Found'}
          </h2>
          <p className="text-slate-400 mb-6">
            The poll room you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
          >
            Return Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* FIXED: Enhanced header with connection status */}
      <motion.div 
        className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 px-6 py-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">
              Room: {currentRoom.code}
            </h1>
            <motion.div 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                connectionStatus === 'connected' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
              animate={{ 
                scale: connectionStatus === 'connected' ? 1 : [1, 1.05, 1] 
              }}
              transition={{ 
                duration: 0.5,
                repeat: connectionStatus === 'connected' ? 0 : Infinity,
                repeatDelay: 2
              }}
            >
              {connectionStatus === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </motion.div>
          </div>
          
          <div className="text-slate-300 text-sm">
            {currentTime.toLocaleTimeString()}
          </div>
        </div>
      </motion.div>

      {/* REMOVED: Stats grid for maximum canvas space */}
      
      {/* MAXIMIZED: Activity display with full screen canvas */}
      <div className="h-[calc(100vh-140px)]">
        <AnimatePresence mode="wait">
          {activeActivity ? (
            <motion.div
              key={`activity-${activeActivity.id}-${activeActivity.total_responses}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              className="h-full"
            >
              <ActivityDisplay
                activity={activeActivity}
                isVotingLocked={activeActivity.settings?.voting_locked || false}
                className="h-full"
              />
            </motion.div>
          ) : (
            <motion.div
              key="no-activity"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="h-full flex items-center justify-center"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No Active Poll</h3>
                <p className="text-slate-400">Waiting for the next activity to begin...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};