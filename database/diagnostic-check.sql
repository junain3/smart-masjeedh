-- =====================================================
-- DIAGNOSTIC CHECK - WHAT'S IN THE DATABASE?
-- =====================================================
-- This will show us exactly what exists and what's missing
-- =====================================================

-- Check if user exists in auth.users
SELECT 
    'AUTH USERS CHECK' as check_type,
    email,
    id as user_id,
    created_at,
    CASE 
        WHEN email = 'mohammedjunain@gmail.com' THEN '✅ FOUND'
        ELSE '❌ NOT FOUND'
    END as status
FROM auth.users 
WHERE email = 'mohammedjunain@gmail.com';

-- Check if masjid exists
SELECT 
    'MASJIDS CHECK' as check_type,
    masjid_name,
    id as masjid_id,
    subscription_status,
    subscription_end_date,
    is_active,
    created_at,
    CASE 
        WHEN masjid_name = 'MUBEEN JUMMA MASJEEDH' THEN '✅ FOUND'
        ELSE '❌ NOT FOUND'
    END as status
FROM masjids 
WHERE masjid_name = 'MUBEEN JUMMA MASJEEDH';

-- Check if user_roles exists
SELECT 
    'USER ROLES CHECK' as check_type,
    u.email,
    ur.user_id,
    ur.masjid_id,
    ur.role,
    ur.status,
    ur.created_at,
    CASE 
        WHEN ur.role = 'super_admin' THEN '✅ SUPER ADMIN'
        ELSE '❌ NOT SUPER ADMIN'
    END as status
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'mohammedjunain@gmail.com';

-- Show all masjids (to see what exists)
SELECT 
    'ALL MASJIDS' as check_type,
    masjid_name,
    id as masjid_id,
    subscription_status,
    created_at
FROM masjids
ORDER BY created_at DESC;

-- Show all user_roles for this user
SELECT 
    'ALL USER ROLES FOR USER' as check_type,
    u.email,
    ur.masjid_id,
    m.masjid_name,
    ur.role,
    ur.status,
    ur.created_at
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN masjids m ON ur.masjid_id = m.id
WHERE u.email = 'mohammedjunain@gmail.com';

-- Check table structure of user_roles
SELECT 
    'USER_ROLES TABLE STRUCTURE' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_roles'
ORDER BY ordinal_position;
