-- CHECK AUTHENTICATION CONTEXT
-- Verify user authentication status

-- Step 1: Check current auth context
SELECT 
    auth.uid() as raw_uid,
    auth.uid()::TEXT as uid_text,
    auth.role() as user_role,
    auth.email() as user_email;

-- Step 2: Check if user is actually authenticated
SELECT 
    CASE 
        WHEN auth.uid()::TEXT = 'postgres' THEN 'Not Authenticated - Using Postgres User'
        WHEN auth.uid()::TEXT LIKE '%-%-%-%-%' THEN 'Authenticated - Valid UUID'
        ELSE 'Unknown Status'
    END as auth_status;

-- Step 3: Check user_roles table for actual data
SELECT 
    COUNT(*) as total_user_roles,
    COUNT(CASE WHEN auth_user_id IS NOT NULL THEN 1 END) as non_null_auth_user_ids,
    COUNT(CASE WHEN auth_user_id::TEXT LIKE '%-%-%-%-%' THEN 1 END) as valid_uuid_auth_user_ids
FROM user_roles;

-- Step 4: Show sample user_roles data
SELECT 
    id,
    auth_user_id,
    auth_user_id::TEXT as auth_user_id_text,
    email,
    role,
    created_at
FROM user_roles 
LIMIT 3;

-- Step 5: Check masjids table
SELECT 
    COUNT(*) as total_masjids,
    COUNT(CASE WHEN created_by IS NOT NULL THEN 1 END) as non_null_created_by,
    COUNT(CASE WHEN created_by::TEXT LIKE '%-%-%-%-%' THEN 1 END) as valid_uuid_created_by
FROM masjids;
