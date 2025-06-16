import React, { useState, useEffect } from 'react';
import { Plus, Users, Play, Square, Trash2, Edit3, MoreVertical, ExternalLink, BarChart3, Clock, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { RoomSettings } from '../components/RoomSettings';
import { ActivityEditor } from '../components/ActivityEditor';
import { roomService } from '../services/roomService';
import { supabase } from '../lib/supabase';
import type { Room, Activity, CreateRoomData, CreateActivityData } from '../types';

export const AdminPage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'room' | 'activity';
    id: string;
    name: string;
    loading?: boolean;
  } | null>(null);
  const [deletingActivities, setDeletingActivities] = useState<Set<string>>(new Set());

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
              console.log('Admin: Skipping reload - activity optimistic update already applied');
              return;
            }
          }
        }
        
        // Reload for other activity changes
        loadRooms();
      }
    );

    // Subscribe to response changes
    adminChannel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'participant_responses' },
      (payload) => {
        console.log('Admin: Response change received:', {
          eventType: payload.eventType,
          responseId: payload.new?.id || payload.old?.id,
          activityId: payload.new?.activity_id || payload.old?.activity_id
        });
        
        // Always refresh for response changes to update counts
        loadRooms();
      }
    );

    // Subscribe with proper error handling
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
      console.log('Admin: Cleaning up real-time subscriptions');
      // Use unsubscribe instead of removeChannel to avoid WebSocket conflicts
      adminChannel.unsubscribe();
    };
  }, [rooms, selectedRoom]); // Include dependencies to check current state

  const loadRooms = async () => {
    try {
      setLoading(true);
      setError(null);
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
      
      await roomService.endActivity(activityId);
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
      
      const newActivity = await roomService.createActivity(activityData);
      
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
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Sidebar - Room List */}
          <div className="lg:w-80">
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

          {/* Main Content - Activity Management */}
          <div className="flex-1">
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
                                  <div className="flex items-center gap-3">
                                    <h4 className="font-semibold text-white">{activity.title}</h4>
                                    {isActive && (
                                      <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-400 mt-1">
                                    Type: {activity.type} • Responses: {activity.total_responses || 0}
                                  </p>
                                  {activity.description && (
                                    <p className="text-sm text-slate-500 mt-2">{activity.description}</p>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2">
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
                                  {isActive ? (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => handleEndActivity(activity.id)}
                                      >
                                        <Square className="w-4 h-4" />
                                        Stop
                                      </Button>
                                      <span className="text-xs text-green-400 font-medium">ACTIVE</span>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() => handleStartActivity(selectedRoom.id, activity.id)}
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      <Play className="w-4 h-4" />
                                      Start
                                    </Button>
                                  )}
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
              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setDeleteConfirmation(null)}
                  disabled={deleteConfirmation.loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (deleteConfirmation.type === 'room') {
                      handleDeleteRoom(deleteConfirmation.id);
                    } else {
                      handleDeleteActivity(deleteConfirmation.id);
                    }
                  }}
                  disabled={deleteConfirmation.loading}
                >
                  {deleteConfirmation.loading ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};