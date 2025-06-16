/*
  # Remove duplicate options and add constraints

  1. Data Cleanup
    - Remove duplicate activity options based on activity_id, text, and option_order
    - Keep only the most recent option for each unique combination
  
  2. Database Constraints
    - Add unique constraint to prevent future duplicates
    - Ensure data integrity for option ordering
  
  3. Performance
    - Add indexes for better query performance
    - Optimize duplicate detection queries
*/

-- First, let's identify and remove duplicate options
-- Keep only the most recent option for each unique combination of activity_id, text, and option_order
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY activity_id, text, option_order 
      ORDER BY created_at DESC
    ) as rn
  FROM activity_options
),
options_to_delete AS (
  SELECT id FROM duplicates WHERE rn > 1
)
DELETE FROM activity_options 
WHERE id IN (SELECT id FROM options_to_delete);

-- Remove duplicates based on activity_id and option_order (in case text is different but order is same)
WITH order_duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY activity_id, option_order 
      ORDER BY created_at DESC
    ) as rn
  FROM activity_options
),
order_options_to_delete AS (
  SELECT id FROM order_duplicates WHERE rn > 1
)
DELETE FROM activity_options 
WHERE id IN (SELECT id FROM order_options_to_delete);

-- Add unique constraint to prevent future duplicates
-- This ensures each activity can only have one option per order position
ALTER TABLE activity_options 
ADD CONSTRAINT unique_activity_option_order 
UNIQUE (activity_id, option_order);

-- Add constraint to ensure option_order is always positive
ALTER TABLE activity_options 
ADD CONSTRAINT check_option_order_positive 
CHECK (option_order >= 0);

-- Create index for better performance on duplicate checks
CREATE INDEX IF NOT EXISTS idx_activity_options_unique_check 
ON activity_options (activity_id, option_order);

-- Update any activities that might have incorrect option counts
UPDATE activities 
SET total_responses = (
  SELECT COALESCE(SUM(responses), 0) 
  FROM activity_options 
  WHERE activity_id = activities.id
)
WHERE id IN (
  SELECT DISTINCT activity_id 
  FROM activity_options
);

-- Clean up any orphaned participant responses that reference deleted options
DELETE FROM participant_responses 
WHERE option_id NOT IN (SELECT id FROM activity_options);