import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, checkSupabaseConnection, retrySupabaseOperation } from '../lib/supabase';
import { roomService } from '../services/roomService';
import type { Room, Activity } from '../types';

interface SocketContextType {
  isConnected: boolean;
  rooms: Room[];
  currentRoom: Room | null;
  refreshRooms: () => Promise<void>;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);

  const loadRooms = async () => {
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
  };

  const refreshRooms = async () => {
    await loadRooms();
  };

  useEffect(() => {
    // Initialize connection
    const initializeConnection = async () => {
      if (!supabase) {
        console.warn('Supabase not available - real-time features disabled');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        return;
      }
      
      try {
        const connectionOk = await checkSupabaseConnection();
        setIsConnected(connectionOk);
        setConnectionStatus(connectionOk ? 'connected' : 'disconnected');
        
        if (connectionOk) {
          await loadRooms();
        }
      } catch (error) {
        console.error('Failed to initialize connection:', error);
        setIsConnected(false);
        setConnectionStatus('disconnected');
      }
    };
    
    initializeConnection();

    // Set up periodic connection monitoring
    const connectionMonitor = setInterval(async () => {
      if (!supabase) return;
      
      try {
        const connectionOk = await checkSupabaseConnection();
        const wasConnected = isConnected;
        
        setIsConnected(connectionOk);
        setConnectionStatus(connectionOk ? 'connected' : 'disconnected');
        
        // If connection was restored, reload rooms
        if (!wasConnected && connectionOk) {
          console.log('SocketContext: Connection restored, reloading rooms');
          await loadRooms();
        }
      } catch (error) {
        console.warn('Connection monitor error:', error);
        setIsConnected(false);
        setConnectionStatus('disconnected');
      }
    }, 15000); // Check every 15 seconds
    // Create a unique channel for global updates
    const channelName = `global-updates-${Date.now()}`;
    const globalChannel = supabase?.channel(channelName, {
      config: {
        presence: {
          key: 'user_id'
        }
      }
    });
    
    if (globalChannel) {
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
            setConnectionStatus('disconnected');
            // Retry connection after a delay
            setTimeout(() => {
              if (supabase) {
                console.log('Retrying Supabase connection...');
                initializeConnection();
              }
            }, 5000);
          }
          if (status === 'SUBSCRIBED') {
            console.log('✅ Global real-time subscriptions active');
            setConnectionStatus('connected');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('Supabase channel error or timeout:', status);
            setConnectionStatus('disconnected');
          }
        });
    }

    return () => {
      console.log('Cleaning up global subscriptions');
      clearInterval(connectionMonitor);
      globalChannel?.unsubscribe();
    };
  }, []);

  const value = {
    isConnected,
    connectionStatus,
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