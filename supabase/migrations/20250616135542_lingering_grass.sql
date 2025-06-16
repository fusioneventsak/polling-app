/*
  # Add missing DELETE policies

  1. Security Issue Fix
    - Add DELETE policies for activities table
    - Add DELETE policies for activity_options table
    - Add DELETE policies for participant_responses table
    - Add DELETE policies for rooms table
  
  2. Missing Policies
    - The original migration only created SELECT, INSERT, and UPDATE policies
    - DELETE operations were blocked by RLS without explicit DELETE policies
    - This was causing activities to not actually be deleted from the database
*/

-- Add DELETE policy for rooms table
CREATE POLICY "Anyone can delete rooms"
  ON rooms FOR DELETE TO public USING (true);

-- Add DELETE policy for activities table
CREATE POLICY "Anyone can delete activities"
  ON activities FOR DELETE TO public USING (true);

-- Add DELETE policy for activity_options table  
CREATE POLICY "Anyone can delete activity options"
  ON activity_options FOR DELETE TO public USING (true);

-- Add DELETE policy for participant_responses table
CREATE POLICY "Anyone can delete participant responses"
  ON participant_responses FOR DELETE TO public USING (true);