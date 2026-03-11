-- SECURITY AUDIT - Check RLS Status and Policies
-- Review and fix security issues

-- Step 1: Check RLS status on all tables
SELECT schemaname, tablename, rowsecurity, forcerlspolicy 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('masjids', 'user_roles', 'members', 'families', 'invitations', 'transactions');

-- Step 2: Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('masjids', 'user_roles', 'members', 'families', 'invitations', 'transactions')
ORDER BY tablename, cmd;

-- Step 3: Check for anon/public access
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies 
WHERE tablename IN ('masjids', 'user_roles', 'members', 'families', 'invitations', 'transactions')
AND (roles = 'anon'::name OR roles = 'public'::name OR roles = '{anon,authenticated}'::name[]);

-- Step 4: Check for overly broad policies
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('masjids', 'user_roles', 'members', 'families', 'invitations', 'transactions')
AND (qual IS NULL OR qual = '');

-- Step 5: Verify user_roles table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
ORDER BY ordinal_position;

-- Step 6: Verify masjids table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'masjids' 
ORDER BY ordinal_position;
