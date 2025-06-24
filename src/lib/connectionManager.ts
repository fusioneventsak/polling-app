// src/lib/connectionManager.ts - Simplified version to avoid transport issues
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

class ConnectionManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private connectionPromises: Map<string, Promise<RealtimeChannel>> = new Map();

  async getOrCreateChannel(channelName: string, config?: any): Promise<RealtimeChannel> {
    // Check if we already have a channel (don't check state to avoid transport issues)
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
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
    
    // Create channel with minimal config to avoid transport issues
    const channel = supabase.channel(channelName);

    return new Promise((resolve, reject) => {
      let hasResolved = false;
      
      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          console.error(`⏰ Channel subscription timeout: ${channelName}`);
          reject(new Error(`Channel subscription timeout: ${channelName}`));
        }
      }, 15000); // Increased timeout to 15 seconds

      try {
        channel.subscribe((status, err) => {
          console.log(`📡 Channel ${channelName} status: ${status}`);
          
          if (hasResolved) return; // Prevent multiple resolutions
          
          if (status === 'SUBSCRIBED') {
            hasResolved = true;
            clearTimeout(timeout);
            console.log(`✅ Channel connected: ${channelName}`);
            resolve(channel);
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
  }

  private handleChannelClosed(channelName: string) {
    console.log(`🔄 Handling closed channel: ${channelName}`);
    this.channels.delete(channelName);
    this.connectionPromises.delete(channelName);
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
  }

  getChannelStatus(channelName: string): string {
    const channel = this.channels.get(channelName);
    return channel ? 'exists' : 'not_created';
  }

  listActiveChannels(): string[] {
    return Array.from(this.channels.keys());
  }
}

export const connectionManager = new ConnectionManager();

// Clean up on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    connectionManager.cleanupAllChannels();
  });
}