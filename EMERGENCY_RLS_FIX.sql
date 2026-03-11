-- EMERGENCY RLS FIX - Remove Recursive Policies
-- Fix infinite recursion in user_roles policies

-- Step 1: Drop ALL user_roles policies immediately
DROP POLICY IF EXISTS "Users can view their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can insert their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can update their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can delete their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view user_roles of their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can insert user_roles in their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can update user_roles in their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can delete user_roles in their masjid" ON user_roles;

-- Step 2: Create SIMPLE non-recursive user_roles policies
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

-- Step 3: Check what columns actually exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 4: Test the policies
SELECT 'Testing user_roles policies:' as test;
SELECT COUNT(*) as total_user_roles FROM user_roles;

-- Step 5: If auth_user_id doesn't exist, create policies for user_id instead
-- Run this only if the above shows user_id instead of auth_user_id

-- Alternative policies for user_id column (uncomment if needed)
/*
DROP POLICY IF EXISTS "Users can read their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can insert their own user_roles" ON user_roles;

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

-- Step 6: Verify policies are working
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
AND tablename = 'user_roles';
