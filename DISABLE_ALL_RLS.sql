-- DISABLE ALL RLS POLICIES FOR 5 MINUTES
-- Temporary disable to test if login works

-- Disable RLS on all tables
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE families DISABLE ROW LEVEL SECURITY;
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE masjids DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('events', 'families', 'members', 'user_roles', 'masjids')
ORDER BY tablename;

-- Test user_roles query
SELECT 'Testing user_roles access:' as test;
SELECT COUNT(*) as total_user_roles FROM user_roles;

-- Test your specific user
SELECT * FROM user_roles 
WHERE auth_user_id = 'a0d80f9e-11ba-436b-9825-1aca3830a7fc' 
LIMIT 5;

-- If above doesn't work, try user_id
SELECT * FROM user_roles 
WHERE user_id = 'a0d80f9e-11ba-436b-9825-1aca3830a7fc' 
LIMIT 5;
