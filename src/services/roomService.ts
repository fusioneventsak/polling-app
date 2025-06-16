import { supabase } from '../lib/supabase';
import type { Room, Activity, CreateRoomData, CreateActivityData } from '../types';

export const roomService = {
  async getAllRooms(): Promise<Room[]> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot get rooms');
    }
    
    try {
      const { data: rooms, error } = await supabase
        .from('rooms')
        .select(`
          *,
          activities!activities_room_id_fkey (
            *,
            activity_options (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching rooms:', error);
        throw error;
      }

      return rooms?.map(room => ({
        ...room,
        activities: room.activities?.map((activity: any) => ({
          ...activity,
          options: activity.activity_options?.sort((a: any, b: any) => a.option_order - b.option_order) || []
        })).sort((a: Activity, b: Activity) => a.activity_order - b.activity_order) || []
      })) || [];
    } catch (error) {
      console.error('Error in getAllRooms:', error);
      throw error;
    }
  },

  async getRoomByCode(code: string): Promise<Room | null> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot get room');
    }
    
    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .select(`
          *,
          activities!activities_room_id_fkey (
            *,
            activity_options (*)
          )
        `)
        .eq('code', code)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Room not found
        }
        console.error('Error fetching room:', error);
        throw error;
      }

      return {
        ...room,
        activities: room.activities?.map((activity: any) => ({
          ...activity,
          options: activity.activity_options?.sort((a: any, b: any) => a.option_order - b.option_order) || []
        })).sort((a: Activity, b: Activity) => a.activity_order - b.activity_order) || []
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
      const { data: room, error } = await supabase
        .from('rooms')
        .insert([roomData])
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
        .select()
        .single();

      if (error) {
        console.error('Error updating room:', error);
        throw error;
      }

      // Fetch the complete room with activities
      const completeRoom = await this.getRoomByCode(room.code);
      return completeRoom!;
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
          activity_options!activity_options_activity_id_fkey (*)
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
      // If options are being updated, handle them with a proper transaction approach
      if (updates.options) {
        // First, create a backup of current options in case we need to rollback
        const { data: currentOptions } = await supabase
          .from('activity_options')
          .select('*')
          .eq('activity_id', id)
          .order('option_order');

        try {
          // Use a more aggressive approach: delete and wait longer for commit
          const { error: deleteError } = await supabase
            .from('activity_options')
            .delete()
            .eq('activity_id', id);
          
          if (deleteError) {
            console.error('Error deleting existing options:', deleteError);
            throw deleteError;
          }
          
          // Wait longer for the delete to be fully committed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Verify the delete was successful before proceeding
          const { data: remainingOptions, error: checkError } = await supabase
            .from('activity_options')
            .select('id')
            .eq('activity_id', id);
            
          if (checkError) {
            throw checkError;
          }
          
          if (remainingOptions && remainingOptions.length > 0) {
            console.warn('Options still exist after delete, waiting longer...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Create new options with explicit ordering and better error handling
          if (updates.options.length > 0) {
            for (let index = 0; index < updates.options.length; index++) {
              const option = updates.options[index];
              
              // Add retry logic for each insert
              let retryCount = 0;
              const maxRetries = 3;
              
              while (retryCount < maxRetries) {
                try {
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
                    if (error.code === '23505' && retryCount < maxRetries - 1) {
                      // Constraint violation, wait and retry
                      console.warn(`Constraint violation on option ${index}, retrying... (${retryCount + 1}/${maxRetries})`);
                      await new Promise(resolve => setTimeout(resolve, 200 * (retryCount + 1)));
                      retryCount++;
                      continue;
                    }
                    throw error;
                  }
                  
                  // Success, break retry loop
                  break;
                  
                } catch (insertError) {
                  if (retryCount === maxRetries - 1) {
                    console.error('Max retries reached for option insert:', insertError);
                    throw insertError;
                  }
                  retryCount++;
                  await new Promise(resolve => setTimeout(resolve, 200 * retryCount));
                }
              }
            }
          }
          
        } catch (optionError) {
          console.error('Error handling options, attempting to restore backup:', optionError);
          
          // Attempt to restore the backup if we have it
          if (currentOptions && currentOptions.length > 0) {
            try {
              // Clear any partial inserts first
              await supabase
                .from('activity_options')
                .delete()
                .eq('activity_id', id);
                
              // Restore original options
              const restorePromises = currentOptions.map(option => 
                supabase
                  .from('activity_options')
                  .insert({
                    id: option.id,
                    activity_id: option.activity_id,
                    text: option.text,
                    media_url: option.media_url,
                    is_correct: option.is_correct,
                    responses: option.responses,
                    option_order: option.option_order,
                    created_at: option.created_at
                  })
              );
              
              await Promise.all(restorePromises);
              console.log('Successfully restored backup options');
            } catch (restoreError) {
              console.error('Failed to restore backup options:', restoreError);
            }
          }
          
          throw optionError;
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
      
      // First, verify the activity exists
      const { data: activityCheck, error: checkError } = await supabase
        .from('activities')
        .select('id, room_id, is_active, title')
        .eq('id', activityId)
        .single();
      
      if (checkError) {
        if (checkError.code === 'PGRST116') {
          console.log('Activity not found, may already be deleted:', activityId);
          return; // Activity doesn't exist, consider it successfully deleted
        }
        console.error('Error checking activity existence:', checkError);
        throw checkError;
      }
      
      console.log('Found activity to delete:', activityCheck.title);
      
      // If the activity is currently active, clear it from the room
      if (activityCheck.is_active) {
        console.log('Activity is active, clearing from room first');
        const { error: roomUpdateError } = await supabase
          .from('rooms')
          .update({
            current_activity_id: null,
            current_activity_type: null
          })
          .eq('id', activityCheck.room_id);
          
        if (roomUpdateError) {
          console.error('Error clearing active activity from room:', roomUpdateError);
          // Don't throw here, continue with deletion
        }
      }
      
      // Delete the activity - foreign key constraints will handle cascading deletes
      console.log('Attempting to delete activity from database...');
      const { error, data } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId)
        .select(); // Request data to see what was deleted

      if (error) {
        console.error('Error deleting activity:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw new Error(`Failed to delete activity: ${error.message} (Code: ${error.code})`);
      }
      
      console.log('Delete operation result:', data);
      
      // Verify the deletion worked
      const { data: verifyData, error: verifyError } = await supabase
        .from('activities')
        .select('id')
        .eq('id', activityId)
        .maybeSingle();
        
      if (verifyError && verifyError.code !== 'PGRST116') {
        console.error('Error verifying deletion:', verifyError);
      }
      
      if (verifyData) {
        console.error('Activity still exists after deletion attempt!');
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
        .select('type')
        .eq('id', activityId)
        .single();

      if (activityError) {
        console.error('Error fetching activity:', activityError);
        throw activityError;
      }

      // First, deactivate all other activities in the room
      const { error: deactivateError } = await supabase
        .from('activities')
        .update({ is_active: false })
        .eq('room_id', roomId);

      if (deactivateError) {
        console.error('Error deactivating activities:', deactivateError);
        throw deactivateError;
      }

      // Activate the selected activity
      const { error: activateError } = await supabase
        .from('activities')
        .update({ is_active: true })
        .eq('id', activityId);

      if (activateError) {
        console.error('Error activating activity:', activateError);
        throw activateError;
      }

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
      
      console.log('Activity started successfully:', activityId);
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
      // Get the activity's room
      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .select('room_id')
        .eq('id', activityId)
        .single();

      if (activityError) {
        console.error('Error fetching activity:', activityError);
        throw activityError;
      }

      // Deactivate the activity
      const { error: deactivateError } = await supabase
        .from('activities')
        .update({ is_active: false })
        .eq('id', activityId);

      if (deactivateError) {
        console.error('Error deactivating activity:', deactivateError);
        throw deactivateError;
      }

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
    } catch (error) {
      console.error('Error in endActivity:', error);
      throw error;
    }
  },

  async submitResponse(
    roomId: string,
    activityId: string,
    optionId: string,
    participantId: string,
    responseTime?: number
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot submit response');
    }
    
    try {
      // Check if participant has already responded to this activity
      const { data: existingResponse } = await supabase
        .from('participant_responses')
        .select('id')
        .eq('activity_id', activityId)
        .eq('participant_id', participantId)
        .maybeSingle();

      if (existingResponse) {
        throw new Error('You have already responded to this activity');
      }

      // Insert the response
      const { error: responseError } = await supabase
        .from('participant_responses')
        .insert({
          room_id: roomId,
          activity_id: activityId,
          option_id: optionId,
          participant_id: participantId,
          response_time: responseTime
        });

      if (responseError) {
        console.error('Error submitting response:', responseError);
        throw responseError;
      }

      // Update the option's response count
      const { error: optionError } = await supabase
        .from('activity_options')
        .update({ responses: supabase.sql`responses + 1` })
        .eq('id', optionId);

      if (optionError) {
        console.error('Error updating option count:', optionError);
        throw optionError;
      }

      // Update the activity's total response count
      const { error: activityError } = await supabase
        .from('activities')
        .update({ total_responses: supabase.sql`total_responses + 1` })
        .eq('id', activityId);

      if (activityError) {
        console.error('Error updating activity count:', activityError);
        throw activityError;
      }
    } catch (error) {
      console.error('Error in submitResponse:', error);
      throw error;
    }
  }
};