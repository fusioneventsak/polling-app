/*
  # Fix reset room vote counts function

  1. Database Functions
    - Drop and recreate `reset_room_vote_counts` function with proper column qualification
    - Fix ambiguous column reference for `room_id`
  
  2. Security
    - Maintain existing function permissions
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS reset_room_vote_counts(uuid);

-- Create the corrected function with proper column qualification
CREATE OR REPLACE FUNCTION reset_room_vote_counts(target_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete all participant responses for the specified room
  DELETE FROM participant_responses 
  WHERE participant_responses.room_id = target_room_id;
  
  -- Reset all activity option response counts to 0 for activities in this room
  UPDATE activity_options 
  SET responses = 0 
  WHERE activity_id IN (
    SELECT activities.id 
    FROM activities 
    WHERE activities.room_id = target_room_id
  );
  
  -- Reset all activity total response counts and deactivate activities for this room
  UPDATE activities 
  SET total_responses = 0, is_active = false 
  WHERE activities.room_id = target_room_id;
  
  -- Reset room state
  UPDATE rooms 
  SET participants = 0, 
      current_activity_id = NULL, 
      current_activity_type = NULL 
  WHERE rooms.id = target_room_id;
END;
$$;