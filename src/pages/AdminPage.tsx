import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Plus, Settings, Play, Square, Trash2, Edit, Users, BarChart3, ArrowLeft } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ActivityEditor } from '../components/ActivityEditor';
import { RoomSettings } from '../components/RoomSettings';
import { DraggableActivity } from '../components/DraggableActivity';
import { roomService } from '../services/roomService';
import { supabase } from '../lib/supabase';
import type { Room, Activity, CreateRoomData } from '../types';

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showActivityEditor, setShowActivityEditor] = useState(false);
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'room' | 'activity';
    id: string;
    name: string;
    loading?: boolean;
  } | null>(null);
  // Track activities that are being deleted to prevent them from reappearing
  const [deletingActivities, setDeletingActivities] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRooms();
  }, []);

  // Set up real-time subscriptions for admin updates
  useEffect(() => {
    if (!supabase) return;

    console.log('Setting up admin real-time subscriptions');

    // Create a unique channel for admin updates
    const channelName = `admin-updates-${Date.now()}`;
    const adminChannel = supabase.channel(channelName);
    
    // Track recent deletions to avoid refreshing immediately after our own deletions
    let recentDeletions = new Set<string>();
    
    // Subscribe to all room changes
    adminChannel
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          console.log('Admin: Room change received:', payload);
          // Always refresh for room changes
          setTimeout(loadRooms, 100);
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        (payload) => {
          console.log('Admin: Activity change received:', payload);
          
          // If this is a DELETE event that we just performed, skip the refresh for a moment
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            const deletedId = payload.old.id;
            recentDeletions.add(deletedId);
            
            // Remove from recent deletions after 2 seconds
            setTimeout(() => {
              recentDeletions.delete(deletedId);
            }, 2000);
            
            console.log('Skipping immediate refresh for recent deletion:', deletedId);
            return;
          }
          
          // For other activity events (INSERT, UPDATE), refresh normally
          setTimeout(loadRooms, 100);
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activity_options' },
        (payload) => {
          console.log('Admin: Activity options change received:', payload);
          setTimeout(loadRooms, 100);
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'participant_responses' },
        (payload) => {
          console.log('Admin: Response change received:', payload);
          setTimeout(loadRooms, 100);
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
      
      // Immediate optimistic update: remove activity from UI immediately
      const optimisticRoom = {
        ...selectedRoom,
        activities: selectedRoom.activities?.filter(a => a.id !== activityId) || []
      };
      setSelectedRoom(optimisticRoom);
      setRooms(prev => prev.map(room => 
        room.id === selectedRoom.id ? optimisticRoom : room
      ));
      
      // Clear confirmation modal immediately
      setDeleteConfirmation(null);
      
      try {
        // Perform the actual deletion
        await roomService.deleteActivity(activityId);
        console.log('Admin: Activity deleted successfully from database');
        
        // Keep the activity in the deleting set for a bit longer to prevent race conditions
        setTimeout(() => {
          setDeletingActivities(prev => {
            const newSet = new Set(prev);
            newSet.delete(activityId);
            return newSet;
          });
          console.log('Admin: Removed activity from deleting set:', activityId);
        }, 2000);
        
        // Force a complete refresh after successful deletion to ensure consistency
        setTimeout(async () => {
          console.log('Admin: Refreshing rooms after successful deletion');
          await loadRooms();
        }, 500);
        
      } catch (deleteError) {
        console.error('Failed to delete activity from database:', deleteError);
        
        // Remove from deleting set since deletion failed
        setDeletingActivities(prev => {
          const newSet = new Set(prev);
          newSet.delete(activityId);
          return newSet;
        });
        
        // Revert optimistic update by restoring the deleted activity
        if (activityToDelete) {
          const revertedActivities = [...(optimisticRoom.activities || []), activityToDelete]
            .sort((a, b) => a.activity_order - b.activity_order);
          
          const revertedRoom = {
            ...selectedRoom,
            activities: revertedActivities
          };
          
          setSelectedRoom(revertedRoom);
          setRooms(prev => prev.map(room => 
            room.id === selectedRoom.id ? revertedRoom : room
          ));
        }
        
        setError(`Failed to delete activity: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`);
        throw deleteError;
      }
      
    } catch (err) {
      console.error('Error in handleDeleteActivity:', err);
      // The error handling above should have already reverted the UI
    }
  };

  const handleStartActivity = async (roomId: string, activityId: string) => {
    try {
      console.log('Starting activity:', activityId, 'in room:', roomId);
      
      // Optimistic update: immediately update activity status
      if (selectedRoom) {
        const optimisticRoom = {
          ...selectedRoom,
          activities: selectedRoom.activities?.map(a => ({
            ...a,
            is_active: a.id === activityId ? true : false
          })) || [],
          current_activity_id: activityId
        };
        setSelectedRoom(optimisticRoom);
        setRooms(prev => prev.map(room => 
          room.id === selectedRoom.id ? optimisticRoom : room
        ));
      }
      
      await roomService.startActivity(roomId, activityId);
      console.log('Activity started successfully');
    } catch (err) {
      // Revert optimistic update on error
      console.error('Failed to start activity, reverting optimistic update');
      await loadRooms();
      setError('Failed to start activity');
      console.error('Error starting activity:', err);
    }
  };

  const handleEndActivity = async (activityId: string) => {
    try {
      console.log('Ending activity:', activityId);
      
      // Optimistic update: immediately update activity status
      if (selectedRoom) {
        const optimisticRoom = {
          ...selectedRoom,
          activities: selectedRoom.activities?.map(a => ({
            ...a,
            is_active: a.id === activityId ? false : a.is_active
          })) || [],
          current_activity_id: null
        };
        setSelectedRoom(optimisticRoom);
        setRooms(prev => prev.map(room => 
          room.id === selectedRoom.id ? optimisticRoom : room
        ));
      }
      
      await roomService.endActivity(activityId);
      console.log('Activity ended successfully');
    } catch (err) {
      // Revert optimistic update on error
      console.error('Failed to end activity, reverting optimistic update');
      await loadRooms();
      setError('Failed to end activity');
      console.error('Error ending activity:', err);
    }
  };

  const handleActivitySaved = (activity: Activity) => {
    if (!selectedRoom) return;

    // Optimistic update: immediately update the activity in UI
    const updatedActivities = editingActivity
      ? selectedRoom.activities?.map(a => a.id === activity.id ? activity : a) || []
      : [...(selectedRoom.activities || []), activity].sort((a, b) => a.activity_order - b.activity_order);

    const updatedRoom = {
      ...selectedRoom,
      activities: updatedActivities
    };

    setSelectedRoom(updatedRoom);
    setRooms(prev => prev.map(room => 
      room.id === selectedRoom.id ? updatedRoom : room
    ));
    
    setShowActivityEditor(false);
    setEditingActivity(null);
    
    // Refresh to ensure consistency
    loadRooms();
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !selectedRoom?.activities) return;

    const items = Array.from(selectedRoom.activities);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const activityIds = items.map(activity => activity.id);
    handleReorderActivities(activityIds);
  };

  const handleDisplayActivity = (activityId: string) => {
    if (selectedRoom?.code) {
      window.open(`/display/${selectedRoom.code}`, '_blank');
    }
  };

  const handleReorderActivities = async (activityIds: string[]) => {
    if (!selectedRoom) return;

    try {
      // Optimistic update: immediately reorder activities in UI
      const reorderedActivities = activityIds.map((id, index) => {
        const activity = selectedRoom.activities?.find(a => a.id === id);
        return activity ? { ...activity, activity_order: index + 1 } : null;
      }).filter(Boolean) as Activity[];

      const updatedRoom = {
        ...selectedRoom,
        activities: reorderedActivities
      };

      setSelectedRoom(updatedRoom);
      setRooms(prev => prev.map(room => 
        room.id === selectedRoom.id ? updatedRoom : room
      ));

      await roomService.reorderActivities(selectedRoom.id, activityIds);
    } catch (err) {
      // Revert optimistic update on error
      console.error('Failed to reorder activities, reverting optimistic update');
      await loadRooms();
      setError('Failed to reorder activities');
      console.error('Error reordering activities:', err);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-slate-400">Manage your rooms and activities</p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreateRoom(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Room
          </Button>
        </div>

        {error && (
          <Card className="p-4 bg-red-500/10 border-red-500/20">
            <p className="text-red-400">{error}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rooms List */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Rooms ({rooms.length})
              </h2>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedRoom?.id === room.id
                        ? 'bg-blue-500/20 border-blue-500/50'
                        : 'bg-slate-700/30 border-slate-600 hover:bg-slate-700/50'
                    }`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-white">{room.name}</h3>
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
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-slate-400 mb-2">
                      Code: <span className="font-mono">{room.code}</span>
                    </p>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {room.participants}
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart3 className="w-4 h-4" />
                        {room.activities?.length || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Room Details & Activities */}
          <div className="lg:col-span-2">
            {selectedRoom ? (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {selectedRoom.name}
                    </h2>
                    <p className="text-slate-400">
                      Room Code: <span className="font-mono font-bold">{selectedRoom.code}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowRoomSettings(true)}
                      className="flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Button>
                    <Button
                      onClick={() => setShowActivityEditor(true)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Activity
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">
                    Activities ({selectedRoom.activities?.length || 0})
                  </h3>
                  
                  {selectedRoom.activities && selectedRoom.activities.length > 0 ? (
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="activities">
                        {(provided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-3"
                          >
                            {selectedRoom.activities.map((activity, index) => (
                              <Draggable
                                key={activity.id}
                                draggableId={activity.id}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                  >
                                    <DraggableActivity
                                      activity={activity}
                                      index={index}
                                      onStart={handleStartActivity}
                                      onStop={handleEndActivity}
                                      onEdit={(activity) => {
                                        setEditingActivity(activity);
                                        setShowActivityEditor(true);
                                      }}
                                      onDelete={(activityId) => {
                                        setDeleteConfirmation({
                                          type: 'activity',
                                          id: activityId,
                                          name: activity.title
                                        });
                                      }}
                                      onDisplay={() => handleDisplayActivity(activity.id)}
                                      roomId={selectedRoom.id}
                                      isDragging={snapshot.isDragging}
                                      dragHandleProps={provided.dragHandleProps}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  ) : (
                    <div className="text-center py-12 bg-slate-800/30 rounded-lg">
                      <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-400 mb-4">
                        No activities created yet
                      </p>
                      <Button
                        onClick={() => setShowActivityEditor(true)}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Create First Activity
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-12 text-center">
                <Settings className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  Select a Room
                </h3>
                <p className="text-slate-400">
                  Choose a room from the list to manage its activities and settings
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Modals */}
        {showCreateRoom && (
          <RoomSettings
            onSave={handleCreateRoom}
            onCancel={() => setShowCreateRoom(false)}
          />
        )}

        {showRoomSettings && selectedRoom && (
          <RoomSettings
            room={selectedRoom}
            onSave={async (roomData) => {
              try {
                const updatedRoom = await roomService.updateRoom(selectedRoom.id, roomData);
                setSelectedRoom(updatedRoom);
                setRooms(prev => prev.map(room => 
                  room.id === selectedRoom.id ? updatedRoom : room
                ));
                setShowRoomSettings(false);
              } catch (err) {
                setError('Failed to update room');
                console.error('Error updating room:', err);
              }
            }}
            onCancel={() => setShowRoomSettings(false)}
          />
        )}

        {showActivityEditor && selectedRoom && (
          <ActivityEditor
            roomId={selectedRoom.id}
            activity={editingActivity}
            onSave={handleActivitySaved}
            onCancel={() => {
              setShowActivityEditor(false);
              setEditingActivity(null);
            }}
          />
        )}

        {deleteConfirmation && (
          <ConfirmationModal
            title={`Delete ${deleteConfirmation.type}`}
            message={`Are you sure you want to delete "${deleteConfirmation.name}"? This action cannot be undone.`}
            confirmText="Delete"
            variant="danger"
            loading={deleteConfirmation.loading}
            onConfirm={() => {
              if (deleteConfirmation.type === 'room') {
                handleDeleteRoom(deleteConfirmation.id);
              } else {
                handleDeleteActivity(deleteConfirmation.id);
              }
            }}
            onCancel={() => setDeleteConfirmation(null)}
          />
        )}
      </div>
    </Layout>
  );
};