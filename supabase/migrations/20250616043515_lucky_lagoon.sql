/*
  # Add room settings support

  1. Changes
    - Add settings column to rooms table to store theme and branding configuration
    - Settings stored as JSONB for flexible configuration options

  2. Security
    - No changes to existing RLS policies
    - Settings column follows same access patterns as other room data
*/

-- Add settings column to rooms table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'settings'
  ) THEN
    ALTER TABLE rooms ADD COLUMN settings jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;