// src/lib/supabase.ts - Fixed transport configuration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Environment check:');
console.log('- Supabase URL:', supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'Missing');
console.log('- Supabase Anon Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'Missing');
console.log('- Environment:', import.meta.env.MODE);

// Create supabase client only if environment variables are available
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 5,
        },
        heartbeatIntervalMs: 60000,
        reconnectAfterMs: (tries) => {
          const baseDelay = Math.min(tries * 2000, 30000);
          const jitter = Math.random() * 1000;
          return baseDelay + jitter;
        },
        timeout: 20000,
        // REMOVE transport: 'websocket' - this causes the constructor error
        logger: (kind, msg, data) => {
          if (kind === 'error') {
            console.error(`🔴 Supabase Realtime ${kind}:`, msg, data);
          } else {
            console.log(`🔵 Supabase Realtime ${kind}:`, msg);
          }
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'x-client-info': 'pollstream-app',
        },
      },
    })
  : null;

// Connection status tracking
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let lastConnectionCheck = 0;
const CONNECTION_CHECK_INTERVAL = 5000;

// Function to check Supabase connection with caching
export const checkSupabaseConnection = async (): Promise<boolean> => {
  if (!supabase) {
    console.warn('⚠️ Supabase client not initialized - missing environment variables');
    return false;
  }

  // Throttle connection checks
  const now = Date.now();
  if (now - lastConnectionCheck < CONNECTION_CHECK_INTERVAL && isConnected) {
    return isConnected;
  }
  lastConnectionCheck = now;

  try {
    // Use a simple health check instead of auth
    const { data, error } = await Promise.race([
      supabase.from('rooms').select('count').limit(1),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      )
    ]) as any;
    
    if (error) {
      // Some errors are expected and don't indicate connection issues
      if (error.code === 'PGRST116' || error.message?.includes('JWT')) {
        if (!isConnected) {
          console.log('✅ Supabase connection restored (auth error is expected)');
          isConnected = true;
          reconnectAttempts = 0;
        }
        return true;
      } else {
        console.error('❌ Supabase connection test failed:', error.message);
        isConnected = false;
        return false;
      }
    }
    
    if (!isConnected) {
      console.log('✅ Supabase connection restored');
      isConnected = true;
      reconnectAttempts = 0;
    }
    
    return true;
  } catch (error: any) {
    if (error.message?.includes('timeout') || error.message?.includes('Failed to fetch')) {
      console.error('❌ Supabase network connection failed - check internet connection and Supabase URL');
    } else {
      console.error('❌ Supabase connection error:', error.message);
    }
    isConnected = false;
    return false;
  }
};

// Function to handle connection retry with exponential backoff
export const retrySupabaseOperation = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const connectionOk = await checkSupabaseConnection();
      
      if (!connectionOk && attempt === 1) {
        console.warn(`⚠️ Supabase connection issue detected for ${operationName}, retrying...`);
      }
      
      const result = await operation();
      
      if (attempt > 1) {
        console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ ${operationName} failed on attempt ${attempt}:`, error);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`⏳ Retrying ${operationName} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`);
};

// Enhanced error handler for Supabase operations
export const handleSupabaseError = (error: any, operation: string): Error => {
  console.error(`Supabase ${operation} error:`, error);
  
  if (error?.code === 'PGRST301') {
    return new Error('Database connection lost. Please check your internet connection.');
  }
  
  if (error?.code === 'PGRST116') {
    return new Error('No data found.');
  }
  
  if (error?.code === '23505') {
    return new Error('This data already exists.');
  }
  
  if (error?.code === '23503') {
    return new Error('Referenced data not found.');
  }
  
  if (error?.message?.includes('JWT')) {
    return new Error('Authentication expired. Please refresh the page.');
  }
  
  if (error?.message?.includes('network') || error?.message?.includes('timeout')) {
    return new Error('Network error. Please check your internet connection.');
  }
  
  return new Error(error?.message || `${operation} failed`);
};

// Initialize connection monitoring only if supabase is available
if (supabase) {
  setTimeout(async () => {
    const connected = await checkSupabaseConnection();
    if (connected) {
      console.log('✅ Supabase connected successfully');
    } else {
      console.error('❌ Initial Supabase connection failed');
    }
  }, 1000);
  
  const startConnectionMonitoring = () => {
    setInterval(async () => {
      if (!isConnected) {
        reconnectAttempts++;
        if (reconnectAttempts <= maxReconnectAttempts) {
          const delay = Math.min(reconnectAttempts * 2000, 30000);
          console.log(`🔄 Attempting to reconnect to Supabase (${reconnectAttempts}/${maxReconnectAttempts}) after ${delay}ms`);
          
          setTimeout(async () => {
            await checkSupabaseConnection();
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached. Please refresh the page.');
        }
      } else {
        reconnectAttempts = 0;
      }
    }, 30000);
  };

  startConnectionMonitoring();
} else {
  console.warn('⚠️ Supabase not configured - running in demo mode');
  console.warn('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
}