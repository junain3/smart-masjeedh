-- URGENT FIX - Run This Immediately
-- This will fix the infinite recursion issue

-- Step 1: Drop all user_roles policies immediately
DROP POLICY IF EXISTS "Users can view their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can insert their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can update their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can delete their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view user_roles of their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can insert user_roles in their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can update user_roles in their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can delete user_roles in their masjid" ON user_roles;

-- Step 2: Disable RLS for user_roles table
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Step 3: Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'user_roles';

-- Step 4: Test if user_roles query works now
SELECT 'Testing user_roles access without RLS:' as test;
SELECT COUNT(*) as total_user_roles FROM user_roles;

-- Step 5: Check your user data
-- Replace with your actual user ID from the error
SELECT * FROM user_roles 
WHERE auth_user_id = 'a0d80f9e-11ba-436b-9825-1aca3830a7fc' 
LIMIT 5;

-- If above doesn't work, try with user_id column
SELECT * FROM user_roles 
WHERE user_id = 'a0d80f9e-11ba-436b-9825-1aca3830a7fc' 
LIMIT 5;

-- Step 6: Check what columns actually exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND table_schema = 'public'
ORDER BY ordinal_position;
