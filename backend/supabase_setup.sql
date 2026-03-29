-- ============================================================
-- CStore Database Setup SQL
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create the 'apps' table (if not exists)
CREATE TABLE IF NOT EXISTS apps (
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

-- 2. Create the 'users' table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create the 'downloads' table (track per-user downloads)
CREATE TABLE IF NOT EXISTS downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create the download increment function
CREATE OR REPLACE FUNCTION increment_download_count(app_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE apps
  SET download_count = download_count + 1
  WHERE id = app_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Storage Buckets (Run in Supabase Dashboard > Storage)
-- Create bucket: 'cstore-apps'  (Public: Yes)
-- Create bucket: 'cstore-icons' (Public: Yes)
