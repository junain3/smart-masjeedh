-- Check for deleted user_roles entries that might be blocking new signups
-- This helps identify tester accounts that were previously soft-deleted

-- Check all deleted user_roles
SELECT 
    id,
    email,
    masjid_id,
    role,
    status,
    deleted_at,
    deleted_by,
    deleted_reason,
    created_at
FROM public.user_roles
WHERE status = 'deleted'
ORDER BY deleted_at DESC;

-- Check if there are multiple entries for the same email
SELECT 
    email,
    COUNT(*) as entry_count,
    STRING_AGG(status, ', ') as statuses
FROM public.user_roles
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY entry_count DESC;

-- Check auth users that might not have corresponding user_roles
SELECT 
    au.id,
    au.email,
    au.created_at,
    au.last_sign_in_at,
    COALESCE(ur.status, 'NO_ROLE') as user_role_status
FROM auth.users au
LEFT JOIN public.user_roles ur ON ur.user_id = au.id OR ur.auth_user_id = au.id
WHERE au.email IS NOT NULL
ORDER BY au.created_at DESC;
