import { supabase, retrySupabaseOperation, handleSupabaseError } from '../lib/supabase';
import type { Room, Activity, ActivityOption } from '../types';

export class RoomService {
  // Get all rooms (for admin)
  async getAllRooms(): Promise<Room[]> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Getting all rooms');

      const { data: rooms, error } = await supabase
        .from('rooms')
        .select(`
          *,
          activities!activities_room_id_fkey(
            *,
            options:activity_options(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw handleSupabaseError(error, 'getAllRooms');
      }

      console.log('RoomService: Retrieved', rooms?.length || 0, 'rooms');
      return rooms || [];
    }, 'getAllRooms');
  }

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

    return retrySupabaseOperation(async () => {
      // Check if participant has already responded to this activity
      const { data: existingResponse, error: checkError } = await supabase
        .from('participant_responses')
        .select('id')
        .eq('activity_id', activityId)
        .eq('participant_id', participantId)
        .maybeSingle(); // Use maybeSingle to avoid 406 errors

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw handleSupabaseError(checkError, 'checkExistingResponse');
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
          participant_id: participantId
        })
        .select()
        .single();

      if (insertError) {
        throw handleSupabaseError(insertError, 'insertResponse');
      }

      console.log('RoomService: Response submitted successfully:', response.id);

      // Update the option response count atomically (if function exists)
      try {
        const { error: optionUpdateError } = await supabase
          .rpc('increment_option_responses', { option_id: optionId });

        if (optionUpdateError) {
          console.warn('RoomService: Error updating option count (function may not exist):', optionUpdateError);
          // Fallback to manual update
          await supabase
            .from('activity_options')
            .update({ responses: supabase.sql`responses + 1` })
            .eq('id', optionId);
        }
      } catch (rpcError) {
        console.warn('RoomService: RPC function not available, using manual update');
        await supabase
          .from('activity_options')
          .update({ responses: supabase.sql`responses + 1` })
          .eq('id', optionId);
      }

      // Update the activity total response count atomically (if function exists)
      try {
        const { error: activityUpdateError } = await supabase
          .rpc('increment_activity_responses', { activity_id: activityId });

        if (activityUpdateError) {
          console.warn('RoomService: Error updating activity count (function may not exist):', activityUpdateError);
          // Fallback to manual update
          await supabase
            .from('activities')
            .update({ total_responses: supabase.sql`total_responses + 1` })
            .eq('id', activityId);
        }
      } catch (rpcError) {
        console.warn('RoomService: RPC function not available, using manual update');
        await supabase
          .from('activities')
          .update({ total_responses: supabase.sql`total_responses + 1` })
          .eq('id', activityId);
      }

      console.log('RoomService: All counts updated successfully');

    }, 'submitResponse');
  }

  // Get room by code
  async getRoomByCode(code: string): Promise<Room | null> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Getting room by code:', code);

      const { data: room, error } = await supabase
        .from('rooms')
        .select(`
          *,
          activities!activities_room_id_fkey(
            *,
            options:activity_options(*)
          )
        `)
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle(); // Use maybeSingle to avoid 406 errors

      if (error && error.code !== 'PGRST116') {
        throw handleSupabaseError(error, 'getRoomByCode');
      }

      if (!room) {
        console.log('RoomService: Room not found for code:', code);
        return null;
      }

      console.log('RoomService: Room found:', {
        id: room.id,
        name: room.name,
        code: room.code,
        activitiesCount: room.activities?.length || 0
      });

      return room;
    }, 'getRoomByCode');
  }

  // Get room by ID
  async getRoomById(id: string): Promise<Room | null> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Getting room by ID:', id);

      const { data: room, error } = await supabase
        .from('rooms')
        .select(`
          *,
          activities!activities_room_id_fkey(
            *,
            options:activity_options(*)
          )
        `)
        .eq('id', id)
        .maybeSingle(); // Use maybeSingle to avoid 406 errors

      if (error && error.code !== 'PGRST116') {
        throw handleSupabaseError(error, 'getRoomById');
      }

      if (!room) {
        console.log('RoomService: Room not found for ID:', id);
        return null;
      }

      return room;
    }, 'getRoomById');
  }

  // Update room
  async updateRoom(id: string, updates: Partial<Room>): Promise<Room> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Updating room:', id, updates);

      const { data: room, error } = await supabase
        .from('rooms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw handleSupabaseError(error, 'updateRoom');
      }

      console.log('RoomService: Room updated successfully');
      return room;
    }, 'updateRoom');
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

    return retrySupabaseOperation(async () => {
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
        throw handleSupabaseError(error, 'createRoom');
      }

      console.log('RoomService: Room created successfully:', room.id);
      return room;
    }, 'createRoom');
  }

  // Create activity in room
  async createActivity(activityData: {
    room_id: string;
    title: string;
    description?: string;
    type: 'poll' | 'trivia' | 'quiz';
    media_url?: string;
    settings?: any;
    options?: any[];
  }): Promise<Activity> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Creating activity:', activityData);

      // Extract options from activityData
      const { options, room_id, ...activityFields } = activityData;

      // Get the next activity order for this room
      const { data: maxOrderResult, error: orderError } = await supabase
        .from('activities')
        .select('activity_order')
        .eq('room_id', room_id)
        .order('activity_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orderError && orderError.code !== 'PGRST116') {
        throw handleSupabaseError(orderError, 'getMaxActivityOrder');
      }

      const nextOrder = (maxOrderResult?.activity_order || -1) + 1;

      // Create the activity record first
      const { data: activity, error } = await supabase
        .from('activities')
        .insert({
          ...activityFields,
          room_id,
          is_active: false,
          total_responses: 0,
          activity_order: nextOrder,
          settings: activityFields.settings || {}
        })
        .select()
        .single();

      if (error) {
        throw handleSupabaseError(error, 'createActivity');
      }

      console.log('RoomService: Activity created successfully:', activity.id);

      // Create options if provided
      if (options && Array.isArray(options) && options.length > 0) {
        console.log('RoomService: Creating activity options');
        
        const optionsToInsert = options.map((option: any, index: number) => ({
          activity_id: activity.id,
          text: option.text,
          media_url: option.media_url || null,
          is_correct: option.is_correct || false,
          responses: 0,
          option_order: option.option_order !== undefined ? option.option_order : index
        }));

        const { error: optionsError } = await supabase
          .from('activity_options')
          .insert(optionsToInsert);

        if (optionsError) {
          throw handleSupabaseError(optionsError, 'createActivityOptions');
        }

        console.log('RoomService: Activity options created successfully');
      }

      // Return the activity with its options
      const { data: fullActivity, error: fetchError } = await supabase
        .from('activities')
        .select(`
          *,
          options:activity_options(*)
        `)
        .eq('id', activity.id)
        .single();

      if (fetchError) {
        throw handleSupabaseError(fetchError, 'fetchFullActivity');
      }

      return fullActivity;
    }, 'createActivity');
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

    return retrySupabaseOperation(async () => {
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
        throw handleSupabaseError(error, 'addActivityOption');
      }

      console.log('RoomService: Option added successfully:', option.id);
      return option;
    }, 'addActivityOption');
  }

  // Update activity
  async updateActivity(activityId: string, updates: Partial<Activity>): Promise<Activity> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Updating activity:', activityId, updates);

      // Extract options from updates if present
      const { options, ...activityUpdates } = updates as any;

      // Handle options separately if they exist
      if (options && Array.isArray(options)) {
        console.log('RoomService: Updating activity options');
        
        // Delete existing options for this activity
        const { error: deleteError } = await supabase
          .from('activity_options')
          .delete()
          .eq('activity_id', activityId);

        if (deleteError) {
          throw handleSupabaseError(deleteError, 'deleteExistingOptions');
        }

        // Insert new options
        if (options.length > 0) {
          const optionsToInsert = options.map((option: any, index: number) => ({
            activity_id: activityId,
            text: option.text,
            media_url: option.media_url || null,
            is_correct: option.is_correct || false,
            responses: option.responses || 0,
            option_order: option.option_order !== undefined ? option.option_order : index
          }));

          const { error: insertError } = await supabase
            .from('activity_options')
            .insert(optionsToInsert);

          if (insertError) {
            throw handleSupabaseError(insertError, 'insertNewOptions');
          }
        }
      }

      // Update the activity record (without options)
      const { data: activity, error } = await supabase
        .from('activities')
        .update(activityUpdates)
        .eq('id', activityId)
        .select(`
          *,
          options:activity_options(*)
        `)
        .single();

      if (error) {
        throw handleSupabaseError(error, 'updateActivity');
      }

      console.log('RoomService: Activity updated successfully');
      return activity;
    }, 'updateActivity');
  }

  // Start activity (set as current and active)
  async startActivity(roomId: string, activityId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Starting activity:', activityId);

      // First, deactivate all other activities in the room
      const { error: deactivateError } = await supabase
        .from('activities')
        .update({ is_active: false })
        .eq('room_id', roomId);

      if (deactivateError) {
        throw handleSupabaseError(deactivateError, 'deactivateActivities');
      }

      // Activate the target activity
      const { error: activateError } = await supabase
        .from('activities')
        .update({ is_active: true })
        .eq('id', activityId);

      if (activateError) {
        throw handleSupabaseError(activateError, 'activateActivity');
      }

      // Set as current activity in room
      const { error: roomUpdateError } = await supabase
        .from('rooms')
        .update({ current_activity_id: activityId })
        .eq('id', roomId);

      if (roomUpdateError) {
        throw handleSupabaseError(roomUpdateError, 'setCurrentActivity');
      }

      console.log('RoomService: Activity started successfully');
    }, 'startActivity');
  }

  // Stop activity
  async stopActivity(activityId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Stopping activity:', activityId);

      // Get the activity to find its room
      const { data: activity, error: getError } = await supabase
        .from('activities')
        .select('room_id')
        .eq('id', activityId)
        .single();

      if (getError) {
        throw handleSupabaseError(getError, 'getActivity');
      }

      // Deactivate the activity
      const { error: deactivateError } = await supabase
        .from('activities')
        .update({ is_active: false })
        .eq('id', activityId);

      if (deactivateError) {
        throw handleSupabaseError(deactivateError, 'deactivateActivity');
      }

      // Clear current activity from room
      const { error: roomUpdateError } = await supabase
        .from('rooms')
        .update({ current_activity_id: null })
        .eq('id', activity.room_id);

      if (roomUpdateError) {
        throw handleSupabaseError(roomUpdateError, 'clearCurrentActivity');
      }

      console.log('RoomService: Activity stopped successfully');
    }, 'stopActivity');
  }

  // Reset room responses (clear all responses for all activities in room)
  async resetRoomResponses(roomId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Resetting room responses for room:', roomId);

      // Delete all participant responses for this room
      const { error: deleteResponsesError } = await supabase
        .from('participant_responses')
        .delete()
        .eq('room_id', roomId);

      if (deleteResponsesError) {
        throw handleSupabaseError(deleteResponsesError, 'deleteResponses');
      }

      // Reset all activity response counts to 0
      const { error: resetActivitiesError } = await supabase
        .from('activities')
        .update({ total_responses: 0 })
        .eq('room_id', roomId);

      if (resetActivitiesError) {
        throw handleSupabaseError(resetActivitiesError, 'resetActivityCounts');
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
        throw handleSupabaseError(resetOptionsError, 'resetOptionCounts');
      }

      console.log('RoomService: Room responses reset successfully');
    }, 'resetRoomResponses');
  }

  // Reset room (clear all responses and reset counts)
  async resetRoom(roomId: string): Promise<Room> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Resetting room:', roomId);

      // Try to use the database function if it exists
      try {
        const { error: resetError } = await supabase
          .rpc('reset_room_vote_counts', { target_room_id: roomId });

        if (resetError) {
          console.warn('RoomService: Database function not available, using manual reset:', resetError);
          throw resetError;
        }

        console.log('RoomService: Room reset using database function');
      } catch (rpcError) {
        console.warn('RoomService: Database function not available, using manual reset');
        
        // Manual reset process
        // Step 1: Delete all participant responses for this room
        const { error: deleteResponsesError } = await supabase
          .from('participant_responses')
          .delete()
          .eq('room_id', roomId);

        if (deleteResponsesError) {
          throw handleSupabaseError(deleteResponsesError, 'deleteResponses');
        }

        // Step 2: Reset all activity option response counts to 0
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
          throw handleSupabaseError(resetOptionsError, 'resetOptionCounts');
        }

        // Step 3: Reset all activity total response counts and deactivate activities
        const { error: resetActivitiesError } = await supabase
          .from('activities')
          .update({ 
            total_responses: 0,
            is_active: false
          })
          .eq('room_id', roomId);

        if (resetActivitiesError) {
          throw handleSupabaseError(resetActivitiesError, 'resetActivityCounts');
        }

        // Step 4: Reset room state
        const { error: resetRoomError } = await supabase
          .from('rooms')
          .update({
            participants: 0,
            current_activity_id: null,
            current_activity_type: null
          })
          .eq('id', roomId);

        if (resetRoomError) {
          throw handleSupabaseError(resetRoomError, 'resetRoomState');
        }
      }

      // Add a small delay to ensure all database changes are committed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fetch and return the updated room
      const { data: room, error: fetchError } = await supabase
        .from('rooms')
        .select(`
          *,
          activities!activities_room_id_fkey(
            *,
            options:activity_options(*)
          )
        `)
        .eq('id', roomId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw handleSupabaseError(fetchError, 'fetchResetRoom');
      }

      if (!room) {
        throw new Error(`Room with ID ${roomId} not found after reset`);
      }

      console.log('RoomService: Room reset successfully');
      return room;
    }, 'resetRoom');
  }

  // Reset room (clear all responses and reset counts)
  async resetRoom(roomId: string): Promise<Room> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Resetting room:', roomId);

      // Try to use the database function if it exists
      try {
        const { error: resetError } = await supabase
          .rpc('reset_room_vote_counts', { target_room_id: roomId });

        if (resetError) {
          console.warn('RoomService: Database function not available, using manual reset:', resetError);
          throw resetError;
        }

        console.log('RoomService: Room reset using database function');
      } catch (rpcError) {
        console.warn('RoomService: Database function not available, using manual reset');
        
        // Manual reset process
        // Step 1: Delete all participant responses for this room
        const { error: deleteResponsesError } = await supabase
          .from('participant_responses')
          .delete()
          .eq('room_id', roomId);

        if (deleteResponsesError) {
          throw handleSupabaseError(deleteResponsesError, 'deleteResponses');
        }

        // Step 2: Reset all activity option response counts to 0
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
          throw handleSupabaseError(resetOptionsError, 'resetOptionCounts');
        }

        // Step 3: Reset all activity total response counts and deactivate activities
        const { error: resetActivitiesError } = await supabase
          .from('activities')
          .update({ 
            total_responses: 0,
            is_active: false
          })
          .eq('room_id', roomId);

        if (resetActivitiesError) {
          throw handleSupabaseError(resetActivitiesError, 'resetActivityCounts');
        }

        // Step 4: Reset room state
        const { error: resetRoomError } = await supabase
          .from('rooms')
          .update({
            participants: 0,
            current_activity_id: null,
            current_activity_type: null
          })
          .eq('id', roomId);

        if (resetRoomError) {
          throw handleSupabaseError(resetRoomError, 'resetRoomState');
        }
      }

      // Add a small delay to ensure all database changes are committed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fetch and return the updated room
      const { data: room, error: fetchError } = await supabase
        .from('rooms')
        .select(`
          *,
          activities!activities_room_id_fkey(
            *,
            options:activity_options(*)
          )
        `)
        .eq('id', roomId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw handleSupabaseError(fetchError, 'fetchResetRoom');
      }

      if (!room) {
        throw new Error(`Room with ID ${roomId} not found after reset`);
      }

      console.log('RoomService: Room reset successfully');
      return room;
    }, 'resetRoom');
  }

  // Lock/unlock voting for an activity
  async toggleActivityVoting(activityId: string, locked: boolean): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Toggling activity voting:', activityId, 'locked:', locked);

      const { error } = await supabase
        .from('activities')
        .update({ 
          settings: { voting_locked: locked }
        })
        .eq('id', activityId);

      if (error) {
        throw handleSupabaseError(error, 'toggleActivityVoting');
      }

      console.log('RoomService: Activity voting toggled successfully');
    }, 'toggleActivityVoting');
  }

  // Delete room
  async deleteRoom(id: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Deleting room:', id);

      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', id);

      if (error) {
        throw handleSupabaseError(error, 'deleteRoom');
      }

      console.log('RoomService: Room deleted successfully');
    }, 'deleteRoom');
  }

  // Delete activity
  async deleteActivity(id: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    return retrySupabaseOperation(async () => {
      console.log('RoomService: Deleting activity:', id);

      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', id);

      if (error) {
        throw handleSupabaseError(error, 'deleteActivity');
      }

      console.log('RoomService: Activity deleted successfully');
    }, 'deleteActivity');
  }
}

export const roomService = new RoomService();