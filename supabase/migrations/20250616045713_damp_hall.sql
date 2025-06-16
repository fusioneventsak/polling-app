/*
  # Storage and Media Support

  1. Database Changes
    - Add media_url columns to activities and activity_options tables
    - Update existing tables to support image storage
    - Add indexes for better performance

  2. Security
    - Storage bucket creation will be handled in application code
    - RLS policies will be managed through Supabase dashboard/API
*/

-- Add media_url column to activities table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'media_url'
  ) THEN
    ALTER TABLE activities ADD COLUMN media_url text;
  END IF;
END $$;

-- Add media_url column to activity_options table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_options' AND column_name = 'media_url'
  ) THEN
    ALTER TABLE activity_options ADD COLUMN media_url text;
  END IF;
END $$;

-- Add settings column to rooms table if it doesn't exist (for branding and theme settings)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'settings'
  ) THEN
    ALTER TABLE rooms ADD COLUMN settings jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activities_media_url ON activities(media_url) WHERE media_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_options_media_url ON activity_options(media_url) WHERE media_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_settings ON rooms USING gin(settings);

-- Update the update_updated_at_column function to handle the new columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';