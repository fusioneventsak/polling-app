// src/lib/connectionManager.ts - Simple working version
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

class ConnectionManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscriptionStates: Map<string, 'idle' | 'subscribing' | 'subscribed' | 'error'> = new Map();
  private retryAttempts: Map<string, number> = new Map();
  private maxRetries = 3;

  async getOrCreateChannel(channelName: string): Promise<RealtimeChannel | null> {
    return this.getChannel(channelName);
  }

  async getChannel(channelName: string): Promise<RealtimeChannel | null> {
    if (!supabase) {
      console.warn('⚠️ Supabase client not available');
      return null;
    }

    // Check if channel already exists
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      console.log(`♻️ Reusing existing channel: ${channelName}`);
      return existingChannel;
    }

    // Create new channel
    console.log(`🔌 Creating new channel: ${channelName}`);
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: channelName
        }
      }
    });
    this.channels.set(channelName, channel);
    this.subscriptionStates.set(channelName, 'idle');
    this.retryAttempts.set(channelName, 0);
    
    return channel;
  }

  async subscribe(channelName: string): Promise<boolean> {
    const channel = this.channels.get(channelName);
    const currentState = this.subscriptionStates.get(channelName);
    const attempts = this.retryAttempts.get(channelName) || 0;

    if (!channel) {
      console.warn(`⚠️ Channel ${channelName} not found, creating...`);
      const newChannel = await this.getChannel(channelName);
      if (!newChannel) {
        console.error(`❌ Failed to create channel ${channelName}`);
        return false;
      }
      return this.subscribe(channelName);
    }

    // Check retry limit
    if (attempts >= this.maxRetries) {
      console.warn(`⚠️ Max retry attempts reached for channel ${channelName}`);
      return false;
    }

    // Don't subscribe if already subscribed or subscribing
    if (currentState === 'subscribed' || currentState === 'subscribing') {
      console.log(`⚠️ Channel ${channelName} already ${currentState}`);
      return currentState === 'subscribed';
    }

    console.log(`📡 Subscribing to channel: ${channelName}`);
    this.subscriptionStates.set(channelName, 'subscribing');
    this.retryAttempts.set(channelName, attempts + 1);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn(`⏰ Subscription timeout for ${channelName} (attempt ${attempts + 1})`);
        this.subscriptionStates.set(channelName, 'error');
        resolve(false);
      }, 15000); // Increased timeout

      channel.subscribe((status, err) => {
        console.log(`📡 Channel ${channelName} status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          this.subscriptionStates.set(channelName, 'subscribed');
          this.retryAttempts.set(channelName, 0); // Reset on success
          console.log(`✅ Channel ${channelName} subscribed successfully`);
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          this.subscriptionStates.set(channelName, 'error');
          console.warn(`⚠️ Channel ${channelName} error:`, status, err);
          resolve(false);
        } else if (status === 'CLOSED') {
          console.log(`🔌 Channel ${channelName} closed`);
          this.subscriptionStates.set(channelName, 'idle');
          this.channels.delete(channelName);
          this.retryAttempts.delete(channelName);
        }
      });
    });
  }

  getSubscriptionState(channelName: string): string {
    return this.subscriptionStates.get(channelName) || 'not_found';
  }

  async cleanup(channelName: string): Promise<void> {
    const channel = this.channels.get(channelName);
    if (channel) {
      console.log(`🧹 Cleaning up channel: ${channelName}`);
      try {
        await channel.unsubscribe();
      } catch (error) {
        console.warn(`Warning during cleanup of ${channelName}:`, error);
      }
      this.channels.delete(channelName);
      this.subscriptionStates.delete(channelName);
      this.retryAttempts.delete(channelName);
    }
  }

  async cleanupAll(): Promise<void> {
    console.log('🧹 Cleaning up all channels...');
    const cleanupPromises = Array.from(this.channels.keys()).map(name => this.cleanup(name));
    await Promise.all(cleanupPromises);
    this.retryAttempts.clear();
  }

  listChannels(): { name: string; state: string }[] {
    return Array.from(this.channels.keys()).map(name => ({
      name,
      state: this.getSubscriptionState(name)
    }));
  }
}

export const connectionManager = new ConnectionManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    connectionManager.cleanupAll();
  });
}