-- =====================================================
-- COMPREHENSIVE ACCESS DEBUG
-- =====================================================
-- This will show us exactly what's in the database
-- and what might be causing access issues
-- =====================================================

-- 1. Check if user exists and get all details
SELECT 
    'USER DETAILS' as debug_type,
    u.id as user_id,
    u.email,
    u.created_at as user_created,
    u.last_sign_in_at,
    u.email_confirmed_at,
    CASE 
        WHEN u.email = 'mohammedjunain@gmail.com' THEN '✅ CORRECT USER'
        ELSE '❌ WRONG USER'
    END as user_status
FROM auth.users u
WHERE u.email = 'mohammedjunain@gmail.com';

-- 2. Check all masjids
SELECT 
    'ALL MASJIDS' as debug_type,
    m.id as masjid_id,
    m.masjid_name,
    m.subscription_status,
    m.subscription_end_date,
    m.is_active,
    m.created_at as masjid_created,
    m.created_by
FROM masjids m
ORDER BY m.created_at DESC;

-- 3. Check all user_roles for this user
SELECT 
    'USER ROLES FOR MOHAMMEDJUNAIN' as debug_type,
    ur.user_id,
    ur.masjid_id,
    ur.email as role_email,
    ur.role,
    ur.status as role_status,
    ur.permissions,
    ur.created_at as role_created,
    m.masjid_name,
    CASE 
        WHEN ur.role = 'super_admin' THEN '✅ SUPER ADMIN'
        WHEN ur.role = 'admin' THEN '✅ ADMIN'
        WHEN ur.role = 'staff' THEN '✅ STAFF'
        ELSE '❌ UNKNOWN ROLE'
    END as role_check
FROM user_roles ur
LEFT JOIN masjids m ON ur.masjid_id = m.id
WHERE ur.email = 'mohammedjunain@gmail.com';

-- 4. Check what roles exist in system
SELECT 
    'ALL ROLES IN SYSTEM' as debug_type,
    user_id,
    email,
    role,
    status,
    permissions,
    COUNT(*) as role_count
FROM user_roles 
GROUP BY user_id, email, role, status, permissions
ORDER BY role_count DESC;

-- 5. Check table structure of user_roles
SELECT 
    'USER_ROLES STRUCTURE' as debug_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_roles'
ORDER BY ordinal_position;

-- 6. Check if there are any constraints or policies
SELECT 
    'USER_ROLES POLICIES' as debug_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'user_roles';

-- 7. Check for any recent errors or issues
SELECT 
    'RECENT ACTIVITY' as debug_type,
    NOW() as current_time,
    'Checking for any database issues' as status;
