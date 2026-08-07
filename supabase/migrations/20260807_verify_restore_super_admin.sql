-- This script helps verify and restore super admin permissions
-- Run this in the Supabase SQL Editor to check and fix super admin access issues

-- Step 1: Check current user_roles table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
ORDER BY ordinal_position;

-- Step 2: View all users and their roles/permissions
SELECT 
  id,
  user_id,
  auth_user_id,
  email,
  role,
  permissions,
  full_name,
  onboarding_completed,
  masjid_id,
  created_at
FROM user_roles
ORDER BY created_at DESC;

-- Step 3: Check specifically for super_admin users
SELECT 
  id,
  user_id,
  auth_user_id,
  email,
  role,
  permissions,
  full_name,
  onboarding_completed,
  masjid_id
FROM user_roles
WHERE role = 'super_admin';

-- Step 4: If super admin permissions are missing or incomplete, restore them
-- Uncomment and run the following if needed (replace YOUR_USER_ID with actual user_id)

-- UPDATE user_roles
-- SET permissions = '{
--   "all": true,
--   "families": true,
--   "staff_management": true,
--   "subscriptions_collect": true,
--   "subscriptions_approve": true,
--   "accounts": true,
--   "reports": true,
--   "settings": true,
--   "events": true
-- }'::jsonb,
-- onboarding_completed = true
-- WHERE user_id = 'YOUR_USER_ID' OR auth_user_id = 'YOUR_USER_ID';

-- Step 5: Alternative: Restore permissions for all super_admin users
-- Uncomment and run if you want to fix all super admins at once

-- UPDATE user_roles
-- SET permissions = '{
--   "all": true,
--   "families": true,
--   "staff_management": true,
--   "subscriptions_collect": true,
--   "subscriptions_approve": true,
--   "accounts": true,
--   "reports": true,
--   "settings": true,
--   "events": true
-- }'::jsonb,
-- onboarding_completed = true
-- WHERE role = 'super_admin';

-- Step 6: Verify the fix
SELECT 
  id,
  user_id,
  auth_user_id,
  email,
  role,
  permissions,
  full_name,
  onboarding_completed,
  masjid_id
FROM user_roles
WHERE role = 'super_admin';
