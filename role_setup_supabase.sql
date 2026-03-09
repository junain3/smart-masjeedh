-- ROLE-BASED ACCESS CONTROL SETUP - Supabase SQL Editor Ready
-- Copy this entire content and paste in Supabase SQL Editor

-- Step 1: Update existing user_roles with proper permissions (no commission_percent)
UPDATE user_roles SET 
  permissions = CASE 
    WHEN role = 'super_admin' THEN '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true, "staff_management": true, "reports": true, "settings": true}'::jsonb
    WHEN role = 'co_admin' THEN '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true, "reports": true}'::jsonb
    WHEN role = 'staff' THEN '{"subscriptions_collect": true}'::jsonb
    ELSE '{}'::jsonb
  END
WHERE permissions IS NULL OR permissions = '{}';

-- Step 2: Create staff commission settings table
CREATE TABLE IF NOT EXISTS staff_commission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID REFERENCES masjids(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  commission_percent DECIMAL(5,2) DEFAULT 10.0,
  max_monthly_commission DECIMAL(10,2) DEFAULT 50000.00,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(masjid_id, user_id)
);

-- Step 3: Insert commission settings for existing staff
INSERT INTO staff_commission_settings (masjid_id, user_id, commission_percent)
SELECT 
  ur.masjid_id,
  ur.user_id,
  10.0  -- Default commission for all staff
FROM user_roles ur
WHERE ur.role = 'staff'
AND NOT EXISTS (
  SELECT 1 FROM staff_commission_settings scs 
  WHERE scs.masjid_id = ur.masjid_id AND scs.user_id = ur.user_id
);

-- Step 4: Create permissions helper function
CREATE OR REPLACE FUNCTION get_user_permissions(p_masjid_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  user_permissions JSONB;
BEGIN
  SELECT permissions INTO user_permissions
  FROM user_roles 
  WHERE masjid_id = p_masjid_id 
  AND user_id = p_user_id;
  
  RETURN COALESCE(user_permissions, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create commission percentage function
CREATE OR REPLACE FUNCTION get_staff_commission(p_masjid_id UUID, p_user_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  commission_rate DECIMAL(5,2);
BEGIN
  SELECT commission_percent INTO commission_rate
  FROM staff_commission_settings 
  WHERE masjid_id = p_masjid_id 
  AND user_id = p_user_id 
  AND active = true;
  
  RETURN COALESCE(commission_rate, 10.0);
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create role check function
CREATE OR REPLACE FUNCTION has_permission(p_masjid_id UUID, p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_perms JSONB;
BEGIN
  user_perms := get_user_permissions(p_masjid_id, p_user_id);
  RETURN (user_perms ->> p_permission)::boolean = true;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Verify setup
SELECT 
  ur.role,
  ur.email,
  ur.permissions,
  scs.commission_percent,
  scs.max_monthly_commission
FROM user_roles ur
LEFT JOIN staff_commission_settings scs ON scs.masjid_id = ur.masjid_id AND scs.user_id = ur.user_id
ORDER BY ur.role, ur.email;

-- Step 8: Sample permission checks
SELECT 
  email,
  role,
  has_permission(masjid_id, user_id, 'accounts') as can_access_accounts,
  has_permission(masjid_id, user_id, 'events') as can_access_events,
  has_permission(masjid_id, user_id, 'members') as can_access_members,
  has_permission(masjid_id, user_id, 'subscriptions_collect') as can_collect_subscriptions,
  has_permission(masjid_id, user_id, 'subscriptions_approve') as can_approve_subscriptions,
  has_permission(masjid_id, user_id, 'staff_management') as can_manage_staff,
  get_staff_commission(masjid_id, user_id) as commission_rate
FROM user_roles
WHERE masjid_id = (SELECT id FROM masjids LIMIT 1)
ORDER BY role;
