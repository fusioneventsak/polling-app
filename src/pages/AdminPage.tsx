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
  } | null>(null);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const roomsData = await roomService.getAllRooms();
      setRooms(roomsData);
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
      await roomService.deleteRoom(roomId);
      setRooms(prev => prev.filter(room => room.id !== roomId));
      if (selectedRoom?.id === roomId) {
        setSelectedRoom(null);
      }
      setDeleteConfirmation(null);
    } catch (err) {
      setError('Failed to delete room');
      console.error('Error deleting room:', err);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    try {
      await roomService.deleteActivity(activityId);
      if (selectedRoom) {
        const updatedRoom = {
          ...selectedRoom,
          activities: selectedRoom.activities.filter(activity => activity.id !== activityId)
        };
        setSelectedRoom(updatedRoom);
        setRooms(prev => prev.map(room => 
          room.id === selectedRoom.id ? updatedRoom : room
        ));
      }
      setDeleteConfirmation(null);
    } catch (err) {
      setError('Failed to delete activity');
      console.error('Error deleting activity:', err);
    }
  };

  const handleStartActivity = async (activityId: string) => {
    if (!selectedRoom) return;
    
    try {
      await roomService.startActivity(selectedRoom.id, activityId);
      const updatedRoom = {
        ...selectedRoom,
        current_activity_id: activityId,
        activities: selectedRoom.activities.map(activity => ({
          ...activity,
          is_active: activity.id === activityId
        }))
      };
      setSelectedRoom(updatedRoom);
      setRooms(prev => prev.map(room => 
        room.id === selectedRoom.id ? updatedRoom : room
      ));
    } catch (err) {
      setError('Failed to start activity');
      console.error('Error starting activity:', err);
    }
  };

  const handleEndActivity = async (activityId: string) => {
    if (!selectedRoom) return;
    
    try {
      await roomService.endActivity(activityId);
      const updatedRoom = {
        ...selectedRoom,
        current_activity_id: null,
        current_activity_type: null,
        activities: selectedRoom.activities.map(activity => ({
          ...activity,
          is_active: false
        }))
      };
      setSelectedRoom(updatedRoom);
      setRooms(prev => prev.map(room => 
        room.id === selectedRoom.id ? updatedRoom : room
      ));
    } catch (err) {
      setError('Failed to end activity');
      console.error('Error ending activity:', err);
    }
  };

  const handleActivitySaved = (activity: Activity) => {
    if (!selectedRoom) return;

    const updatedActivities = editingActivity
      ? selectedRoom.activities.map(a => a.id === activity.id ? activity : a)
      : [...selectedRoom.activities, activity];

    const updatedRoom = {
      ...selectedRoom,
      activities: updatedActivities.sort((a, b) => a.activity_order - b.activity_order)
    };

    setSelectedRoom(updatedRoom);
    setRooms(prev => prev.map(room => 
      room.id === selectedRoom.id ? updatedRoom : room
    ));
    setShowActivityEditor(false);
    setEditingActivity(null);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !selectedRoom) return;

    const items = Array.from(selectedRoom.activities);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const activityIds = items.map(activity => activity.id);
    handleReorderActivities(activityIds);
  };

  const handleDisplayActivity = (activityId: string) => {
    navigate(`/display/${selectedRoom?.code}/${activityId}`);
  };

  const handleReorderActivities = async (activityIds: string[]) => {
    if (!selectedRoom) return;

    try {
      await roomService.reorderActivities(selectedRoom.id, activityIds);
      const reorderedActivities = activityIds.map((id, index) => {
        const activity = selectedRoom.activities.find(a => a.id === id);
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
    } catch (err) {
      setError('Failed to reorder activities');
      console.error('Error reordering activities:', err);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Admin Dashboard
            </h1>
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
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Rooms List */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Rooms ({rooms.length})
              </h2>
              <div className="space-y-3">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedRoom?.id === room.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {room.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Code: {room.code}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {room.participants}
                          </span>
                          <span className="flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" />
                            {room.activities?.length || 0}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            room.is_active
                              ? 'bg-green-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        />
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
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {rooms.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No rooms created yet
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Room Details */}
          <div className="lg:col-span-2">
            {selectedRoom ? (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedRoom.name}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                      Room Code: <span className="font-mono font-bold">{selectedRoom.code}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
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
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400 mb-4">
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
                <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Select a Room
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
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
            confirmVariant="danger"
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