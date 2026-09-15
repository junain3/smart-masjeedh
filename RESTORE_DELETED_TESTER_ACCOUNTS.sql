-- Restore deleted user_roles for testers
-- This script restores soft-deleted user_roles entries to 'active' status

-- Restore all deleted user_roles (uncomment to run)
-- UPDATE public.user_roles
-- SET 
--   status = 'active',
--   deleted_at = NULL,
--   deleted_by = NULL,
--   deleted_reason = NULL
-- WHERE status = 'deleted';

-- Restore specific deleted user_roles by email (replace with actual tester emails)
-- UPDATE public.user_roles
-- SET 
--   status = 'active',
--   deleted_at = NULL,
--   deleted_by = NULL,
--   deleted_reason = NULL
-- WHERE status = 'deleted'
-- AND email IN (
--   'tester1@example.com',
--   'tester2@example.com'
--   -- Add more tester emails here
-- );

-- Restore deleted masjids (uncomment to run)
-- UPDATE public.masjids
-- SET 
--   status = 'active',
--   deleted_at = NULL,
--   deleted_by = NULL,
--   deleted_reason = NULL
-- WHERE status = 'deleted';

-- Check results after restoration
SELECT 
    id,
    email,
    masjid_id,
    role,
    status,
    deleted_at,
    created_at
FROM public.user_roles
ORDER BY created_at DESC;
