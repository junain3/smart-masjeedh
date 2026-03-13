-- URGENT RLS DISABLE - Fix user_roles Query
-- This must be run immediately

-- Disable RLS on user_roles table
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'user_roles';

-- Test user_roles query
SELECT 'Testing user_roles access:' as test;
SELECT COUNT(*) as total_user_roles FROM user_roles;

-- Check your specific user
SELECT * FROM user_roles 
WHERE auth_user_id = 'a0d80f9e-11ba-436b-9825-1aca3830a7fc' 
LIMIT 5;

-- If above doesn't work, try user_id
SELECT * FROM user_roles 
WHERE user_id = 'a0d80f9e-11ba-436b-9825-1aca3830a7fc' 
LIMIT 5;

-- Check what columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND table_schema = 'public'
ORDER BY ordinal_position;
