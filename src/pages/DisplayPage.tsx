// Replace the subscription useEffect in DisplayPage.tsx with this:

import { supabase } from '../lib/supabase';
import { connectionManager } from '../lib/connectionManager';
import { roomService } from '../services/roomService';
import { useTheme } from '../components/ThemeProvider';

  // FIXED: Real-time subscriptions using connection manager - prevents multiple subscriptions
  useEffect(() => {
    if (!pollId || !supabase) return;

    let isSubscriptionActive = true;

    const setupSubscriptions = async () => {
      try {
        console.log('🔄 DisplayPage: Setting up real-time subscription for room:', pollId);

        // Step 1: Get or create the channel
        const channelName = `display_room_${pollId}`;
        const channel = await connectionManager.getOrCreateChannel(channelName);

        // Only proceed if subscription is still active (component not unmounted)
        if (!isSubscriptionActive) {
          console.log('❌ DisplayPage: Subscription cancelled - component unmounted');
          return;
        }

        console.log('✅ DisplayPage: Channel obtained, setting up event listeners...');

        // Step 2: Define all event listeners
        const listeners = [
          {
            event: '*',
            schema: 'public',
            table: 'rooms',
            filter: `code=eq.${pollId}`,
            callback: (payload: any) => {
              console.log('🏠 DisplayPage: Room change received:', {
                eventType: payload.eventType,
                currentActivityId: payload.new?.current_activity_id,
                currentActivityType: payload.new?.current_activity_type
              });
              loadRoom();
            }
          },
          {
            event: '*',
            schema: 'public',
            table: 'activities',
            callback: (payload: any) => {
              console.log('🎯 DisplayPage: Activity change received:', {
                eventType: payload.eventType,
                activityId: payload.new?.id || payload.old?.id,
                isActive: payload.new?.is_active,
                roomId: payload.new?.room_id || payload.old?.room_id
              });
              
              // Only reload if this activity belongs to our room
              if (currentRoom && (payload.new?.room_id === currentRoom.id || payload.old?.room_id === currentRoom.id)) {
                console.log('🔄 DisplayPage: Activity change is for our room, reloading...');
                loadRoom();
              }
            }
          },
          {
            event: '*',
            schema: 'public',
            table: 'activity_options',
            callback: (payload: any) => {
              console.log('📝 DisplayPage: Option change received:', payload.eventType);
              loadRoom();
            }
          },
          {
            event: '*',
            schema: 'public',
            table: 'participant_responses',
            callback: (payload: any) => {
              console.log('👥 DisplayPage: Response change received:', payload.eventType);
              loadRoom();
            }
          }
        ];

        // Step 3: Add event listeners and subscribe (this prevents multiple subscriptions)
        await connectionManager.addEventListeners(channelName, listeners);

        console.log('✅ DisplayPage: All subscriptions established successfully');

      } catch (error) {
        console.error('❌ DisplayPage: Failed to setup subscriptions:', error);
        
        // Retry after delay if subscription is still active
        if (isSubscriptionActive) {
          setTimeout(() => {
            console.log('🔄 DisplayPage: Retrying subscription setup...');
            setupSubscriptions();
          }, 3000);
        }
      }
    };

    // Start subscription setup
    setupSubscriptions();

    // Cleanup function
    return () => {
      console.log('🧹 DisplayPage: Cleaning up subscriptions');
      isSubscriptionActive = false;
      
      if (pollId) {
        connectionManager.cleanupChannel(`display_room_${pollId}`);
      }
    };
  }, [pollId, loadRoom, currentRoom?.id]);