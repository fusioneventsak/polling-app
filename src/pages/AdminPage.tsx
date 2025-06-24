import React, { useState, useEffect } from 'react';
import { Plus, Users, Play, Square, Trash2, Edit3, MoreVertical, ExternalLink, BarChart3, Clock, Target, Lock, Unlock, RotateCcw, Settings, MessageSquare, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { RoomSettings } from '../components/RoomSettings';
import { ActivityEditor } from '../components/ActivityEditor';
import { TriviaGameControls } from '../components/TriviaGameControls';
import { roomService } from '../services/roomService';
import { supabase } from '../lib/supabase';
import type { Room, Activity, CreateRoomData, CreateActivityData, ActivityType } from '../types';

// Add the missing helper functions
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

export const AdminPage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'room' | 'activity';
    id: string;
    name: string;
    loading?: boolean;
  } | null>(null);
  const [resetConfirmation, setResetConfirmation] = useState<{
    roomId: string;
    roomName: string;
    loading?: boolean;
  } | null>(null);
  const [deletingActivities, setDeletingActivities] = useState<Set<string>>(new Set());

  // Activity Controls Section Component
  const ActivityControlsSection = () => {
    const currentActivity = selectedRoom?.activities?.find(a => a.is_active);
    
    if (!currentActivity || !selectedRoom) {
      return (
        <Card className="p-6">
          <div className="text-center">
            <div className="p-3 bg-slate-700 rounded-full w-fit mx-auto mb-4">
              <Target className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Active Activity</h3>
            <p className="text-slate-400 mb-4">
              Create and activate an activity to see controls here
            </p>
            <Button onClick={() => setShowCreateActivity(true)}>
              <Plus className="w-4 h-4" />
              Create Activity
            </Button>
          </div>
        </Card>
      );
    }

    // Render trivia-specific controls
    if (currentActivity.type === 'trivia') {
      return (
        <TriviaGameControls
          activity={currentActivity}
          roomId={selectedRoom.id}
          participantCount={selectedRoom.participants}
          onSettingsClick={() => setEditingActivity(currentActivity)}
        />
      );
    }

    // Default poll/survey controls
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              {React.createElement(getActivityIcon(currentActivity.type), { 
                className: "w-6 h-6 text-white" 
              })}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Activity Controls</h3>
              <p className="text-sm text-slate-400">{currentActivity.title}</p>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setEditingActivity(currentActivity)}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>

        {/* Activity Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400 font-medium">RESPONSES</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {currentActivity.total_responses || 0}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400 font-medium">OPTIONS</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {currentActivity.options?.length || 0}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-slate-400 font-medium">STATUS</span>
            </div>
            <div className="text-sm font-bold text-white">
              {currentActivity.is_active ? 'Active' : 'Inactive'}
            </div>
          </div>
        </div>

        {/* Vote Locking Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-600">
            <div className="flex items-center gap-3">
              {currentActivity.settings?.voting_locked ? (
                <Lock className="w-5 h-5 text-red-400" />
              ) : (
                <Unlock className="w-5 h-5 text-green-400" />
              )}
              <div>
                <h4 className="font-medium text-white">Voting Control</h4>
                <p className="text-sm text-slate-400">
                  {currentActivity.settings?.voting_locked 
                    ? 'Voting is currently locked - participants cannot vote'
                    : 'Voting is open - participants can submit responses'
                  }
                </p>
              </div>
            </div>
            <Button
              onClick={() => handleToggleVoteLock(currentActivity)}
              variant={currentActivity.settings?.voting_locked ? "success" : "danger"}
              size="sm"
              loading={loading}
            >
              {currentActivity.settings?.voting_locked ? (
                <>
                  <Unlock className="w-4 h-4" />
                  Unlock Votes
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Lock Votes
                </>
              )}
            </Button>
          </div>

          {/* Response Summary for regular activities */}
          {currentActivity.total_responses > 0 && (
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Response Summary
              </h4>
              <div className="space-y-2">
                {currentActivity.options?.map((option, index) => {
                  const percentage = currentActivity.total_responses > 0 
                    ? Math.round((option.responses / currentActivity.total_responses) * 100) 
                    : 0;
                  
                  return (
                    <div key={option.id} className="flex items-center justify-between">
                      <span className="text-sm text-white truncate flex-1">
                        {option.text}
                      </span>
                      <div className="text-sm text-slate-300 ml-4">
                        {option.responses} ({percentage}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  // Consolidated real-time subscriptions with improved connection management
  useEffect(() => {
    if (!supabase) return;

    console.log('Admin: Setting up consolidated real-time subscriptions');

    // Create a single channel for admin operations
    const adminChannel = supabase.channel('admin-console');

    // Subscribe to room changes
    adminChannel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'rooms' },
      (payload) => {
        console.log('Admin: Room change received:', {
          eventType: payload.eventType,
          roomId: payload.new?.id || payload.old?.id,
          oldCurrentActivityId: payload.old?.current_activity_id,
          newCurrentActivityId: payload.new?.current_activity_id
        });
        
        // Skip reload for DELETE events to prevent conflicts with optimistic updates
        if (payload.eventType === 'DELETE') {
          console.log('Admin: Skipping reload for DELETE event');
          return;
        }
        
        // For room changes, only reload if we don't have optimistic updates pending
        if (payload.eventType === 'UPDATE' && payload.new?.current_activity_id) {
          const roomId = payload.new.id;
          const currentRoomInState = rooms.find(r => r.id === roomId);
          
          if (currentRoomInState && selectedRoom?.id === roomId) {
            // If our local state already matches this change (optimistic update), don't reload
            const localCurrentActivityId = selectedRoom.current_activity_id;
            const newCurrentActivityId = payload.new.current_activity_id;
            
            if (localCurrentActivityId === newCurrentActivityId) {
              console.log('Admin: Skipping reload - optimistic update already applied');
              return;
            }
          }
        }
        
        // Reload for other changes
        loadRooms();
      }
    );

    // Subscribe to activity changes
    adminChannel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'activities' },
      (payload) => {
        console.log('Admin: Activity change received:', {
          eventType: payload.eventType,
          activityId: payload.new?.id || payload.old?.id,
          isActive: payload.new?.is_active,
          roomId: payload.new?.room_id || payload.old?.room_id
        });
        
        // Skip reload for DELETE events
        if (payload.eventType === 'DELETE') {
          console.log('Admin: Skipping reload for DELETE activity event');
          return;
        }
        
        // For activity changes, check if we initiated this change (optimistic update)
        if (payload.eventType === 'UPDATE' && payload.new?.is_active !== undefined) {
          const activityId = payload.new.id;
          const roomId = payload.new.room_id;
          
          if (selectedRoom?.id === roomId) {
            // Check if our local state already reflects this change
            const localActivity = selectedRoom.activities?.find(a => a.id === activityId);
            
            if (localActivity && localActivity.is_active === payload.new.is_active) {
              console.log('Admin: Skipping activity reload - optimistic update already applied');
              return;
            }
          }
        }
        
        // Reload for other activity changes
        loadRooms();
      }
    );

    // Subscribe to activity options changes
    adminChannel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'activity_options' },
      (payload) => {
        console.log('Admin: Activity options change received:', payload.eventType);
        loadRooms();
      }
    );

    // Subscribe to participant responses for real-time vote count updates
    adminChannel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'participant_responses' },
      (payload) => {
        console.log('Admin: Participant response change received:', payload.eventType);
        loadRooms();
      }
    );

    // Subscribe to the channel
    adminChannel.subscribe((status, err) => {
      console.log('Admin: Subscription status:', status);
      if (err) {
        console.error('Admin: Subscription error:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ Admin: Real-time subscriptions active');
      }
    });

    return () => {
      console.log('Admin: Cleaning up subscriptions');
      adminChannel.unsubscribe();
    };
  }, [rooms, selectedRoom]);

  const loadRooms = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const roomsData = await roomService.getAllRooms();
      console.log('Admin: Loaded rooms:', roomsData.length);
      setRooms(roomsData);
      
      // Update selected room if it exists in the new data
      if (selectedRoom) {
        const updatedSelectedRoom = roomsData.find(r => r.id === selectedRoom.id);
        if (updatedSelectedRoom) {
          setSelectedRoom(updatedSelectedRoom);
        }
      }
    } catch (err) {
      setError('Failed to load rooms');
      console.error('Error loading rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const openDisplayPage = (roomCode: string) => {
    window.open(`/display/${roomCode}`, '_blank');
  };

  const handleCreateRoom = async (roomData: CreateRoomData) => {
    try {
      const newRoom = await roomService.createRoom(roomData);
      setRooms(prev => [...prev, newRoom]);
      setShowCreateRoom(false);
      setSelectedRoom(newRoom);
    } catch (err) {
      setError('Failed to create room');
      console.error('Error creating room:', err);
    }
  };

  const handleEditRoom = async (roomData: any) => {
    try {
      if (!editingRoom) return;
      
      const updatedRoom = await roomService.updateRoom(editingRoom.id, roomData);
      
      // Update the room in state
      setRooms(prev => prev.map(room => 
        room.id === editingRoom.id ? updatedRoom : room
      ));
      
      if (selectedRoom?.id === editingRoom.id) {
        setSelectedRoom(updatedRoom);
      }
      
      setEditingRoom(null);
    } catch (err) {
      setError('Failed to update room');
      console.error('Error updating room:', err);
    }
  };

  const handleResetRoom = async (roomId: string) => {
    if (!resetConfirmation) return;
    
    try {
      console.log('Admin: Starting room reset:', roomId);
      
      // Show loading state
      setResetConfirmation(prev => prev ? { ...prev, loading: true } : null);
      
      // Get the room before reset to access its activities
      const roomBeforeReset = rooms.find(r => r.id === roomId);
      
      // Reset the room
      const resetRoom = await roomService.resetRoom(roomId);
      
      // Clear localStorage votes for all activities in this room
      if (roomBeforeReset?.activities) {
        console.log('Admin: Clearing localStorage votes for room activities');
        const votedActivities = JSON.parse(localStorage.getItem('votedActivities') || '[]');
        const roomActivityIds = roomBeforeReset.activities.map(a => a.id);
        const filteredVotes = votedActivities.filter((id: string) => !roomActivityIds.includes(id));
        localStorage.setItem('votedActivities', JSON.stringify(filteredVotes));
        console.log('Admin: Cleared localStorage votes for', roomActivityIds.length, 'activities');
      }
      
      // Update the room in state
      setRooms(prev => prev.map(room => 
        room.id === roomId ? resetRoom : room
      ));
      
      if (selectedRoom?.id === roomId) {
        setSelectedRoom(resetRoom);
      }
      
      // Clear confirmation modal
      setResetConfirmation(null);
      
      console.log('Room reset successfully');
    } catch (err) {
      setError('Failed to reset room');
      setResetConfirmation(null);
      console.error('Error resetting room:', err);
    }
  };

  const handleToggleVoteLock = async (activity: Activity) => {
    try {
      const newLockState = !activity.settings?.voting_locked;
      
      // Optimistic update
      if (selectedRoom) {
        const optimisticRoom = {
          ...selectedRoom,
          activities: selectedRoom.activities?.map(a => 
            a.id === activity.id 
              ? {
                  ...a,
                  settings: {
                    ...a.settings,
                    voting_locked: newLockState
                  }
                }
              : a
          ) || []
        };
        setSelectedRoom(optimisticRoom);
        setRooms(prev => prev.map(room => 
          room.id === selectedRoom.id ? optimisticRoom : room
        ));
      }
      
      await roomService.updateActivity(activity.id, {
        settings: {
          ...activity.settings,
          voting_locked: newLockState
        }
      });
      
      console.log('Vote lock toggled:', newLockState ? 'LOCKED' : 'UNLOCKED');
    } catch (err) {
      console.error('Failed to toggle vote lock:', err);
      setError('Failed to toggle vote lock');
      // Revert optimistic update on error
      await loadRooms();
    }
  };

  const handleStartActivity = async (roomId: string, activityId: string) => {
    try {
      console.log('Admin: Starting activity:', activityId);
      
      // Optimistic update: immediately update activity status
      // Deactivate ALL activities and activate only the new one
      if (selectedRoom) {
        const optimisticRoom = {
          ...selectedRoom,
          activities: selectedRoom.activities?.map(a => ({
            ...a,
            is_active: a.id === activityId ? true : false // Only the new activity is active
          })) || [],
          current_activity_id: activityId,
          current_activity_type: selectedRoom.activities?.find(a => a.id === activityId)?.type || null
        };
        setSelectedRoom(optimisticRoom);
        setRooms(prev => prev.map(room => 
          room.id === selectedRoom.id ? optimisticRoom : room
        ));
      }
      
      await roomService.startActivity(roomId, activityId);
      console.log('✅ Admin: Activity started successfully');
    } catch (err) {
      // Revert optimistic update on error
      console.error('❌ Admin: Failed to start activity, reverting optimistic update');
      await loadRooms();
      setError('Failed to start activity');
      console.error('Error starting activity:', err);
    }
  };

  const handleEndActivity = async (activityId: string) => {
    try {
      console.log('Admin: Ending activity:', activityId);
      
      // Optimistic update: immediately update activity status
      if (selectedRoom) {
        const optimisticRoom = {
          ...selectedRoom,
          activities: selectedRoom.activities?.map(a => ({
            ...a,
            is_active: a.id === activityId ? false : a.is_active
          })) || [],
          current_activity_id: null,
          current_activity_type: null
        };
        setSelectedRoom(optimisticRoom);
        setRooms(prev => prev.map(room => 
          room.id === selectedRoom.id ? optimisticRoom : room
        ));
      }
      
      await roomService.stopActivity(activityId);
      console.log('✅ Admin: Activity ended successfully');
    } catch (err) {
      // Revert optimistic update on error
      console.error('❌ Admin: Failed to end activity, reverting optimistic update');
      await loadRooms();
      setError('Failed to end activity');
      console.error('Error ending activity:', err);
    }
  };

  const handleCreateActivity = async (activityData: CreateActivityData) => {
    try {
      if (!selectedRoom) return;
      
      // The activityData is already a created Activity object from ActivityEditor
      const newActivity = activityData as Activity;
      
      // Update the selected room with the new activity
      const updatedRoom = {
        ...selectedRoom,
        activities: [...(selectedRoom.activities || []), newActivity].sort((a, b) => a.activity_order - b.activity_order)
      };
      setSelectedRoom(updatedRoom);
      setRooms(prev => prev.map(room => 
        room.id === selectedRoom.id ? updatedRoom : room
      ));
      
      setShowCreateActivity(false);
    } catch (err) {
      setError('Failed to create activity');
      console.error('Error creating activity:', err);
    }
  };

  const handleSaveActivity = async (activityData: Activity) => {
    try {
      if (!selectedRoom) return;
      
      // Only pass the fields that exist in the activities table
      const updateData = {
        title: activityData.title,
        description: activityData.description,
        media_url: activityData.media_url,
        type: activityData.type,
        settings: activityData.settings,
        // Include options if they exist (the updateActivity function will handle them separately)
        ...(activityData.options && { options: activityData.options })
      };
      
      const updatedActivity = await roomService.updateActivity(activityData.id, updateData);
      
      // Update the selected room with the updated activity
      const updatedRoom = {
        ...selectedRoom,
        activities: selectedRoom.activities?.map(a => 
          a.id === updatedActivity.id ? updatedActivity : a
        ) || []
      };
      setSelectedRoom(updatedRoom);
      setRooms(prev => prev.map(room => 
        room.id === selectedRoom.id ? updatedRoom : room
      ));
      
      setEditingActivity(null);
    } catch (err) {
      setError('Failed to update activity');
      console.error('Error updating activity:', err);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!deleteConfirmation) return;
    
    try {
      console.log('Admin: Starting room deletion:', roomId);
      
      // Show loading state
      setDeleteConfirmation(prev => prev ? { ...prev, loading: true } : null);
      
      // Optimistic update: immediately remove room from UI
      setRooms(prev => prev.filter(room => room.id !== roomId));
      if (selectedRoom?.id === roomId) {
        setSelectedRoom(null);
      }
      
      await roomService.deleteRoom(roomId);
      
      // Clear confirmation modal
      setDeleteConfirmation(null);
      
      console.log('Room deleted successfully');
    } catch (err) {
      // Revert optimistic update on error
      console.error('Failed to delete room, reverting optimistic update');
      await loadRooms();
      setError('Failed to delete room');
      setDeleteConfirmation(null);
      console.error('Error deleting room:', err);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!deleteConfirmation || !selectedRoom) return;
    
    try {
      console.log('Admin: Starting activity deletion:', activityId);
      
      // Show loading state
      setDeleteConfirmation(prev => prev ? { ...prev, loading: true } : null);
      
      // Add to deleting activities set to prevent it from reappearing
      setDeletingActivities(prev => new Set(prev).add(activityId));
      
      // Store the activity being deleted for potential rollback
      const activityToDelete = selectedRoom.activities?.find(a => a.id === activityId);
      const wasCurrentActivity = selectedRoom.current_activity_id === activityId;
      
      // Immediate optimistic update: remove activity from UI immediately
      const optimisticRoom = {
        ...selectedRoom,
        activities: selectedRoom.activities?.filter(a => a.id !== activityId) || [],
        // If we're deleting the current activity, clear the current activity references
        current_activity_id: wasCurrentActivity ? null : selectedRoom.current_activity_id,
        current_activity_type: wasCurrentActivity ? null : selectedRoom.current_activity_type
      };
      setSelectedRoom(optimisticRoom);
      setRooms(prev => prev.map(room => 
        room.id === selectedRoom.id ? optimisticRoom : room
      ));
      
      await roomService.deleteActivity(activityId);
      
      // Clear confirmation modal
      setDeleteConfirmation(null);
      
      // Remove from deleting set
      setDeletingActivities(prev => {
        const newSet = new Set(prev);
        newSet.delete(activityId);
        return newSet;
      });
      
      console.log('Activity deleted successfully');
    } catch (err) {
      // Revert optimistic update on error
      console.error('Failed to delete activity, reverting optimistic update');
      
      // Remove from deleting set
      setDeletingActivities(prev => {
        const newSet = new Set(prev);
        newSet.delete(activityId);
        return newSet;
      });
      
      await loadRooms();
      setError('Failed to delete activity');
      setDeleteConfirmation(null);
      console.error('Error deleting activity:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Sidebar - Room List */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white">Room Manager</h1>
                <Button
                  onClick={() => setShowCreateRoom(true)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  New Room
                </Button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <AnimatePresence>
                  {rooms.map((room) => (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={`p-4 rounded-lg border transition-all cursor-pointer ${
                        selectedRoom?.id === room.id
                          ? 'bg-blue-900/50 border-blue-600'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      }`}
                      onClick={() => setSelectedRoom(room)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white truncate">{room.name}</h3>
                          <p className="text-sm text-slate-400">Code: {room.code}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {room.participants}
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              {room.activities?.length || 0}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRoom(room);
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDisplayPage(room.code);
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmation({
                                  type: 'room',
                                  id: room.id,
                                  name: room.name
                                });
                              }}
                              className="text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {rooms.length === 0 && !loading && (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No rooms created yet</p>
                    <p className="text-sm">Create your first room to get started</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Middle Column - Activity Management */}
          <div className="lg:col-span-1">
            {selectedRoom ? (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedRoom.name}</h2>
                    <p className="text-slate-400">Room Code: {selectedRoom.code}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-400">
                      {selectedRoom.participants} participants
                    </div>
                    <Button
                      onClick={() => openDisplayPage(selectedRoom.code)}
                      variant="outline"
                      className="border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Launch Display
                    </Button>
                    <Button
                      onClick={() => setResetConfirmation({ 
                        roomId: selectedRoom.id, 
                        roomName: selectedRoom.name 
                      })}
                      variant="outline"
                      className="border-orange-600 text-orange-400 hover:border-orange-500 hover:text-orange-300"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset Room
                    </Button>
                    <Button
                      onClick={() => setShowCreateActivity(true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add Activity
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Activities</h3>
                  
                  <div className="space-y-3">
                    <AnimatePresence>
                      {selectedRoom.activities
                        ?.filter(activity => !deletingActivities.has(activity.id))
                        .map((activity) => {
                          const isActive = activity.is_active;
                          const isLocked = activity.settings?.voting_locked || false;
                          
                          return (
                            <motion.div
                              key={activity.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -300 }}
                              className={`p-4 rounded-lg border transition-all ${
                                isActive
                                  ? 'bg-green-900/30 border-green-600'
                                  : 'bg-slate-800/50 border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h4 className="font-semibold text-white">{activity.title}</h4>
                                    {isActive && (
                                      <span className="px-2 py-1 bg-green-600 text-green-100 text-xs rounded-full font-medium">
                                        Active
                                      </span>
                                    )}
                                    {isLocked && (
                                      <span className="px-2 py-1 bg-red-600/20 border border-red-600/30 text-red-400 text-xs rounded-full flex items-center gap-1">
                                        <Lock className="w-3 h-3" />
                                        Locked
                                      </span>
                                    )}
                                  </div>
                                  {activity.description && (
                                    <p className="text-sm text-slate-400 mb-3">{activity.description}</p>
                                  )}
                                  <div className="flex items-center gap-4 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Target className="w-3 h-3" />
                                      {activity.type}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <BarChart3 className="w-3 h-3" />
                                      {activity.total_responses || 0} responses
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {activity.options?.length || 0} options
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  {/* Vote Lock/Unlock Button - Only show for active activities */}
                                  {isActive && (
                                    <Button
                                      variant={isLocked ? "danger" : "ghost"}
                                      size="sm"
                                      onClick={() => handleToggleVoteLock(activity)}
                                      className="text-slate-400 hover:text-white"
                                      title={isLocked ? 'Unlock Votes' : 'Lock Votes'}
                                    >
                                      {isLocked ? (
                                        <Unlock className="w-4 h-4" />
                                      ) : (
                                        <Lock className="w-4 h-4" />
                                      )}
                                    </Button>
                                  )}
                                  
                                  {isActive ? (
                                    <Button
                                      onClick={() => handleEndActivity(activity.id)}
                                      size="sm"
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      <Square className="w-4 h-4" />
                                      End
                                    </Button>
                                  ) : (
                                    <Button
                                      onClick={() => handleStartActivity(selectedRoom.id, activity.id)}
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      <Play className="w-4 h-4" />
                                      Start
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingActivity(activity)}
                                    className="text-slate-400 hover:text-white"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteConfirmation({
                                      type: 'activity',
                                      id: activity.id,
                                      name: activity.title
                                    })}
                                    className="text-slate-400 hover:text-red-400"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                    </AnimatePresence>

                    {(!selectedRoom.activities || selectedRoom.activities.length === 0) && (
                      <div className="text-center py-12 text-slate-400">
                        <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No activities created yet</p>
                        <p className="text-sm">Add your first activity to get started</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-12 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <h2 className="text-xl font-semibold text-white mb-2">Select a Room</h2>
                <p className="text-slate-400">Choose a room from the list to view and manage its activities</p>
              </Card>
            )}
          </div>

          {/* Right Column - Activity Controls */}
          <div className="lg:col-span-1">
            <ActivityControlsSection />
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreateRoom && (
          <RoomSettings
            onSave={handleCreateRoom}
            onCancel={() => setShowCreateRoom(false)}
          />
        )}

        {editingRoom && (
          <RoomSettings
            room={editingRoom}
            onSave={handleEditRoom}
            onCancel={() => setEditingRoom(null)}
          />
        )}

        {showCreateActivity && selectedRoom && (
          <ActivityEditor
            roomId={selectedRoom.id}
            onSave={handleCreateActivity}
            onCancel={() => setShowCreateActivity(false)}
          />
        )}

        {editingActivity && (
          <ActivityEditor
            roomId={selectedRoom!.id}
            activity={editingActivity}
            onSave={handleSaveActivity}
            onCancel={() => setEditingActivity(null)}
          />
        )}

        {deleteConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Delete {deleteConfirmation.type === 'room' ? 'Room' : 'Activity'}
              </h3>
              <p className="text-slate-300 mb-6">
                Are you sure you want to delete "{deleteConfirmation.name}"? This action cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setDeleteConfirmation(null)}
                  disabled={deleteConfirmation.loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => deleteConfirmation.type === 'room' 
                    ? handleDeleteRoom(deleteConfirmation.id)
                    : handleDeleteActivity(deleteConfirmation.id)
                  }
                  disabled={deleteConfirmation.loading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {deleteConfirmation.loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {resetConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Reset Room
              </h3>
              <p className="text-slate-300 mb-4">
                Are you sure you want to reset "{resetConfirmation.roomName}"?
              </p>
              <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4 mb-6">
                <p className="text-orange-300 text-sm font-medium mb-2">This will:</p>
                <ul className="text-orange-200 text-sm space-y-1">
                  <li>• Clear all participant responses and votes</li>
                  <li>• Reset all activity vote counts to 0</li>
                  <li>• Stop any currently active activities</li>
                  <li>• Reset participant count to 0</li>
                </ul>
                <p className="text-orange-300 text-sm mt-3 font-medium">
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setResetConfirmation(null)}
                  disabled={resetConfirmation.loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleResetRoom(resetConfirmation.roomId)}
                  disabled={resetConfirmation.loading}
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                >
                  {resetConfirmation.loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset Room
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};