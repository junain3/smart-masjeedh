-- FIX FAMILIES RLS POLICIES
-- Ensure proper permissions for family operations

-- Step 1: Enable RLS on families table
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies
DROP POLICY IF EXISTS "Users can view families of their masjid" ON families;
DROP POLICY IF EXISTS "Users can insert families in their masjid" ON families;
DROP POLICY IF EXISTS "Users can update families in their masjid" ON families;
DROP POLICY IF EXISTS "Users can delete families in their masjid" ON families;

-- Step 3: Create secure policies
CREATE POLICY "Users can view families of their masjid"
ON families
FOR SELECT
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can insert families in their masjid"
ON families
FOR INSERT
TO authenticated
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can update families in their masjid"
ON families
FOR UPDATE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
))
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete families in their masjid"
ON families
FOR DELETE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

-- Step 4: Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'families';

-- Step 5: Test with current user (run this as authenticated user)
SELECT 
  auth.uid() as current_user_id,
  (SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid() LIMIT 1) as user_masjid_id;
