-- Run these SQL commands in your NEW Supabase project's SQL Editor

-- 1. Create the 'apps' table
CREATE TABLE apps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  version TEXT,
  description TEXT,
  file_url TEXT NOT NULL,
  icon_url TEXT,
  download_count INTEGER DEFAULT 0,
  size TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create the download increment function
CREATE OR REPLACE FUNCTION increment_download_count(app_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE apps
  SET download_count = download_count + 1
  WHERE id = app_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Storage Buckets (Go to Storage in Supabase Dashboard)
-- Create bucket: 'cstore-apps' (Public: Yes)
-- Create bucket: 'cstore-icons' (Public: Yes)
