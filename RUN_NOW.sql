-- COPY AND RUN THIS IMMEDIATELY IN SUPABASE SQL EDITOR

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
