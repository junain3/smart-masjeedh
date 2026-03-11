-- DEEP ANALYSIS - EVENTS FOREIGN KEY ISSUE
-- Step by step investigation

-- Step 1: Check current user authentication
SELECT 
    'Current Auth Context' as step,
    auth.uid()::TEXT as current_uid,
    CASE 
        WHEN auth.uid()::TEXT LIKE '%-%-%-%-%' THEN 'Authenticated'
        ELSE 'Not Authenticated'
    END as auth_status;

-- Step 2: Check if user has any user_roles
SELECT 
    'User Roles Check' as step,
    COUNT(*) as total_user_roles,
    COUNT(CASE WHEN auth_user_id IS NOT NULL THEN 1 END) as non_null_auth_user_ids,
    COUNT(CASE WHEN auth_user_id::TEXT LIKE '%-%-%-%-%' THEN 1 END) as valid_uuid_auth_user_ids
FROM user_roles;

-- Step 3: Check if user created any masjids
SELECT 
    'Masjids Created by User' as step,
    COUNT(*) as total_masjids,
    COUNT(CASE WHEN created_by IS NOT NULL THEN 1 END) as non_null_created_by,
    COUNT(CASE WHEN created_by::TEXT LIKE '%-%-%-%-%' THEN 1 END) as valid_uuid_created_by
FROM masjids;

-- Step 4: Show actual user_roles data
SELECT 
    'User Roles Data' as step,
    id,
    auth_user_id::TEXT as auth_user_id_text,
    email,
    role,
    created_at
FROM user_roles 
ORDER BY created_at DESC
LIMIT 3;

-- Step 5: Show actual masjids data
SELECT 
    'Masjids Data' as step,
    id,
    masjid_name,
    created_by::TEXT as created_by_text,
    created_at
FROM masjids 
ORDER BY created_at DESC
LIMIT 3;

-- Step 6: Check events table structure
SELECT 
    'Events Table Structure' as step,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;

-- Step 7: Check events foreign key constraint
SELECT 
    'Events Foreign Key' as step,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'events';

-- Step 8: Check existing events data
SELECT 
    'Events Data' as step,
    COUNT(*) as total_events,
    COUNT(CASE WHEN masjid_id IS NOT NULL THEN 1 END) as non_null_masjid_id,
    COUNT(CASE WHEN created_by IS NOT NULL THEN 1 END) as non_null_created_by
FROM events;

-- Step 9: Show sample events data
SELECT 
    'Sample Events' as step,
    id,
    title,
    masjid_id::TEXT as masjid_id_text,
    created_by::TEXT as created_by_text,
    created_at
FROM events 
ORDER BY created_at DESC
LIMIT 3;
