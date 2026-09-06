-- Restore Soft-Deleted Account (Support Only)
-- This script restores a soft-deleted account within the 3-month grace period
-- Usage: Replace :masjid_id with the actual masjid ID to restore

-- Restore masjid status
UPDATE public.masjids 
SET status = 'active', deleted_at = NULL
WHERE id = :masjid_id AND status = 'deleted';

-- Restore user_roles for the masjid
UPDATE public.user_roles 
SET status = 'active', deleted_at = NULL
WHERE masjid_id = :masjid_id AND status = 'deleted';

-- Verify restoration
SELECT 
  m.id as masjid_id,
  m.masjid_name,
  m.status as masjid_status,
  m.deleted_at as masjid_deleted_at,
  COUNT(ur.id) as user_roles_count
FROM public.masjids m
LEFT JOIN public.user_roles ur ON m.id = ur.masjid_id
WHERE m.id = :masjid_id
GROUP BY m.id, m.masjid_name, m.status, m.deleted_at;
