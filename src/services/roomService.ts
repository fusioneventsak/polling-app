import { supabase } from '../lib/supabase';
import type { Room, Activity, ActivityOption } from '../types';

export class RoomService {
  // Submit response to an activity
  async submitResponse(roomId: string, activityId: string, optionId: string, participantId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    console.log('RoomService: Submitting response:', {
      roomId,
      activityId,
      optionId,
      participantId
    });

    try {
      // Check if participant has already responded to this activity
      const { data: existingResponse, error: checkError } = await supabase
        .from('participant_responses')
        .select('id')
        .eq('activity_id', activityId)
        .eq('participant_id', participantId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('RoomService: Error checking existing response:', checkError);
        throw new Error('Failed to check existing response');
      }

      if (existingResponse) {
        console.log('RoomService: Participant has already voted for this activity');
        throw new Error('You have already voted for this activity');
      }

      // Insert the new response
      const { data: response, error: insertError } = await supabase
        .from('participant_responses')
        .insert({
          room_id: roomId,
          activity_id: activityId,
          option_id: optionId,
          participant_id: participantId,
          response_data: null // For simple polls, this can be null
        })
        .select()
        .single();

      if (insertError) {
        console.error('RoomService: Error inserting response:', insertError);
        throw new Error('Failed to submit response');
      }

      console.log('RoomService: Response submitted successfully:', response.id);

      // Update the option response count atomically
      const { error: optionUpdateError } = await supabase
        .rpc('increment_option_responses', { option_id: optionId });

      if (optionUpdateError) {
        console.error('RoomService: Error updating option count:', optionUpdateError);
        // Don't throw here as the response was already recorded
      }

      // Update the activity total response count atomically
      const { error: activityUpdateError } = await supabase
        .rpc('increment_activity_responses', { activity_id: activityId });

      if (activityUpdateError) {
        console.error('RoomService: Error updating activity count:', activityUpdateError);
        // Don't throw here as the response was already recorded
      }

      console.log('RoomService: All counts updated successfully');

    } catch (error) {
      console.error('RoomService: Error in submitResponse:', error);
      throw error;
    }
  }

  // Get room by code
  async getRoomByCode(code: string): Promise<Room | null> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('RoomService: Getting room by code:', code);

