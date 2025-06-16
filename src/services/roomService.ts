import { supabase } from '../lib/supabase';
import type { Room, Activity, CreateRoomData, CreateActivityData } from '../types';

export const roomService = {
  async getAllRooms(): Promise<Room[]> {
    if (!supabase) {
      console.warn('Supabase not available - returning empty rooms array');
      return [];
    }
    
    try {
      const { data: rooms, error } = await supabase
        .from('rooms')
        .select(`
          *,
          activities!activities_room_id_fkey (
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
        activities: room.activities?.sort((a, b) => a.activity_order - b.activity_order).map(activity => ({
          ...activity,
          options: activity.activity_options?.sort((a, b) => a.option_order - b.option_order).filter((option, index, self) => 
            index === self.findIndex(o => o.id === option.id)
          ) || []
        })) || []
      })) || [];
    } catch (error) {
      console.error('Error in getAllRooms:', error);
      throw error;
    }
  },

  async getRoomByCode(code: string): Promise<Room | null> {
    if (!supabase) {
      console.warn('Supabase not available - cannot get room by code');
      return null;
    }
    
    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .select(`
          *,
          activities!activities_room_id_fkey (
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

      return {
        ...room,
        activities: room.activities?.sort((a, b) => a.activity_order - b.activity_order).map(activity => ({
          ...activity,
          options: activity.activity_options?.sort((a, b) => a.option_order - b.option_order).filter((option, index, self) => 
            index === self.findIndex(o => o.id === option.id)
          ) || []
        })) || []
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
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      
      const { data: room, error } = await supabase
        .from('rooms')
        .insert([{
          ...roomData,
          code,
          is_active: true,
          participants: 0
        }])
        .select(`
          *,
          activities!activities_room_id_fkey (
            *,
            activity_options (*)
          )
        `)
        .single();

      if (error) {
        console.error('Error creating room:', error);
        throw error;
      }

      // Note: Storage bucket is now shared (room-uploads) and created via migration
      // Files are organized by room code within the bucket
      
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
          activities!activities_room_id_fkey (
            *,
            activity_options (*)
          )
        `)
        .single();

      if (error) {
        console.error('Error updating room:', error);
        throw error;
      }

      return {
        ...room,
        activities: room.activities?.sort((a, b) => a.activity_order - b.activity_order).map(activity => ({
          ...activity,
          options: activity.activity_options?.sort((a, b) => a.option_order - b.option_order) || []
        })) || []
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
      const { data: lastActivity } = await supabase
        .from('activities')
        .select('activity_order')
        .eq('room_id', activityData.room_id)
        .order('activity_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = (lastActivity?.activity_order || 0) + 1;

      // Create the activity
      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .insert([{
          room_id: activityData.room_id,
          type: activityData.type,
          title: activityData.title,
          description: activityData.description,
          media_url: activityData.media_url,
          settings: activityData.settings || {},
          activity_order: nextOrder,
          is_active: false,
          total_responses: 0
        }])
        .select()
        .single();

      if (activityError) {
        console.error('Error creating activity:', activityError);
        throw activityError;
      }

      // Create activity options
      if (activityData.options && activityData.options.length > 0) {
        const optionPromises = activityData.options.map(async (option, index) => {
          const { error } = await supabase
            .from('activity_options')
            .insert({
              activity_id: activity.id,
              text: option.text,
              media_url: option.media_url,
              is_correct: option.is_correct || false,
              responses: 0,
              option_order: index
            });

          if (error) throw error;
        });

        await Promise.all(optionPromises);
      }

      // Fetch the complete activity with options
      const { data: completeActivity, error: fetchError } = await supabase
        .from('activities')
        .select(`
          *,
          activity_options (*)
        `)
        .eq('id', activity.id)
        .single();

      if (fetchError) {
        console.error('Error fetching complete activity:', fetchError);
        throw fetchError;
      }

      return {
        ...completeActivity,
        options: completeActivity.activity_options?.sort((a, b) => a.option_order - b.option_order) || []
      };
    } catch (error) {
      console.error('Error in createActivity:', error);
      throw error;
    }
  },

  async updateActivity(id: string, updates: Partial<Activity>): Promise<Activity> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot update activity');
    }
    
    try {
      // If options are being updated, handle them separately
      if (updates.options) {
        // First, get existing options to avoid orphaned data
        const { data: existingOptions } = await supabase
          .from('activity_options')
          .select('id')
          .eq('activity_id', id);
        
        // Delete all existing options for this activity
        const { error: deleteError } = await supabase
          .from('activity_options')
          .delete()
          .eq('activity_id', id);
        
        if (deleteError) {
          console.error('Error deleting existing options:', deleteError);
          throw deleteError;
        }
        
        // Create new options
        if (updates.options.length > 0) {
          const optionPromises = updates.options.map(async (option, index) => {
            const { error } = await supabase
              .from('activity_options')
              .insert({
                activity_id: id,
                text: option.text,
                media_url: option.media_url,
                is_correct: option.is_correct || false,
                responses: 0,
                option_order: index
              });
            
            if (error) {
              console.error('Error creating option:', error);
              throw error;
            }
          });
          
          await Promise.all(optionPromises);
        }
        
        // Remove options from updates object since we handled them separately
        const { options, ...activityUpdates } = updates;
        
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
      
      // Delete the activity - foreign key constraints will handle cascading deletes
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId);

      if (error) {
        console.error('Error deleting activity:', error);
        throw new Error(`Failed to delete activity: ${error.message}`);
      }
      
      console.log('Activity deleted successfully:', activityId);
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
      const updatePromises = activityIds.map(async (activityId, index) => {
        const { error } = await supabase
          .from('activities')
          .update({ activity_order: index + 1 })
          .eq('id', activityId)
          .eq('room_id', roomId);

        if (error) throw error;
      });

      await Promise.all(updatePromises);
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
      // End any currently active activities in the room
      await supabase
        .from('activities')
        .update({ is_active: false })
        .eq('room_id', roomId)
        .eq('is_active', true);

      // Start the specified activity
      await supabase
        .from('activities')
        .update({ is_active: true })
        .eq('id', activityId);

      // Update room's current activity
      const { data: activity } = await supabase
        .from('activities')
        .select('type')
        .eq('id', activityId)
        .single();

      await supabase
        .from('rooms')
        .update({
          current_activity_id: activityId,
          current_activity_type: activity?.type
        })
        .eq('id', roomId);
    } catch (error) {
      console.error('Error in startActivity:', error);
      throw error;
    }
  },

  async endActivity(activityId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot end activity');
    }
    
    try {
      const { data: activity } = await supabase
        .from('activities')
        .select('room_id')
        .eq('id', activityId)
        .single();

      await supabase
        .from('activities')
        .update({ is_active: false })
        .eq('id', activityId);

      if (activity) {
        await supabase
          .from('rooms')
          .update({
            current_activity_id: null,
            current_activity_type: null
          })
          .eq('id', activity.room_id);
      }
    } catch (error) {
      console.error('Error in endActivity:', error);
      throw error;
    }
  },

  async submitResponse(roomId: string, activityId: string, optionId: string, participantId: string, responseTime?: number): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot submit response');
    }
    
    try {
      // Check if participant already responded (if multiple responses not allowed)
      const { data: activity } = await supabase
        .from('activities')
        .select('settings')
        .eq('id', activityId)
        .single();

      const allowMultiple = activity?.settings?.allow_multiple_responses || false;

      if (!allowMultiple) {
        const { data: existingResponse } = await supabase
          .from('participant_responses')
          .select('id')
          .eq('activity_id', activityId)
          .eq('participant_id', participantId)
          .single();

        if (existingResponse) {
          throw new Error('Participant has already responded to this activity');
        }
      }

      // Submit the response
      await supabase
        .from('participant_responses')
        .insert({
          room_id: roomId,
          activity_id: activityId,
          option_id: optionId,
          participant_id: participantId,
          response_time: responseTime
        });

      // Update option response count
      const { data: option } = await supabase
        .from('activity_options')
        .select('responses')
        .eq('id', optionId)
        .single();

      if (option) {
        await supabase
          .from('activity_options')
          .update({ responses: option.responses + 1 })
          .eq('id', optionId);
      }

      // Update activity total responses
      const { data: activityData } = await supabase
        .from('activities')
        .select('total_responses')
        .eq('id', activityId)
        .single();

      if (activityData) {
        await supabase
          .from('activities')
          .update({ total_responses: activityData.total_responses + 1 })
          .eq('id', activityId);
      }
    } catch (error) {
      console.error('Error in submitResponse:', error);
      throw error;
    }
  }
};