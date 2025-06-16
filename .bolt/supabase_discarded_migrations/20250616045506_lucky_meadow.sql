/*
  # Create storage buckets for room assets

  1. Storage Setup
    - Create storage buckets for each room
    - Set up RLS policies for secure access
    - Enable public access for display images

  2. Security
    - Enable RLS on storage buckets
    - Add policies for authenticated and public access
    - Restrict file types and sizes
*/

-- Enable storage extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "storage" SCHEMA "extensions";

-- Create a function to create storage bucket for a room
CREATE OR REPLACE FUNCTION create_room_storage_bucket(room_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create bucket with room code as name
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'room-' || room_code,
    'room-' || room_code,
    true,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Create RLS policies for storage
CREATE POLICY "Anyone can view room images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id LIKE 'room-%');

CREATE POLICY "Anyone can upload to room buckets"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id LIKE 'room-%');

CREATE POLICY "Anyone can update room images"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id LIKE 'room-%');

CREATE POLICY "Anyone can delete room images"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id LIKE 'room-%');

-- Create trigger to automatically create storage bucket when room is created
CREATE OR REPLACE FUNCTION create_room_bucket_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM create_room_storage_bucket(NEW.code);
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_room_bucket_on_insert
  AFTER INSERT ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION create_room_bucket_trigger();