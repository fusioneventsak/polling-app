// src/lib/connectionManager.ts
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

class ConnectionManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private connectionPromises: Map<string, Promise<RealtimeChannel>> = new Map();
  private isReconnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  async getOrCreateChannel(channelName: string, config?: any): Promise<RealtimeChannel> {
    // Check if we already have a connected channel
    const existingChannel = this.channels.get(channelName);
    if (existingChannel && existingChannel.state === 'joined') {
      console.log(`♻️ Reusing existing channel: ${channelName}`);
      return existingChannel;
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
      this.channels.set(channelName, channel);
      return channel;
    } finally {
      this.connectionPromises.delete(channelName);
    }
  }

  private async createChannel(channelName: string, config?: any): Promise<RealtimeChannel> {
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    // Clean up any existing channel with the same name
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      console.log(`🧹 Cleaning up existing channel: ${channelName}`);
      await this.cleanupChannel(channelName);
    }

    console.log(`🔌 Creating new channel: ${channelName}`);
    
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: 'user_id' },
        ...config
      }
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(`⏰ Channel subscription timeout: ${channelName}`);
        reject(new Error(`Channel subscription timeout: ${channelName}`));
      }, 10000); // 10 second timeout

      channel.subscribe((status, err) => {
        console.log(`📡 Channel ${channelName} status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          console.log(`✅ Channel connected: ${channelName}`);
          resolve(channel);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          console.error(`❌ Channel error for ${channelName}:`, status, err);
          reject(new Error(`Channel subscription failed: ${status}`));
        } else if (status === 'CLOSED') {
          console.warn(`🔌 Channel closed: ${channelName}`);
          this.handleChannelClosed(channelName);
        }
      });
    });
  }

  private handleChannelClosed(channelName: string) {
    this.channels.delete(channelName);
    this.connectionPromises.delete(channelName);
    
    // Trigger reconnection if not already reconnecting
    if (!this.isReconnecting) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.isReconnecting = true;
    this.reconnectTimer = setTimeout(() => {
      this.isReconnecting = false;
      console.log('🔄 Attempting to reconnect closed channels...');
      // You can implement reconnection logic here if needed
    }, 5000);
  }

  async cleanupChannel(channelName: string): Promise<void> {
    const channel = this.channels.get(channelName);
    if (channel) {
      console.log(`🧹 Unsubscribing from channel: ${channelName}`);
      try {
        await channel.unsubscribe();
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
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  getChannelStatus(channelName: string): string {
    const channel = this.channels.get(channelName);
    return channel ? channel.state : 'not_created';
  }

  listActiveChannels(): string[] {
    return Array.from(this.channels.entries())
      .filter(([, channel]) => channel.state === 'joined')
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