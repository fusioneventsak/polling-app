import { supabase } from '../lib/supabase';
import type { Room, Activity, CreateRoomData, CreateActivityData, ParticipantResponse } from '../types';

export const roomService = {
  async getAllRooms(): Promise<Room[]> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot fetch rooms');
    }
    
    try {
      const { data: rooms, error } = await supabase
        .from('rooms')
        .select(`
          *,
          activities:activities!activities_room_id_fkey (
            *,
            activity_options!activity_options_activity_id_fkey (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching rooms:', error);
        throw error;
      }

      return rooms?.map(room => ({
        ...room,
        activities: room.activities?.map(activity => ({
          ...activity,
          options: activity.activity_options?.sort((a, b) => a.option_order - b.option_order) || []
        })).sort((a, b) => a.activity_order - b.activity_order) || []
      })) || [];
    } catch (error) {
      console.error('Error in getAllRooms:', error);
      throw error;
    }
  },

  async getRoomByCode(code: string): Promise<Room | null> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot fetch room');
    }
    
    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .select(`
          *,
          activities:activities!activities_room_id_fkey (
            *,
            activity_options!activity_options_activity_id_fkey (*)
          )
        `)
        .eq('code', code)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Room not found
        }
        console.error('Error fetching room by code:', error);
        throw error;
      }

      if (!room) return null;

      return {
        ...room,
        activities: room.activities?.map(activity => ({
          ...activity,
          options: activity.activity_options?.sort((a, b) => a.option_order - b.option_order) || []
        })).sort((a, b) => a.activity_order - b.activity_order) || []
      };
    } catch (error) {
      console.error('Error in getRoomByCode:', error);
      throw error;
    }
  },

  async createRoom(roomData: CreateRoomData): Promise<Room> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot create room');
    }
    
    try {
      // Generate a unique 4-digit code
      let code: string;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 100;

      do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
        const existing = await this.getRoomByCode(code);
        isUnique = !existing;
        attempts++;
      } while (!isUnique && attempts < maxAttempts);

      if (!isUnique) {
        throw new Error('Unable to generate unique room code');
      }

      const { data: room, error } = await supabase
        .from('rooms')
        .insert({
          code,
          name: roomData.name,
          description: roomData.description,
          is_active: true,
          participants: 0,
          settings: roomData.settings || {}
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating room:', error);
        throw error;
      }

      return {
        ...room,
        activities: []
      };
    } catch (error) {
      console.error('Error in createRoom:', error);
      throw error;
    }
  },

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot update room');
    }
    
    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          activities:activities!activities_room_id_fkey (
            *,
            activity_options!activity_options_activity_id_fkey (*)
          )
        `)
        .single();

      if (error) {
        console.error('Error updating room:', error);
        throw error;
      }

      return {
        ...room,
        activities: room.activities?.map(activity => ({
          ...activity,
          options: activity.activity_options?.sort((a, b) => a.option_order - b.option_order) || []
        })).sort((a, b) => a.activity_order - b.activity_order) || []
      };
    } catch (error) {
      console.error('Error in updateRoom:', error);
      throw error;
    }
  },

  async deleteRoom(id: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot delete room');
    }
    
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting room:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in deleteRoom:', error);
      throw error;
    }
  },

  async createActivity(activityData: CreateActivityData): Promise<Activity> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot create activity');
    }
    
    try {
      // Get the next activity order for this room
      const { data: existingActivities, error: countError } = await supabase
        .from('activities')
        .select('activity_order')
        .eq('room_id', activityData.room_id)
        .order('activity_order', { ascending: false })
        .limit(1);

      if (countError) {
        console.error('Error counting activities:', countError);
        throw countError;
      }

      const nextOrder = (existingActivities?.[0]?.activity_order || 0) + 1;

      // Create the activity
      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .insert({
          room_id: activityData.room_id,
          type: activityData.type,
          title: activityData.title,
          description: activityData.description,
          media_url: activityData.media_url,
          settings: activityData.settings || {},
          is_active: false,
          total_responses: 0,
          activity_order: nextOrder
        })
        .select()
        .single();

      if (activityError) {
        console.error('Error creating activity:', activityError);
        throw activityError;
      }

      // Create activity options if provided
      if (activityData.options && activityData.options.length > 0) {
        const optionsToInsert = activityData.options.map((option, index) => ({
          activity_id: activity.id,
          text: option.text,
          media_url: option.media_url,
          is_correct: option.is_correct || false,
          responses: 0,
          option_order: index + 1
        }));

        const { data: options, error: optionsError } = await supabase
          .from('activity_options')
          .insert(optionsToInsert)
          .select();

        if (optionsError) {
          console.error('Error creating activity options:', optionsError);
          throw optionsError;
        }

        return {
          ...activity,
          options: options?.sort((a, b) => a.option_order - b.option_order) || []
        };
      }

      return {
        ...activity,
        options: []
      };
    } catch (error) {
      console.error('Error in createActivity:', error);
      throw error;
    }
  },

  async updateActivity(id: string, updates: any): Promise<Activity> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot update activity');
    }
    
    try {
      // Separate options from other updates
      const { options, ...activityUpdates } = updates;
      
      if (options) {
        // Update options separately
        
        // First, get existing options
        const { data: existingOptions, error: fetchError } = await supabase
          .from('activity_options')
          .select('*')
          .eq('activity_id', id);

        if (fetchError) {
          console.error('Error fetching existing options:', fetchError);
          throw fetchError;
        }

        // Delete existing options
        const { error: deleteError } = await supabase
          .from('activity_options')
          .delete()
          .eq('activity_id', id);

        if (deleteError) {
          console.error('Error deleting existing options:', deleteError);
          throw deleteError;
        }

        // Insert new options
        if (options.length > 0) {
          const optionsToInsert = options.map((option: any, index: number) => ({
            activity_id: id,
            text: option.text,
            media_url: option.media_url,
            is_correct: option.is_correct || false,
            responses: option.responses || 0,
            option_order: index + 1
          }));

          const { error: insertError } = await supabase
            .from('activity_options')
            .insert(optionsToInsert);

          if (insertError) {
            console.error('Error inserting new options:', insertError);
            throw insertError;
          }
        }
        
        // Update the activity itself (without options)
        if (Object.keys(activityUpdates).length > 0) {
          const { error: updateError } = await supabase
            .from('activities')
            .update(activityUpdates)
            .eq('id', id);
          
          if (updateError) {
            console.error('Error updating activity:', updateError);
            throw updateError;
          }
        }
      } else {
        // No options update, just update the activity
        const { error } = await supabase
          .from('activities')
          .update(updates)
          .eq('id', id);

        if (error) {
          console.error('Error updating activity:', error);
          throw error;
        }
      }
      
      // Fetch the complete updated activity with options
      const { data: activity, error: fetchError } = await supabase
        .from('activities')
        .select(`
          *,
          activity_options!activity_options_activity_id_fkey (*)
        `)
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Error fetching updated activity:', fetchError);
        throw fetchError;
      }

      return {
        ...activity,
        options: activity.activity_options?.sort((a, b) => a.option_order - b.option_order) || []
      };
    } catch (error) {
      console.error('Error in updateActivity:', error);
      throw error;
    }
  },

  async deleteActivity(activityId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot delete activity');
    }
    
    try {
      console.log('Deleting activity:', activityId);
      
      // First, verify the activity exists and get room info
      const { data: activityCheck, error: checkError } = await supabase
        .from('activities')
        .select('id, room_id, is_active, title')
        .eq('id', activityId)
        .single();
      
      if (checkError) {
        if (checkError.code === 'PGRST116') {
          console.log('Activity not found, may already be deleted:', activityId);
          return; // Already deleted
        }
        console.error('Error checking activity existence:', checkError);
        throw checkError;
      }
      
      console.log('Found activity to delete:', activityCheck);
      
      // If this is the current activity in the room, clear it
      if (activityCheck.is_active) {
        console.log('Activity is currently active, clearing room current activity');
        const { error: roomUpdateError } = await supabase
          .from('rooms')
          .update({
            current_activity_id: null,
            current_activity_type: null
          })
          .eq('id', activityCheck.room_id);
        
        if (roomUpdateError) {
          console.error('Error clearing room current activity:', roomUpdateError);
          throw roomUpdateError;
        }
      }
      
      // Delete the activity (cascade will handle options and responses)
      const { error: deleteError } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId);
      
      if (deleteError) {
        console.error('Error deleting activity:', deleteError);
        throw deleteError;
      }
      
      // Verify deletion
      const { data: verifyDelete, error: verifyError } = await supabase
        .from('activities')
        .select('id')
        .eq('id', activityId)
        .single();
      
      if (verifyError && verifyError.code !== 'PGRST116') {
        console.error('Error verifying activity deletion:', verifyError);
        throw verifyError;
      }
      
      if (verifyDelete) {
        console.error('Activity deletion failed - activity still exists in database');
        throw new Error('Activity deletion failed - activity still exists in database');
      }
      
      console.log('Activity deleted and verified successfully:', activityId);
    } catch (error) {
      console.error('Error in deleteActivity:', error);
      throw error;
    }
  },

  async reorderActivities(roomId: string, activityIds: string[]): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot reorder activities');
    }
    
    try {
      // Update activity orders in batch
      const updatePromises = activityIds.map((activityId, index) => 
        supabase
          .from('activities')
          .update({ activity_order: index + 1 })
          .eq('id', activityId)
      );

      const results = await Promise.all(updatePromises);
      
      // Check for any errors
      for (const result of results) {
        if (result.error) {
          console.error('Error updating activity order:', result.error);
          throw result.error;
        }
      }
    } catch (error) {
      console.error('Error in reorderActivities:', error);
      throw error;
    }
  },

  async startActivity(roomId: string, activityId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot start activity');
    }
    
    try {
      console.log('Starting activity:', activityId, 'in room:', roomId);
      
      // Get the activity to check its type
      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .select('type, room_id')
        .eq('id', activityId)
        .single();

      if (activityError) {
        console.error('Error fetching activity:', activityError);
        throw activityError;
      }

      // Verify the activity belongs to the specified room
      if (activity.room_id !== roomId) {
        throw new Error('Activity does not belong to the specified room');
      }

      // Start a transaction-like operation
      console.log('Step 1: Deactivating all other activities in room:', roomId);
      
      // First, deactivate all other activities in the room
      const { error: deactivateError } = await supabase
        .from('activities')
        .update({ is_active: false })
        .eq('room_id', roomId);

      if (deactivateError) {
        console.error('Error deactivating activities:', deactivateError);
        throw deactivateError;
      }

      console.log('Step 2: Activating target activity:', activityId);
      
      // Activate the selected activity
      const { error: activateError } = await supabase
        .from('activities')
        .update({ is_active: true })
        .eq('id', activityId);

      if (activateError) {
        console.error('Error activating activity:', activateError);
        throw activateError;
      }

      console.log('Step 3: Updating room current activity to:', activityId);
      
      // Update the room's current activity
      const { error: roomError } = await supabase
        .from('rooms')
        .update({
          current_activity_id: activityId,
          current_activity_type: activity.type
        })
        .eq('id', roomId);

      if (roomError) {
        console.error('Error updating room:', roomError);
        throw roomError;
      }
      
      console.log('✅ Activity started successfully:', activityId);
    } catch (error) {
      console.error('❌ Error in startActivity:', error);
      throw error;
    }
  },

  async endActivity(activityId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot end activity');
    }
    
    try {
      console.log('Ending activity:', activityId);
      
      // Get the activity's room
      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .select('room_id, is_active')
        .eq('id', activityId)
        .single();

      if (activityError) {
        console.error('Error fetching activity:', activityError);
        throw activityError;
      }

      if (!activity.is_active) {
        console.log('Activity is already inactive:', activityId);
        return; // Already inactive
      }

      console.log('Step 1: Deactivating activity:', activityId);
      
      // Deactivate the activity
      const { error: deactivateError } = await supabase
        .from('activities')
        .update({ is_active: false })
        .eq('id', activityId);

      if (deactivateError) {
        console.error('Error deactivating activity:', deactivateError);
        throw deactivateError;
      }

      console.log('Step 2: Clearing room current activity');
      
      // Clear the room's current activity
      const { error: roomError } = await supabase
        .from('rooms')
        .update({
          current_activity_id: null,
          current_activity_type: null
        })
        .eq('id', activity.room_id);

      if (roomError) {
        console.error('Error updating room:', roomError);
        throw roomError;
      }
      
      console.log('✅ Activity ended successfully:', activityId);
    } catch (error) {
      console.error('❌ Error in endActivity:', error);
      throw error;
    }
  },

  async submitResponse(
    roomId: string,
    activityId: string,
    optionId: string,
    participantId: string,
    responseTime?: number
  ): Promise<ParticipantResponse> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot submit response');
    }
    
    try {
      // Check if participant already responded to this activity
      const { data: existingResponse, error: checkError } = await supabase
        .from('participant_responses')
        .select('id')
        .eq('room_id', roomId)
        .eq('activity_id', activityId)
        .eq('participant_id', participantId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing response:', checkError);
        throw checkError;
      }

      if (existingResponse) {
        throw new Error('Participant has already responded to this activity');
      }

      // Submit the response
      const { data: response, error: responseError } = await supabase
        .from('participant_responses')
        .insert({
          room_id: roomId,
          activity_id: activityId,
          option_id: optionId,
          participant_id: participantId,
          response_time: responseTime
        })
        .select()
        .single();

      if (responseError) {
        console.error('Error submitting response:', responseError);
        throw responseError;
      }

      return response;
    } catch (error) {
      console.error('Error in submitResponse:', error);
      throw error;
    }
  },

  async getActivityById(id: string): Promise<Activity | null> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot fetch activity');
    }
    
    try {
      const { data: activity, error } = await supabase
        .from('activities')
        .select(`
          *,
          activity_options!activity_options_activity_id_fkey (*),
          rooms!activities_room_id_fkey (*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Activity not found
        }
        console.error('Error fetching activity by id:', error);
        throw error;
      }

      if (!activity) return null;

      return {
        ...activity,
        options: activity.activity_options?.sort((a, b) => a.option_order - b.option_order) || [],
        room: activity.rooms
      };
    } catch (error) {
      console.error('Error in getActivityById:', error);
      throw error;
    }
  }
};