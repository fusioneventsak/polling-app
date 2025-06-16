import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { roomService } from '../services/roomService';
import type { Room, Activity } from '../types';

interface SocketContextType {
  isConnected: boolean;
  rooms: Room[];
  currentRoom: Room | null;
  refreshRooms: () => Promise<void>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);

  const loadRooms = async () => {
    try {
      const roomsData = await roomService.getAllRooms();
      setRooms(roomsData);
    } catch (error) {
      console.error('Error loading rooms:', error);
      setRooms([]);
    }
  };

  const refreshRooms = async () => {
    await loadRooms();
  };

  useEffect(() => {
    // Initialize connection
    setIsConnected(!!supabase);
    
    if (!supabase) {
      console.warn('Supabase not available - real-time features disabled');
      return;
    }
    
    // Load initial rooms
    loadRooms();

    // Create a unique channel for global updates
    const channelName = `global-updates-${Date.now()}`;
    const globalChannel = supabase.channel(channelName);
    
    // Subscribe to all room changes
    globalChannel
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          console.log('Room change received:', payload);
          loadRooms();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        (payload) => {
          console.log('Activity change received:', payload);
          loadRooms();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activity_options' },
        (payload) => {
          console.log('Activity options change received:', payload);
          loadRooms();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'participant_responses' },
        (payload) => {
          console.log('Response change received:', payload);
          loadRooms();
        }
      )
      .subscribe((status, err) => {
        console.log('Global subscription status:', status);
        if (err) {
          console.error('Global subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Global real-time subscriptions active');
        }
      });

    return () => {
      console.log('Cleaning up global subscriptions');
      globalChannel.unsubscribe();
    };
  }, []);

  const value = {
    isConnected,
    rooms,
    currentRoom,
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