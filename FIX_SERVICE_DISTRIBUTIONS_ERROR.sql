-- FIX: Service Distributions Foreign Key Constraint Error
-- This script helps diagnose and fix the "service_distributions_masjid_id_fkey" error

-- Step 1: Check what masjids exist in your database
SELECT id, masjid_name, created_by, created_at 
FROM masjids 
ORDER BY created_at DESC;

-- Step 2: Check what user_roles exist (to see which masjid_id is being used)
SELECT user_id, masjid_id, role 
FROM user_roles;

-- Step 3: Check what families exist and their masjid_id
SELECT id, masjid_id, family_code 
FROM families 
LIMIT 10;

-- Step 4: If you need to create a masjid (replace placeholders with actual values):
-- Uncomment and run this if you don't have a masjid yet
/*
INSERT INTO masjids (id, masjid_name, tagline, created_by, created_at)
VALUES (
  'your-masjid-id-here',  -- Use the same masjid_id from user_roles
  'My Masjid',
  'Welcome to our masjid',
  'your-user-id-here',     -- Use your user ID
  NOW()
);
*/

-- Step 5: If you need to update user_roles to match an existing masjid:
-- Uncomment and run this if needed
/*
UPDATE user_roles 
SET masjid_id = 'existing-masjid-id-from-step-1'
WHERE masjid_id = 'non-existing-masjid-id';
*/

-- Step 6: Verify the fix
-- After running the above, check that everything is consistent:
SELECT 
  ur.masjid_id as user_role_masjid_id,
  m.id as masjid_table_id,
  m.masjid_name
FROM user_roles ur
LEFT JOIN masjids m ON ur.masjid_id = m.id;
