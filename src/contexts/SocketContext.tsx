import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase, checkSupabaseConnection, retrySupabaseOperation } from '../lib/supabase';
import { roomService } from '../services/roomService';
import type { Room } from '../types';

interface SocketContextType {
  isConnected: boolean;
  rooms: Room[];
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  refreshRooms: () => Promise<void>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Custom event types for broadcasting
declare global {
  interface WindowEventMap {
    'room-updated': CustomEvent<{ roomId: string; roomCode?: string }>;
    'activity-updated': CustomEvent<{ activityId: string; roomId: string; isActive?: boolean }>;
    'responses-updated': CustomEvent<{ activityId: string; roomId: string }>;
  }
}

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [rooms, setRooms] = useState<Room[]>([]);

  const loadRooms = useCallback(async () => {
    setConnectionStatus('reconnecting');
    try {
      // Check connection first
      const connectionOk = await checkSupabaseConnection();
      if (!connectionOk) {
        console.warn('SocketContext: Supabase connection not available');
        setConnectionStatus('disconnected');
        setRooms([]);
        return;
      }
      
      const roomsData = await retrySupabaseOperation(
        () => roomService.getAllRooms(),
        'loadRooms'
      );
      setRooms(roomsData);
      setConnectionStatus('connected');
      setIsConnected(true);
    } catch (error) {
      console.error('Error loading rooms:', error);
      setConnectionStatus('disconnected');
      setIsConnected(false);
      setRooms([]);
    }
  }, []);

  const refreshRooms = useCallback(async () => {
    await loadRooms();
  }, [loadRooms]);

  // Broadcast room changes to listening components
  const broadcastRoomUpdate = useCallback((roomId: string, roomCode?: string) => {
    window.dispatchEvent(new CustomEvent('room-updated', {
      detail: { roomId, roomCode }
    }));
  }, []);

  const broadcastActivityUpdate = useCallback((activityId: string, roomId: string, isActive?: boolean) => {
    window.dispatchEvent(new CustomEvent('activity-updated', {
      detail: { activityId, roomId, isActive }
    }));
  }, []);

  const broadcastResponseUpdate = useCallback((activityId: string, roomId: string) => {
    window.dispatchEvent(new CustomEvent('responses-updated', {
      detail: { activityId, roomId }
    }));
  }, []);

  useEffect(() => {
    if (!supabase) {
      console.warn('Supabase not available');
      setIsConnected(false);
      setConnectionStatus('disconnected');
      return;
    }

    console.log('🔌 Setting up SINGLE global realtime subscription...');
    setConnectionStatus('reconnecting');

    // SINGLE CHANNEL for all realtime updates
    const channel = supabase
      .channel('global-app-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          console.log('🏠 Room change:', payload.eventType);
          loadRooms(); // Refresh rooms data
          
          // Broadcast to specific components
          const roomId = payload.new?.id || payload.old?.id;
          const roomCode = payload.new?.code || payload.old?.code;
          if (roomId) {
            broadcastRoomUpdate(roomId, roomCode);
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        (payload) => {
          console.log('🎯 Activity change:', payload.eventType);
          loadRooms(); // Refresh rooms data
          
          // Broadcast to specific components
          const activityId = payload.new?.id || payload.old?.id;
          const roomId = payload.new?.room_id || payload.old?.room_id;
          const isActive = payload.new?.is_active;
          if (activityId && roomId) {
            broadcastActivityUpdate(activityId, roomId, isActive);
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activity_options' },
        (payload) => {
          console.log('📝 Activity options change:', payload.eventType);
          loadRooms(); // Refresh rooms data
          
          // Find activity and room for broadcasting
          const optionId = payload.new?.id || payload.old?.id;
          const activityId = payload.new?.activity_id || payload.old?.activity_id;
          if (activityId) {
            // Find room ID from current rooms data
            const room = rooms.find(r => r.activities?.some(a => a.id === activityId));
            if (room) {
              broadcastActivityUpdate(activityId, room.id);
            }
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'participant_responses' },
        (payload) => {
          console.log('👥 Response change:', payload.eventType);
          
          // Broadcast to specific components (no need to reload all rooms for responses)
          const activityId = payload.new?.activity_id || payload.old?.activity_id;
          if (activityId) {
            // Find room ID from current rooms data
            const room = rooms.find(r => r.activities?.some(a => a.id === activityId));
            if (room) {
              broadcastResponseUpdate(activityId, room.id);
            }
          }
          
          // Still refresh rooms for updated counts
          loadRooms();
        }
      );

    // Subscribe with simple error handling
    channel.subscribe((status, err) => {
      console.log('📡 Global subscription status:', status);
      if (err) {
        console.error('❌ Subscription error:', err);
        setConnectionStatus('disconnected');
        setIsConnected(false);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ Global realtime subscriptions active');
        setConnectionStatus('connected');
        setIsConnected(true);
      }
    });

    // Initial load
    loadRooms();

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up global subscription');
      channel.unsubscribe();
    };
  }, [loadRooms, broadcastRoomUpdate, broadcastActivityUpdate, broadcastResponseUpdate]);

  const value = {
    isConnected,
    connectionStatus,
    rooms,
    refreshRooms
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};