      const { data: room, error } = await supabase
        .from('rooms')
        .select(`
          *,
          activities:activities(
            *,
            options:activity_options(*)
          )
        `)
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows found
          console.log('RoomService: Room not found for code:', code);
          return null;
        }
        console.error('RoomService: Error getting room:', error);
        throw new Error('Failed to get room');
      }

      console.log('RoomService: Room found:', {
        id: room.id,
        name: room.name,
        code: room.code,
        activitiesCount: room.activities?.length || 0
      });

      return room;
    } catch (error) {
      console.error('RoomService: Error in getRoomByCode:', error);
      throw error;
    }
  }

  // Get room by ID
  async getRoomById(id: string): Promise<Room | null> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('RoomService: Getting room by ID:', id);

      const { data: room, error } = await supabase
        .from('rooms')
        .select(`
          *,
          activities:activities(
            *,
            options:activity_options(*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('RoomService: Room not found for ID:', id);
          return null;
        }
        console.error('RoomService: Error getting room by ID:', error);
        throw new Error('Failed to get room');
      }

      return room;
    } catch (error) {
      console.error('RoomService: Error in getRoomById:', error);
      throw error;
    }
  }

  // Update room
  async updateRoom(id: string, updates: Partial<Room>): Promise<Room> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('RoomService: Updating room:', id, updates);

      const { data: room, error } = await supabase
        .from('rooms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('RoomService: Error updating room:', error);
        throw new Error('Failed to update room');
      }

      console.log('RoomService: Room updated successfully');
      return room;
    } catch (error) {
      console.error('RoomService: Error in updateRoom:', error);
      throw error;
    }
  }

  // Create new room
  async createRoom(roomData: {
    name: string;
    code: string;
    settings?: any;
  }): Promise<Room> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('RoomService: Creating room:', roomData);

      const { data: room, error } = await supabase
        .from('rooms')
        .insert({
          ...roomData,
          is_active: true,
          participants: 0,
          settings: roomData.settings || {}
        })
        .select()
        .single();

      if (error) {
        console.error('RoomService: Error creating room:', error);
        throw new Error('Failed to create room');
      }

      console.log('RoomService: Room created successfully:', room.id);
      return room;
    } catch (error) {
      console.error('RoomService: Error in createRoom:', error);
      throw error;
    }
  }

  // Create activity in room
  async createActivity(roomId: string, activityData: {
    title: string;
    description?: string;
    type: 'poll' | 'trivia' | 'quiz';
    media_url?: string;
    settings?: any;
  }): Promise<Activity> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('RoomService: Creating activity:', activityData);

      const { data: activity, error } = await supabase
        .from('activities')
        .insert({
          ...activityData,
          room_id: roomId,
          is_active: false,
          total_responses: 0,
          settings: activityData.settings || {}
        })
        .select()
        .single();

      if (error) {
        console.error('RoomService: Error creating activity:', error);
        throw new Error('Failed to create activity');
      }

      console.log('RoomService: Activity created successfully:', activity.id);
      return activity;
    } catch (error) {
      console.error('RoomService: Error in createActivity:', error);
      throw error;
    }
  }

  // Add option to activity
  async addActivityOption(activityId: string, optionData: {
    text: string;
    media_url?: string;
    option_order?: number;
  }): Promise<ActivityOption> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('RoomService: Adding activity option:', optionData);

      const { data: option, error } = await supabase
        .from('activity_options')
        .insert({
          ...optionData,
          activity_id: activityId,
          responses: 0
        })
        .select()
        .single();

      if (error) {
        console.error('RoomService: Error adding option:', error);
        throw new Error('Failed to add option');
      }

      console.log('RoomService: Option added successfully:', option.id);
      return option;
    } catch (error) {
      console.error('RoomService: Error in addActivityOption:', error);
      throw error;
    }
  }

  // Update activity
  async updateActivity(activityId: string, updates: Partial<Activity>): Promise<Activity> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('RoomService: Updating activity:', activityId, updates);

      const { data: activity, error } = await supabase
        .from('activities')
        .update(updates)
        .eq('id', activityId)
        .select()
        .single();

      if (error) {
        console.error('RoomService: Error updating activity:', error);
        throw new Error('Failed to update activity');
      }

      console.log('RoomService: Activity updated successfully');
      return activity;
    } catch (error) {
      console.error('RoomService: Error in updateActivity:', error);
      throw error;
    }
  }

  // Start activity (set as current and active)
  async startActivity(roomId: string, activityId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('RoomService: Starting activity:', activityId);

      // First, deactivate all other activities in the room
      const { error: deactivateError } = await supabase
        .from('activities')
        .update({ is_active: false })
        .eq('room_id', roomId);

      if (deactivateError) {
        console.error('RoomService: Error deactivating other activities:', deactivateError);
        throw new Error('Failed to deactivate other activities');
      }

      // Activate the target activity
      const { error: activateError } = await supabase
        .from('activities')
        .update({ is_active: true })
        .eq('id', activityId);

      if (activateError) {
        console.error('RoomService: Error activating activity:', activateError);
        throw new Error('Failed to activate activity');
      }

      // Set as current activity in room
      const { error: roomUpdateError } = await supabase
        .from('rooms')
        .update({ current_activity_id: activityId })
        .eq('id', roomId);

      if (roomUpdateError) {
        console.error('RoomService: Error setting current activity:', roomUpdateError);
        throw new Error('Failed to set current activity');
      }

      console.log('RoomService: Activity started successfully');
    } catch (error) {
      console.error('RoomService: Error in startActivity:', error);
      throw error;
    }
  }

  // Stop activity
  async stopActivity(activityId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('RoomService: Stopping activity:', activityId);

      // Get the activity to find its room
      const { data: activity, error: getError } = await supabase
        .from('activities')
        .select('room_id')
        .eq('id', activityId)
        .single();

      if (getError) {
        console.error('RoomService: Error getting activity:', getError);
        throw new Error('Failed to get activity');
      }

      // Deactivate the activity
      const { error: deactivateError } = await supabase
        .from('activities')
        .update({ is_active: false })
        .eq('id', activityId);

      if (deactivateError) {
        console.error('RoomService: Error deactivating activity:', deactivateError);
        throw new Error('Failed to deactivate activity');
      }

      // Clear current activity from room
      const { error: roomUpdateError } = await supabase
        .from('rooms')
        .update({ current_activity_id: null })
        .eq('id', activity.room_id);

      if (roomUpdateError) {
        console.error('RoomService: Error clearing current activity:', roomUpdateError);
        throw new Error('Failed to clear current activity');
      }

      console.log('RoomService: Activity stopped successfully');
    } catch (error) {
      console.error('RoomService: Error in stopActivity:', error);
      throw error;
    }
  }

  // Reset room responses (clear all responses for all activities in room)
  async resetRoomResponses(roomId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('RoomService: Resetting room responses for room:', roomId);

      // Delete all participant responses for this room
      const { error: deleteResponsesError } = await supabase
        .from('participant_responses')
        .delete()
        .eq('room_id', roomId);

      if (deleteResponsesError) {
        console.error('RoomService: Error deleting responses:', deleteResponsesError);
        throw new Error('Failed to delete responses');
      }

      // Reset all activity response counts to 0
      const { error: resetActivitiesError } = await supabase
        .from('activities')
        .update({ total_responses: 0 })
        .eq('room_id', roomId);

      if (resetActivitiesError) {
        console.error('RoomService: Error resetting activity counts:', resetActivitiesError);
        throw new Error('Failed to reset activity counts');
      }

      // Reset all option response counts to 0
      const { error: resetOptionsError } = await supabase
        .from('activity_options')
        .update({ responses: 0 })
        .in('activity_id', 
          supabase
            .from('activities')
            .select('id')
            .eq('room_id', roomId)
        );

      if (resetOptionsError) {
        console.error('RoomService: Error resetting option counts:', resetOptionsError);
        throw new Error('Failed to reset option counts');
      }

      console.log('RoomService: Room responses reset successfully');
    } catch (error) {
      console.error('RoomService: Error in resetRoomResponses:', error);
      throw error;
    }
  }

  // Lock/unlock voting for an activity
  async toggleActivityVoting(activityId: string, locked: boolean): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('RoomService: Toggling activity voting:', activityId, 'locked:', locked);

      const { error } = await supabase
        .from('activities')
        .update({ 
          settings: { voting_locked: locked }
        })
        .eq('id', activityId);

      if (error) {
        console.error('RoomService: Error toggling voting:', error);
        throw new Error('Failed to toggle voting');
      }

      console.log('RoomService: Activity voting toggled successfully');
    } catch (error) {
      console.error('RoomService: Error in toggleActivityVoting:', error);
      throw error;
    }
  }
}

export const roomService = new RoomService();