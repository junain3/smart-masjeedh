-- CHECK EVENTS TABLE RLS POLICIES
-- Verify permissions for event operations

-- Step 1: Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'events';

-- Step 2: Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'events';

-- Step 3: Check if user has access to events
-- This should be run by an authenticated user
SELECT 
  COUNT(*) as event_count,
  masjid_id
FROM events 
GROUP BY masjid_id;

-- Step 4: Check events table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;
