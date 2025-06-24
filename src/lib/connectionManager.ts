// src/lib/connectionManager.ts - Fixed to prevent multiple subscriptions
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface ChannelInfo {
  channel: RealtimeChannel;
  isSubscribed: boolean;
  listeners: Set<string>;
}

class ConnectionManager {
  private channels: Map<string, ChannelInfo> = new Map();
  private connectionPromises: Map<string, Promise<RealtimeChannel>> = new Map();

  async getOrCreateChannel(channelName: string, config?: any): Promise<RealtimeChannel> {
    // Check if we already have a channel
    const existingChannelInfo = this.channels.get(channelName);
    if (existingChannelInfo) {
      console.log(`♻️ Reusing existing channel: ${channelName}`);
      return existingChannelInfo.channel;
    }

    // Check if we're already creating this channel
    const existingPromise = this.connectionPromises.get(channelName);
    if (existingPromise) {
      console.log(`⏳ Waiting for existing channel creation: ${channelName}`);
      return existingPromise;
    }

    // Create new channel
    const channelPromise = this.createChannel(channelName, config);
    this.connectionPromises.set(channelName, channelPromise);

    try {
      const channel = await channelPromise;
      this.channels.set(channelName, {
        channel,
        isSubscribed: false,
        listeners: new Set()
      });
      return channel;
    } finally {
      this.connectionPromises.delete(channelName);
    }
  }

  // NEW: Method to add event listeners without re-subscribing
  async addEventListeners(
    channelName: string, 
    listeners: { 
      event: string; 
      schema: string; 
      table: string; 
      filter?: string; 
      callback: (payload: any) => void 
    }[]
  ): Promise<void> {
    const channelInfo = this.channels.get(channelName);
    if (!channelInfo) {
      throw new Error(`Channel ${channelName} not found. Call getOrCreateChannel first.`);
    }

    const { channel } = channelInfo;

    // Add all event listeners
    listeners.forEach(({ event, schema, table, filter, callback }) => {
      const listenerKey = `${event}_${schema}_${table}_${filter || 'no-filter'}`;
      
      // Only add if not already added
      if (!channelInfo.listeners.has(listenerKey)) {
        console.log(`📡 Adding listener for ${channelName}: ${listenerKey}`);
        
        const eventConfig = { event, schema, table } as any;
        if (filter) {
          eventConfig.filter = filter;
        }

        channel.on('postgres_changes', eventConfig, callback);
        channelInfo.listeners.add(listenerKey);
      } else {
        console.log(`⚠️ Listener already exists for ${channelName}: ${listenerKey}`);
      }
    });

    // Subscribe only once
    if (!channelInfo.isSubscribed) {
      console.log(`🔌 Subscribing to channel: ${channelName}`);
      
      return new Promise((resolve, reject) => {
        let hasResolved = false;
        
        const timeout = setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            console.error(`⏰ Channel subscription timeout: ${channelName}`);
            reject(new Error(`Channel subscription timeout: ${channelName}`));
          }
        }, 15000);

        try {
          channel.subscribe((status, err) => {
            console.log(`📡 Channel ${channelName} status: ${status}`);
            
            if (hasResolved) return;
            
            if (status === 'SUBSCRIBED') {
              hasResolved = true;
              clearTimeout(timeout);
              channelInfo.isSubscribed = true;
              console.log(`✅ Channel subscribed: ${channelName}`);
              resolve();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              hasResolved = true;
              clearTimeout(timeout);
              console.error(`❌ Channel error for ${channelName}:`, status, err);
              reject(new Error(`Channel subscription failed: ${status}`));
            } else if (status === 'CLOSED') {
              console.warn(`🔌 Channel closed: ${channelName}`);
              this.handleChannelClosed(channelName);
            }
          });
        } catch (error) {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            console.error(`❌ Channel subscription error for ${channelName}:`, error);
            reject(error);
          }
        }
      });
    } else {
      console.log(`✅ Channel already subscribed: ${channelName}`);
    }
  }

  private async createChannel(channelName: string, config?: any): Promise<RealtimeChannel> {
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    // Clean up any existing channel with the same name
    const existingChannelInfo = this.channels.get(channelName);
    if (existingChannelInfo) {
      console.log(`🧹 Cleaning up existing channel: ${channelName}`);
      await this.cleanupChannel(channelName);
    }

    console.log(`🔌 Creating new channel: ${channelName}`);
    
    // Create channel with minimal config
    const channel = supabase.channel(channelName);
    return channel;
  }

  private handleChannelClosed(channelName: string) {
    console.log(`🔄 Handling closed channel: ${channelName}`);
    this.channels.delete(channelName);
    this.connectionPromises.delete(channelName);
  }

  async cleanupChannel(channelName: string): Promise<void> {
    const channelInfo = this.channels.get(channelName);
    if (channelInfo) {
      console.log(`🧹 Unsubscribing from channel: ${channelName}`);
      try {
        await channelInfo.channel.unsubscribe();
      } catch (error) {
        console.warn(`Warning during channel cleanup for ${channelName}:`, error);
      }
      this.channels.delete(channelName);
    }
    this.connectionPromises.delete(channelName);
  }

  async cleanupAllChannels(): Promise<void> {
    console.log('🧹 Cleaning up all channels...');
    const cleanupPromises = Array.from(this.channels.keys()).map(channelName =>
      this.cleanupChannel(channelName)
    );
    await Promise.all(cleanupPromises);
    this.channels.clear();
    this.connectionPromises.clear();
  }

  getChannelStatus(channelName: string): string {
    const channelInfo = this.channels.get(channelName);
    if (!channelInfo) return 'not_created';
    return channelInfo.isSubscribed ? 'subscribed' : 'created';
  }

  listActiveChannels(): string[] {
    return Array.from(this.channels.entries())
      .filter(([, info]) => info.isSubscribed)
      .map(([name]) => name);
  }
}

export const connectionManager = new ConnectionManager();

// Clean up on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    connectionManager.cleanupAllChannels();
  });
}