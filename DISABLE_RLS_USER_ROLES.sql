-- TEMPORARY FIX - Disable RLS for user_roles
-- This will allow login to work while we fix the policies

-- Step 1: Disable RLS for user_roles table
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Step 2: Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'user_roles';

-- Step 3: Test if user_roles query works now
SELECT 'Testing user_roles access without RLS:' as test;
SELECT COUNT(*) as total_user_roles FROM user_roles;

-- Step 4: Check if your user has user_roles
-- Replace 'a0d80f9e-11ba-436b-9825-1aca3830a7fc' with your actual user ID
SELECT 'Checking user roles for logged in user:' as test;
SELECT * FROM user_roles 
WHERE auth_user_id = 'a0d80f9e-11ba-436b-9825-1aca3830a7fc' 
LIMIT 5;

-- If the above doesn't work, try with user_id column
SELECT 'Checking user roles with user_id column:' as test;
SELECT * FROM user_roles 
WHERE user_id = 'a0d80f9e-11ba-436b-9825-1aca3830a7fc' 
LIMIT 5;
