Here's the fixed version with all closing brackets added:

```javascript
import React, { useState, useEffect } from 'react';
import { Plus, Users, Play, Square, Trash2, Edit3, MoreVertical, ExternalLink, BarChart3, Clock, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { RoomEditor } from '../components/RoomEditor';
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
            oldIsActive: payload.old?.is_active,
            newIsActive: payload.new?.is_active
          });
          
          if (payload.eventType === 'DELETE') {
            console.log('Admin: Skipping reload for DELETE event to prevent conflicts with optimistic updates');
            return;
          }
          
          // Immediate reload for activity changes
          loadRooms();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activity_options' },
        (payload) => {
          console.log('Admin: Activity options change received:', payload);
          loadRooms();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'participant_responses' },
        (payload) => {
          console.log('Admin: Response change received:', payload);
          loadRooms();
        }
      )
      .subscribe((status, err) => {
        console.log('Admin subscription status:', status);
        if (err) {
          console.error('Admin subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Admin real-time subscriptions active');
        }
      });

    return () => {
      console.log('Cleaning up admin subscriptions');
      adminChannel.unsubscribe();
    };
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const roomsData = await roomService.getAllRooms();
      
      // Filter out any activities that are currently being deleted
      const filteredRoomsData = roomsData.map(room => ({
        ...room,
        activities: room.activities?.filter(activity => !deletingActivities.has(activity.id)) || []
      }));
      
      setRooms(filteredRoomsData);
      
      // Update selected room if it exists
      if (selectedRoom) {
        const updatedSelectedRoom = filteredRoomsData.find(room => room.id === selectedRoom.id);
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

  const handleCreateRoom = async (roomData: CreateRoomData) => {
    try {
      const newRoom = await roomService.createRoom(roomData);
      setRooms(prev => [newRoom, ...prev]);
      setShowCreateRoom(false);
      setSelectedRoom(newRoom);
    } catch (err) {
      setError('Failed to create room');
      console.error('Error creating room:', err);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
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
      
      // Perform the actual deletion
      await roomService.deleteActivity(activityId);
      
      // Remove from deleting set
      setDeletingActivities(prev => {
        const newSet = new Set(prev);
        newSet.delete(activityId);
        return newSet;
      });
      
      // Clear confirmation modal
      setDeleteConfirmation(null);
      
      console.log('Activity deleted successfully');
      
    } catch (deleteError) {
      console.error('Failed to delete activity:', deleteError);
      
      // Remove from deleting set
      setDeletingActivities(prev => {
        const newSet = new Set(prev);
        newSet.delete(activityId);
        return newSet;
      });
      
      // Revert optimistic update on error
      if (selectedRoom && activityToDelete) {
        console.log('Reverting optimistic update for failed deletion');
        const revertedRoom = {
          ...selectedRoom,
          activities: [...(selectedRoom.activities || []), activityToDelete].sort((a, b) => a.activity_order - b.activity_order),
          current_activity_id: wasCurrentActivity ? activityId : selectedRoom.current_activity_id,
          current_activity_type: wasCurrentActivity ? activityToDelete.type : selectedRoom.current_activity_type
        };
        
        setSelectedRoom(revertedRoom);
        setRooms(prev => prev.map(room => 
          room.id === selectedRoom.id ? revertedRoom : room
        ));
      }
      
      setError(`Failed to delete activity: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`);
      setDeleteConfirmation(null);
    }
  };

  const handleStartActivity = async (roomId: string, activityId: string) => {
    try {
      console.log('Admin: Starting activity:', activityId, 'in room:', roomId);
      
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

  const getDisplayUrl = (roomCode: string) => {
    return `${window.location.origin}/display/${roomCode}`;
  };

  const openDisplayPage = (roomCode: string) => {
    window.open(getDisplayUrl(roomCode), '_blank');
  };

  if (loading && rooms.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Room Management</h1>
            <p className="text-slate-400 mt-1">Create and manage interactive sessions</p>
          </div>
          <Button
            onClick={() => setShowCreateRoom(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Room
          </Button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-300 hover:text-red-200 text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rooms List */}
          <div className="lg:col-span-1">
            <Card className="h-fit">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Rooms ({rooms.length})
              </h2>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {rooms.map((room) => (
                  <motion.div
                    key={room.id}
                    layout
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
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
        </div>
      </div>
    </div>
  );
};
```