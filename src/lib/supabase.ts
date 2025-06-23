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
          eventsPerSecond: 10,
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          'x-client-info': 'pollstream-app',
        },
      },
    })
  : null;

// Connection status tracking
let isConnected = true;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Function to check Supabase connection
export const checkSupabaseConnection = async (): Promise<boolean> => {
  if (!supabase) {
    console.warn('⚠️ Supabase client not initialized');
    return false;
  }

  try {
    // Simple query to test connection
    const { error } = await supabase.from('rooms').select('count').limit(1);
    
    if (error) {
      console.error('❌ Supabase connection test failed:', error);
      isConnected = false;
      return false;
    }
    
    if (!isConnected) {
      console.log('✅ Supabase connection restored');
      isConnected = true;
      reconnectAttempts = 0;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error);
    isConnected = false;
    return false;
  }
};

// Function to handle connection retry
export const retrySupabaseOperation = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check connection before attempting operation
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
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
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
  
  // Handle specific error types
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
  
  if (error?.message?.includes('network')) {
    return new Error('Network error. Please check your internet connection.');
  }
  
  return new Error(error?.message || `${operation} failed`);
};
// Test connection on initialization only if supabase is available
if (supabase) {
  // Initial connection test
  checkSupabaseConnection().then((connected) => {
    if (connected) {
      console.log('✅ Supabase connected successfully');
    } else {
      console.error('❌ Initial Supabase connection failed');
    }
  });
  
  // Set up connection monitoring
  setInterval(async () => {
    if (!isConnected) {
      reconnectAttempts++;
      if (reconnectAttempts <= maxReconnectAttempts) {
        console.log(`🔄 Attempting to reconnect to Supabase (${reconnectAttempts}/${maxReconnectAttempts})`);
        await checkSupabaseConnection();
      }
    }
  }, 10000); // Check every 10 seconds
} else {
  console.warn('⚠️ Supabase not configured - running in demo mode');
  console.warn('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
}