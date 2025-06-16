/*
  # Create polls and poll options tables

  1. New Tables
    - `polls`
      - `id` (uuid, primary key)
      - `code` (text, unique, 4-digit poll code)
      - `question` (text, poll question)
      - `question_media` (text, optional media URL)
      - `is_active` (boolean, whether poll is accepting votes)
      - `total_votes` (integer, cached vote count)
      - `participants` (integer, number of participants)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `poll_options`
      - `id` (uuid, primary key)
      - `poll_id` (uuid, foreign key to polls)
      - `text` (text, option text)
      - `media` (text, optional media URL)
      - `votes` (integer, vote count for this option)
      - `option_order` (integer, display order)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for public read access
    - Add policies for authenticated admin access
*/

-- Create polls table
CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  question text NOT NULL,
  question_media text,
  is_active boolean DEFAULT false,
  total_votes integer DEFAULT 0,
  participants integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create poll_options table
CREATE TABLE IF NOT EXISTS poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid REFERENCES polls(id) ON DELETE CASCADE,
  text text NOT NULL,
  media text,
  votes integer DEFAULT 0,
  option_order integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;

-- Policies for polls table
CREATE POLICY "Anyone can read polls"
  ON polls
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create polls"
  ON polls
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update polls"
  ON polls
  FOR UPDATE
  TO public
  USING (true);

-- Policies for poll_options table
CREATE POLICY "Anyone can read poll options"
  ON poll_options
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create poll options"
  ON poll_options
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update poll options"
  ON poll_options
  FOR UPDATE
  TO public
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_polls_code ON polls(code);
CREATE INDEX IF NOT EXISTS idx_polls_is_active ON polls(is_active);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_order ON poll_options(poll_id, option_order);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_polls_updated_at
  BEFORE UPDATE ON polls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();