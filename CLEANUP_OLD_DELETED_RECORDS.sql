-- Cleanup Old Deleted Records (Run Monthly)
-- This script permanently deletes records that have been soft-deleted for more than 3 months
-- Schedule this to run monthly via Supabase SQL Editor or a cron job

-- Permanently delete masjids deleted more than 3 months ago
DELETE FROM public.masjids 
WHERE status = 'deleted' 
AND deleted_at < NOW() - INTERVAL '3 months';

-- Permanently delete user_roles for masjids that no longer exist
DELETE FROM public.user_roles 
WHERE masjid_id NOT IN (SELECT id FROM public.masjids WHERE status = 'active')
AND status = 'deleted'
AND deleted_at < NOW() - INTERVAL '3 months';

-- Optional: Permanently delete auth users for deleted accounts older than 3 months
-- This requires the auth user ID mapping, which should be stored separately
-- Uncomment and customize if you have an auth_users table or similar mapping

-- DELETE FROM auth.users 
-- WHERE id IN (SELECT auth_user_id FROM public.user_roles WHERE deleted_at < NOW() - INTERVAL '3 months');

-- Verify cleanup
SELECT 
  COUNT(*) as masjids_deleted,
  MIN(deleted_at) as oldest_deletion
FROM public.masjids 
WHERE status = 'deleted';
