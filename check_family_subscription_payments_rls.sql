-- Check family_subscription_payments table RLS setup

-- Step 1: Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'family_subscription_payments'
AND schemaname = 'public';

-- Step 2: Show existing RLS policies
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
WHERE tablename = 'family_subscription_payments'
AND schemaname = 'public'
ORDER BY policyname;

-- Step 3: Show table structure to understand columns
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'family_subscription_payments'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 4: Check if user_roles table exists for masjid_id mapping
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'user_roles'
AND table_schema = 'public'
AND column_name IN ('auth_user_id', 'masjid_id');
