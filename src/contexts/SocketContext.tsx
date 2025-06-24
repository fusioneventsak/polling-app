import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
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
    'activity-data-changed': CustomEvent<{ id: string; room_id: string; total_responses: number; is_active: boolean; settings?: any; title?: string; description?: string; media_url?: string }>;
    'option-data-changed': CustomEvent<{ id: string; activity_id: string; responses: number; is_correct: boolean; text: string; media_url?: string; option_order: number }>;
  }
}

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [rooms, setRooms] = useState<Room[]>([]);

  // Use ref to store current rooms state to avoid stale closures
  const roomsRef = useRef<Room[]>([]);

  // Keep roomsRef current whenever rooms state changes
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

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
          
          if (payload.eventType === 'UPDATE' && payload.new) {
            // For updates, broadcast granular data change
            const activityData = {
              id: payload.new.id,
              room_id: payload.new.room_id,
              total_responses: payload.new.total_responses,
              is_active: payload.new.is_active,
              settings: payload.new.settings,
              title: payload.new.title,
              description: payload.new.description,
              media_url: payload.new.media_url
            };
            
            window.dispatchEvent(new CustomEvent('activity-data-changed', {
              detail: activityData
            }));
            
            // Also broadcast the traditional event for compatibility
            broadcastActivityUpdate(payload.new.id, payload.new.room_id, payload.new.is_active);
          } else {
            // For INSERT/DELETE, still do full reload
            loadRooms();
            
            const activityId = payload.new?.id || payload.old?.id;
            const roomId = payload.new?.room_id || payload.old?.room_id;
            const isActive = payload.new?.is_active;
            if (activityId && roomId) {
              broadcastActivityUpdate(activityId, roomId, isActive);
            }
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activity_options' },
        (payload) => {
          console.log('📝 Activity options change:', payload.eventType);
          
          if (payload.eventType === 'UPDATE' && payload.new) {
            // For updates, broadcast granular option data change
            const optionData = {
              id: payload.new.id,
              activity_id: payload.new.activity_id,
              responses: payload.new.responses,
              is_correct: payload.new.is_correct,
              text: payload.new.text,
              media_url: payload.new.media_url,
              option_order: payload.new.option_order
            };
            
            window.dispatchEvent(new CustomEvent('option-data-changed', {
              detail: optionData
            }));
          } else {
            // For INSERT/DELETE, do full reload
            loadRooms();
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'participant_responses' },
        (payload) => {
          console.log('👥 Response change:', payload.eventType);
          // Don't reload rooms for participant responses - the counts are updated via activity_options changes
          // This prevents unnecessary full reloads when votes are submitted
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