/*
  # Fix storage bucket creation and RLS policies

  1. Storage Setup
    - Create a single shared bucket for all room uploads
    - Set up proper RLS policies for file access
    - Enable public access for uploaded files

  2. Security
    - Allow public read access to uploaded files
    - Allow authenticated and anonymous users to upload files
    - Organize files by room code within the bucket
*/

-- Create a single shared bucket for all room uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'room-uploads',
  'room-uploads', 
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Anyone can view room images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to room buckets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update room images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete room images" ON storage.objects;

-- Create new RLS policies for the shared bucket
CREATE POLICY "Public can view room uploads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'room-uploads');

CREATE POLICY "Public can upload room files"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'room-uploads');

CREATE POLICY "Public can update room files"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'room-uploads');

CREATE POLICY "Public can delete room files"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'room-uploads');

-- Remove the old bucket creation function and trigger since we're using a shared bucket
DROP TRIGGER IF EXISTS create_room_bucket_on_insert ON rooms;
DROP FUNCTION IF EXISTS create_room_bucket_trigger();
DROP FUNCTION IF EXISTS create_room_storage_bucket(text);