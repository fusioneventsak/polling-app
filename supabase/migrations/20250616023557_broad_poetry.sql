/*
  # Room-Based Architecture Migration

  1. New Tables
    - `rooms`
      - `id` (uuid, primary key)
      - `code` (text, unique, 4-digit room code)
      - `name` (text, room name/title)
      - `description` (text, optional description)
      - `is_active` (boolean, whether room is accepting participants)
      - `current_activity_id` (uuid, currently active poll/trivia)
      - `current_activity_type` (text, type of current activity)
      - `participants` (integer, number of participants)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `activities`
      - `id` (uuid, primary key)
      - `room_id` (uuid, foreign key to rooms)
      - `type` (text, 'poll', 'trivia', 'quiz', etc.)
      - `title` (text, activity title/question)
      - `description` (text, optional description)
      - `media_url` (text, optional media)
      - `settings` (jsonb, activity-specific settings)
      - `is_active` (boolean, whether activity is currently running)
      - `total_responses` (integer, cached response count)
      - `activity_order` (integer, order in room)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `activity_options`
      - `id` (uuid, primary key)
      - `activity_id` (uuid, foreign key to activities)
      - `text` (text, option text)
      - `media_url` (text, optional media)
      - `is_correct` (boolean, for trivia/quiz questions)
      - `responses` (integer, response count for this option)
      - `option_order` (integer, display order)
      - `created_at` (timestamp)
    
    - `participant_responses`
      - `id` (uuid, primary key)
      - `room_id` (uuid, foreign key to rooms)
      - `activity_id` (uuid, foreign key to activities)
      - `option_id` (uuid, foreign key to activity_options)
      - `participant_id` (text, anonymous participant identifier)
      - `response_time` (integer, milliseconds to respond)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for public read access
    - Add policies for room management
*/

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS participant_responses CASCADE;
DROP TABLE IF EXISTS activity_options CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;

-- Create rooms table
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  current_activity_id uuid,
  current_activity_type text,
  participants integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create activities table
CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'poll',
  title text NOT NULL,
  description text,
  media_url text,
  settings jsonb DEFAULT '{}',
  is_active boolean DEFAULT false,
  total_responses integer DEFAULT 0,
  activity_order integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create activity_options table
CREATE TABLE activity_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES activities(id) ON DELETE CASCADE,
  text text NOT NULL,
  media_url text,
  is_correct boolean DEFAULT false,
  responses integer DEFAULT 0,
  option_order integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create participant_responses table
CREATE TABLE participant_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES activities(id) ON DELETE CASCADE,
  option_id uuid REFERENCES activity_options(id) ON DELETE CASCADE,
  participant_id text NOT NULL,
  response_time integer,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraint for current_activity_id
ALTER TABLE rooms ADD CONSTRAINT rooms_current_activity_fkey 
  FOREIGN KEY (current_activity_id) REFERENCES activities(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_responses ENABLE ROW LEVEL SECURITY;

-- Policies for rooms table
CREATE POLICY "Anyone can read rooms"
  ON rooms FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can create rooms"
  ON rooms FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update rooms"
  ON rooms FOR UPDATE TO public USING (true);

-- Policies for activities table
CREATE POLICY "Anyone can read activities"
  ON activities FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can create activities"
  ON activities FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update activities"
  ON activities FOR UPDATE TO public USING (true);

-- Policies for activity_options table
CREATE POLICY "Anyone can read activity options"
  ON activity_options FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can create activity options"
  ON activity_options FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update activity options"
  ON activity_options FOR UPDATE TO public USING (true);

-- Policies for participant_responses table
CREATE POLICY "Anyone can read participant responses"
  ON participant_responses FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can create participant responses"
  ON participant_responses FOR INSERT TO public WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_rooms_is_active ON rooms(is_active);
CREATE INDEX idx_activities_room_id ON activities(room_id);
CREATE INDEX idx_activities_is_active ON activities(is_active);
CREATE INDEX idx_activities_order ON activities(room_id, activity_order);
CREATE INDEX idx_activity_options_activity_id ON activity_options(activity_id);
CREATE INDEX idx_activity_options_order ON activity_options(activity_id, option_order);
CREATE INDEX idx_participant_responses_room_id ON participant_responses(room_id);
CREATE INDEX idx_participant_responses_activity_id ON participant_responses(activity_id);
CREATE INDEX idx_participant_responses_participant ON participant_responses(participant_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();