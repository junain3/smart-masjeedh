-- SECURE RLS FINAL - Re-enable with Proper Policies
-- Now that login works, let's secure the system properly

-- Step 1: Check current user_roles data to understand the schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Check existing user_roles data
SELECT * FROM user_roles LIMIT 5;

-- Step 3: Re-enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Step 4: Create simple, non-recursive policies
-- Based on what we see in the schema, create appropriate policies

-- If auth_user_id column exists:
CREATE POLICY "Users can read their own user_roles"
ON user_roles
FOR SELECT
TO authenticated
USING (auth.uid()::TEXT = auth_user_id);

CREATE POLICY "Users can insert their own user_roles"
ON user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::TEXT = auth_user_id);

-- If user_id column exists instead (uncomment if needed):
/*
CREATE POLICY "Users can read their own user_roles"
ON user_roles
FOR SELECT
TO authenticated
USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert their own user_roles"
ON user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::TEXT = user_id);
*/

-- Step 5: Create simple policies for other tables
-- Masjids
CREATE POLICY "Users can read their own masjids"
ON masjids
FOR SELECT
TO authenticated
USING (created_by = auth.uid()::TEXT OR id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

CREATE POLICY "Users can insert their own masjids"
ON masjids
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid()::TEXT);

-- Events
CREATE POLICY "Users can read events of their masjid"
ON events
FOR SELECT
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

CREATE POLICY "Users can insert events in their masjid"
ON events
FOR INSERT
TO authenticated
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

-- Step 6: Test the policies
SELECT 'Testing user_roles access:' as test;
SELECT COUNT(*) as total_user_roles FROM user_roles;

-- Step 7: Verify all policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
