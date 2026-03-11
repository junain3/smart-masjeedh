-- FIX EVENTS RLS POLICIES
-- Ensure proper permissions for event operations

-- Step 1: Enable RLS on events table
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies
DROP POLICY IF EXISTS "Users can view events of their masjid" ON events;
DROP POLICY IF EXISTS "Users can insert events in their masjid" ON events;
DROP POLICY IF EXISTS "Users can update events in their masjid" ON events;
DROP POLICY IF EXISTS "Users can delete events in their masjid" ON events;

-- Step 3: Create secure policies
CREATE POLICY "Users can view events of their masjid"
ON events
FOR SELECT
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can insert events in their masjid"
ON events
FOR INSERT
TO authenticated
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can update events in their masjid"
ON events
FOR UPDATE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
))
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete events in their masjid"
ON events
FOR DELETE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

-- Step 4: Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'events';

-- Step 5: Test with current user (run this as authenticated user)
SELECT 
  auth.uid() as current_user_id,
  (SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid() LIMIT 1) as user_masjid_id;
