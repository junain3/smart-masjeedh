-- DEBUG user_roles TABLE SCHEMA
-- Check actual column names and structure

-- Step 1: Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Check sample data
SELECT * FROM user_roles LIMIT 5;

-- Step 3: Check RLS policies on user_roles
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

-- Step 4: Test query with different column names
-- Test 1: Using auth_user_id
SELECT 'Testing auth_user_id column:' as test;
SELECT masjid_id, role, permissions 
FROM user_roles 
WHERE auth_user_id = 'test-user-id';

-- Test 2: Using user_id
SELECT 'Testing user_id column:' as test;
SELECT masjid_id, role, permissions 
FROM user_roles 
WHERE user_id = 'test-user-id';

-- Test 3: Check what columns actually exist for user identification
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND table_schema = 'public'
AND (column_name LIKE '%user%' OR column_name LIKE '%auth%');
