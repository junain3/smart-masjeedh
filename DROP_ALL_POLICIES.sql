-- DROP ALL POLICIES COMPLETELY
-- This will remove all RLS policies

-- Drop ALL user_roles policies
DROP POLICY IF EXISTS "Users can view their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can insert their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can update their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can delete their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view user_roles of their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can insert user_roles in their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can update user_roles in their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can delete user_roles in their masjid" ON user_roles;

-- Disable RLS completely
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Check what columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test direct query without any RLS
SELECT 'Testing direct query:' as test;
SELECT * FROM user_roles LIMIT 3;

-- Check your specific user with both possible columns
SELECT 'Testing auth_user_id:' as test;
SELECT * FROM user_roles 
WHERE auth_user_id = 'a0d80f9e-11ba-436b-9825-1aca3830a7fc' 
LIMIT 3;

SELECT 'Testing user_id:' as test;
SELECT * FROM user_roles 
WHERE user_id = 'a0d80f9e-11ba-436b-9825-1aca3830a7fc' 
LIMIT 3;
