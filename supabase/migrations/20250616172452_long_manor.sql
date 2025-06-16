/*
  # Atomic Voting Functions Migration

  This migration creates database functions for atomic vote counting operations
  to ensure data consistency and prevent race conditions in the voting system.

  ## Functions Created
  1. `increment_option_responses` - Atomically increment option response count
  2. `increment_activity_responses` - Atomically increment activity total responses
  3. `recalculate_option_responses` - Recalculate option response counts from actual data
  4. `recalculate_activity_responses` - Recalculate activity total responses from actual data

  ## Security
  - All functions use proper parameter validation
  - Functions are designed to be safe for concurrent execution
  - Error handling included for edge cases
*/

-- Function to atomically increment option responses
CREATE OR REPLACE FUNCTION increment_option_responses(option_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE activity_options 
  SET responses = responses + 1 
  WHERE id = option_id;
  
  -- Verify the update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Option with id % not found', option_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to atomically increment activity responses  
CREATE OR REPLACE FUNCTION increment_activity_responses(activity_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE activities 
  SET total_responses = total_responses + 1 
  WHERE id = activity_id;
  
  -- Verify the update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity with id % not found', activity_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to recalculate option response counts (for data consistency)
CREATE OR REPLACE FUNCTION recalculate_option_responses(activity_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE activity_options 
  SET responses = (
    SELECT COUNT(*) 
    FROM participant_responses 
    WHERE participant_responses.option_id = activity_options.id
  )
  WHERE activity_options.activity_id = recalculate_option_responses.activity_id;
  
  -- Log the recalculation
  RAISE NOTICE 'Recalculated option responses for activity %', activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to recalculate activity total responses
CREATE OR REPLACE FUNCTION recalculate_activity_responses(activity_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE activities 
  SET total_responses = (
    SELECT COUNT(*) 
    FROM participant_responses 
    WHERE participant_responses.activity_id = recalculate_activity_responses.activity_id
  )
  WHERE id = activity_id;
  
  -- Verify the update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity with id % not found', activity_id;
  END IF;
  
  -- Log the recalculation
  RAISE NOTICE 'Recalculated total responses for activity %', activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset all vote counts for a room (used in room reset)
CREATE OR REPLACE FUNCTION reset_room_vote_counts(room_id uuid)
RETURNS void AS $$
BEGIN
  -- Reset all activity option response counts for this room
  UPDATE activity_options 
  SET responses = 0 
  WHERE activity_id IN (
    SELECT id FROM activities WHERE room_id = reset_room_vote_counts.room_id
  );
  
  -- Reset all activity total response counts for this room
  UPDATE activities 
  SET total_responses = 0, is_active = false
  WHERE room_id = reset_room_vote_counts.room_id;
  
  -- Reset room state
  UPDATE rooms 
  SET participants = 0, current_activity_id = NULL, current_activity_type = NULL
  WHERE id = room_id;
  
  -- Log the reset
  RAISE NOTICE 'Reset all vote counts for room %', room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate vote count consistency
CREATE OR REPLACE FUNCTION validate_vote_counts(activity_id uuid)
RETURNS TABLE(
  option_id uuid,
  option_text text,
  recorded_count integer,
  actual_count bigint,
  is_consistent boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ao.id as option_id,
    ao.text as option_text,
    ao.responses as recorded_count,
    COUNT(pr.id) as actual_count,
    (ao.responses = COUNT(pr.id)) as is_consistent
  FROM activity_options ao
  LEFT JOIN participant_responses pr ON pr.option_id = ao.id
  WHERE ao.activity_id = validate_vote_counts.activity_id
  GROUP BY ao.id, ao.text, ao.responses
  ORDER BY ao.option_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_option_responses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_activity_responses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_option_responses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_activity_responses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_room_vote_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_vote_counts(uuid) TO authenticated;

-- Grant execute permissions to anonymous users (for public voting)
GRANT EXECUTE ON FUNCTION increment_option_responses(uuid) TO anon;
GRANT EXECUTE ON FUNCTION increment_activity_responses(uuid) TO anon;