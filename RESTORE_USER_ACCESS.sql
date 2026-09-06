-- Restore User Access Script
-- This script restores the user_roles entry for the user whose deletion failed

-- Restore user_roles entry with all required columns
INSERT INTO public.user_roles (
  id,
  masjid_id,
  user_id,
  auth_user_id,
  email,
  role,
  permissions,
  verified,
  created_at
) VALUES (
  gen_random_uuid(),  -- Generate new ID
  'c7a73bfd-97c2-4cf4-8356-88313a8a97f4',  -- Masjid ID (from logs)
  'b7da3f9f-9337-411b-b3c9-fc2e8130c62a',  -- User ID (same as auth_user_id)
  'b7da3f9f-9337-411b-b3c9-fc2e8130c62a',  -- Auth User ID (from logs)
  'kasideenmj@gmail.com',  -- Email (from logs)
  'super_admin',  -- Role (was super admin)
  '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true, "staff_management": true, "reports": true, "settings": true}'::jsonb,  -- Full permissions
  true,  -- Verified
  NOW()
);

-- Verify the restoration
SELECT * FROM public.user_roles 
WHERE auth_user_id = 'b7da3f9f-9337-411b-b3c9-fc2e8130c62a';
