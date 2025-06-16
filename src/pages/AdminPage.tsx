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

  // Enhanced real-time subscriptions
  useEffect(() => {
    if (!supabase) return;

    console.log('Admin: Setting up enhanced real-time subscriptions');

    const adminChannel = supabase
      .channel(`admin-realtime-${Date.now()}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          console.log('Admin: Room change received:', {
            eventType: payload.eventType,
            roomId: payload.new?.id || payload.old?.id,
            oldCurrentActivityId: payload.old?.current_activity_id,
            newCurrentActivityId: payload.new?.current_activity_id
          });
          
          // Immediate reload for room changes
          if (payload.eventType === 'DELETE') {
            console.log('Admin: Skipping reload for DELETE event to prevent conflicts with optimistic updates');
            return;
          }
          
          // For INSERT and UPDATE events, refresh immediately
          loadRooms();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        (payload) => {
          console.log('Admin: Activity change received:', {
            eventType: payload.eventType,
            activityId: payload.new?.id || payload.old?.id,
            isActive: payload.new?.is_active,
            roomId: payload.new?.room_id || payload.old?.room_id
          });
          
          // Skip reload for DELETE events to prevent conflicts with optimistic updates
          if (payload.eventType === 'DELETE') {
            console.log('Admin: Skipping reload for DELETE activity event to prevent conflicts');
            return;
          }
          
          // For INSERT and UPDATE events, refresh immediately
          loadRooms();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'responses' },
        (payload) => {
          console.log('Admin: Response change received:', {
            eventType: payload.eventType,
            responseId: payload.new?.id || payload.old?.id,
            activityId: payload.new?.activity_id || payload.old?.activity_id
          });
          
          // Refresh rooms to update response counts
          loadRooms();
        }
      )
      .subscribe();

    return () => {
      console.log('Admin: Cleaning up real-time subscriptions');
      supabase.removeChannel(adminChannel);
    };
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      setError(null);
      const roomsData = await roomService.getAllRooms();
      console.log('Admin: Loaded rooms:', roomsData.length);
      setRooms(roomsData);
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
      if (selectedRoom) {
        const optimisticRoom = {
          ...selectedRoom,
          activities: selectedRoom.activities?.map(a => ({
            ...a,
            is_active: a.id === activityId ? true : false
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
      
      const updatedActivity = await roomService.updateActivity(activityData.id, activityData);
      
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
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Room Administration</h1>
            <p className="text-slate-300 mt-2">Manage your interactive sessions and activities</p>
          </div>
          <Button onClick={() => setShowCreateRoom(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Room
          </Button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6"
          >
            <p className="text-red-400">{error}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setError(null)}
              className="mt-2 text-red-400 hover:text-red-300"
            >
              Dismiss
            </Button>
          </motion.div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Rooms List */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Rooms</h2>
                {loading && (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {rooms.map((room) => (
                  <motion.div
                    key={room.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedRoom?.id === room.id
                        ? 'bg-blue-500/20 border-blue-500/50'
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                    }`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-white truncate">{room.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-300">
                          {room.code}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDisplayPage(room.code);
                          }}
                          className="text-blue-400 hover:text-blue-300"
                          title="Open Display Page"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <span>{room.participants} participants</span>
                      <span>{room.activities?.length || 0} activities</span>
                    </div>
                    
                    {room.current_activity_id && (
                      <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Live activity active
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </Card>
          </div>

          {/* Room Details and Activities */}
          <div className="lg:col-span-2">
            {selectedRoom ? (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedRoom.name}</h2>
                    <p className="text-slate-300">{selectedRoom.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {selectedRoom.participants} participants
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart3 className="w-4 h-4" />
                        {selectedRoom.activities?.length || 0} activities
                      </span>
                      <span className="font-mono bg-slate-700 px-2 py-1 rounded">
                        {selectedRoom.code}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDisplayPage(selectedRoom.code)}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Display
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmation({
                        type: 'room',
                        id: selectedRoom.id,
                        name: selectedRoom.name
                      })}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Activities Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Activities</h3>
                    <Button 
                      onClick={() => setShowCreateActivity(true)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Activity
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence>
                      {selectedRoom.activities
                        ?.filter(activity => !deletingActivities.has(activity.id))
                        .map((activity) => {
                          const isActive = activity.is_active;
                          const isCurrentActivity = selectedRoom.current_activity_id === activity.id;
                          
                          return (
                            <motion.div
                              key={activity.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              className={`p-4 rounded-lg border-2 ${
                                isActive 
                                  ? 'bg-green-500/10 border-green-500/30' 
                                  : 'bg-slate-700/30 border-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h4 className="font-medium text-white">{activity.title}</h4>
                                    {isActive && (
                                      <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                                        ● LIVE
                                      </span>
                                    )}
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      isActive 
                                        ? 'bg-green-500/20 text-green-400' 
                                        : 'bg-slate-500/20 text-slate-400'
                                    }`}>
                                      {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                                    </span>
                                  </div>
                                  <div className="text-sm text-slate-400">
                                    {activity.total_responses || 0} responses • {activity.options?.length || 0} options
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingActivity(activity)}
                                    className="opacity-70 hover:opacity-100"
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
                                    className="opacity-70 hover:opacity-100 text-red-400 hover:text-red-300"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>

                                  {isActive ? (
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => handleEndActivity(activity.id)}
                                    >
                                      <Square className="w-4 h-4" />
                                      Stop
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() => handleStartActivity(selectedRoom.id, activity.id)}
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

        {editingActivity && selectedRoom && (
          <ActivityEditor
            roomId={selectedRoom.id}
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-semibold text-white mb-4">
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
                  onClick={deleteConfirmation.type === 'room' 
                    ? () => handleDeleteRoom(deleteConfirmation.id)
                    : () => handleDeleteActivity(deleteConfirmation.id)
                  }
                  disabled={deleteConfirmation.loading}
                  className="flex items-center gap-2"
                >
                  {deleteConfirmation.loading && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};