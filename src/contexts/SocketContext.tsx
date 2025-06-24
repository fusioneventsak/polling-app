// src/contexts/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase, checkSupabaseConnection, retrySupabaseOperation } from '../lib/supabase';
import { connectionManager } from '../lib/connectionManager';
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

  const loadRooms = useCallback(async () => {
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

  useEffect(() => {
    let connectionMonitor: NodeJS.Timeout | null = null;

    // Initialize connection
    const initializeConnection = async () => {
      if (!supabase) {
        console.warn('Supabase not available - real-time features disabled');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        return;
      }
      
      try {
        setConnectionStatus('reconnecting');
        const connectionOk = await checkSupabaseConnection();
        
        if (connectionOk) {
          await loadRooms();
          await setupGlobalSubscriptions();
          setIsConnected(true);
          setConnectionStatus('connected');
        } else {
          setIsConnected(false);
          setConnectionStatus('disconnected');
        }
      } catch (error) {
        console.error('Failed to initialize connection:', error);
        setIsConnected(false);
        setConnectionStatus('disconnected');
      }
    };

    const setupGlobalSubscriptions = async () => {
      if (!supabase) return;

      try {
        console.log('🔌 Setting up global subscriptions...');
        
        const channel = await connectionManager.getOrCreateChannel('global-updates', {
          presence: { key: 'user_id' }
        });

        // Subscribe to all table changes
        channel
          .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'rooms' },
            (payload) => {
              console.log('🏠 Room change received:', payload);
              loadRooms();
            }
          )
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'activities' },
            (payload) => {
              console.log('🎯 Activity change received:', payload);
              loadRooms();
            }
          )
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'activity_options' },
            (payload) => {
              console.log('📝 Activity options change received:', payload);
              loadRooms();
            }
          )
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'participant_responses' },
            (payload) => {
              console.log('👥 Response change received:', payload);
              loadRooms();
            }
          );

        console.log('✅ Global subscriptions established');
        setConnectionStatus('connected');
        
      } catch (error) {
        console.error('❌ Failed to setup global subscriptions:', error);
        setConnectionStatus('disconnected');
        
        // Retry after delay
        setTimeout(() => {
          if (supabase) {
            console.log('🔄 Retrying global subscription setup...');
            setupGlobalSubscriptions();
          }
        }, 5000);
      }
    };
    
    // Start initialization
    initializeConnection();

    // Set up periodic connection monitoring
    connectionMonitor = setInterval(async () => {
      if (!supabase) return;
      
      try {
        const connectionOk = await checkSupabaseConnection();
        const wasConnected = isConnected;
        
        setIsConnected(connectionOk);
        
        if (!wasConnected && connectionOk) {
          console.log('🔄 Connection restored, reinitializing...');
          setConnectionStatus('reconnecting');
          await setupGlobalSubscriptions();
          await loadRooms();
          setConnectionStatus('connected');
        } else if (!connectionOk && wasConnected) {
          console.warn('❌ Connection lost');
          setConnectionStatus('disconnected');
        }
      } catch (error) {
        console.warn('Connection monitor error:', error);
        setIsConnected(false);
        setConnectionStatus('disconnected');
      }
    }, 15000); // Check every 15 seconds

    return () => {
      console.log('🧹 Cleaning up SocketContext...');
      if (connectionMonitor) {
        clearInterval(connectionMonitor);
      }
      // Clean up all channels when context unmounts
      connectionManager.cleanupAllChannels();
    };
  }, [loadRooms]);

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