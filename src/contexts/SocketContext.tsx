// src/contexts/SocketContext.tsx - Updated to use correct connectionManager methods
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
    let setupAttempts = 0;
    const maxSetupAttempts = 3;

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

      setupAttempts++;
      
      try {
        console.log(`🔌 SocketContext: Setting up global subscriptions (attempt ${setupAttempts}/${maxSetupAttempts})...`);
        
        const channelName = 'global-updates';
        
        // Get channel
        const channel = await connectionManager.getChannel(channelName);
        if (!channel) {
          console.warn('⚠️ Failed to get global channel, real-time features may be limited');
          setConnectionStatus('disconnected');
          return;
        }

        // Add event listeners with error handling
        console.log('📡 SocketContext: Adding postgres_changes listeners...');
        channel
          .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'rooms' },
            (payload) => {
              try {
                console.log('🏠 SocketContext: Room change received:', payload.eventType);
                loadRooms();
              } catch (error) {
                console.warn('⚠️ Error handling room change:', error);
              }
            }
          )
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'activities' },
            (payload) => {
              try {
                console.log('🎯 SocketContext: Activity change received:', payload.eventType);
                loadRooms();
              } catch (error) {
                console.warn('⚠️ Error handling activity change:', error);
              }
            }
          )
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'activity_options' },
            (payload) => {
              try {
                console.log('📝 SocketContext: Activity options change received:', payload.eventType);
                loadRooms();
              } catch (error) {
                console.warn('⚠️ Error handling activity options change:', error);
              }
            }
          )
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'participant_responses' },
            (payload) => {
              try {
                console.log('👥 SocketContext: Response change received:', payload.eventType);
                loadRooms();
              } catch (error) {
                console.warn('⚠️ Error handling response change:', error);
              }
            }
          );

        // Subscribe
        console.log('🔌 SocketContext: Attempting subscription...');
        const subscribed = await connectionManager.subscribe(channelName);
        
        if (subscribed) {
          console.log('✅ SocketContext: Global subscriptions established');
          setConnectionStatus('connected');
          setupAttempts = 0; // Reset attempts on success
        } else {
          throw new Error(`Subscription failed for ${channelName}`);
        }
        
      } catch (error) {
        console.warn(`⚠️ SocketContext: Failed to setup global subscriptions (attempt ${setupAttempts}):`, error.message || error);
        setConnectionStatus('disconnected');
        
        // Retry with exponential backoff, but only if we haven't exceeded max attempts
        if (setupAttempts < maxSetupAttempts) {
          const retryDelay = Math.min(setupAttempts * 5000, 15000);
          console.log(`🔄 SocketContext: Retrying global subscription in ${retryDelay}ms...`);
          
          setTimeout(() => {
            if (supabase) {
              setupGlobalSubscriptions();
            }
          }, retryDelay);
        } else {
          console.warn('⚠️ SocketContext: Max global subscription attempts reached. App will work with manual refresh.');
          setupAttempts = 0; // Reset for potential future attempts
        }
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
          console.log('🔄 SocketContext: Connection restored, reinitializing...');
          setConnectionStatus('reconnecting');
          setupAttempts = 0; // Reset attempts when connection is restored
          await setupGlobalSubscriptions();
          await loadRooms();
          setConnectionStatus('connected');
        } else if (!connectionOk && wasConnected) {
          console.warn('❌ SocketContext: Connection lost');
          setConnectionStatus('disconnected');
        }
      } catch (error) {
        console.warn('SocketContext: Connection monitor error:', error);
        setIsConnected(false);
        setConnectionStatus('disconnected');
      }
    }, 30000); // Check every 30 seconds

    return () => {
      console.log('🧹 SocketContext: Cleaning up...');
      if (connectionMonitor) {
        clearInterval(connectionMonitor);
      }
      // FIXED: Use correct method name
      connectionManager.cleanup('global-updates');
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