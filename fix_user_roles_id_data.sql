-- Check if user_roles table has email strings in the id column instead of UUIDs
-- This script will help identify and fix the root cause of the delete user issue

-- Step 1: Check the actual data in user_roles table
SELECT 
  id, 
  email, 
  masjid_id, 
  user_id, 
  role, 
  status,
  CASE 
    WHEN id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'Valid UUID'
    ELSE 'INVALID - Contains email or other data'
  END as id_status
FROM user_roles
LIMIT 10;

-- Step 2: Count how many records have invalid IDs
SELECT 
  COUNT(*) as total_records,
  SUM(CASE WHEN id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 1 ELSE 0 END) as valid_uuid_count,
  SUM(CASE WHEN id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 1 ELSE 0 END) as invalid_id_count
FROM user_roles;

-- Step 3: Show records with invalid IDs (emails in id column)
SELECT id, email, masjid_id, role, status
FROM user_roles
WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
LIMIT 10;

-- Step 4: Fix records with invalid IDs by regenerating proper UUIDs
-- WARNING: This will update the id column for records that have invalid IDs
-- Run this only after verifying the data above

-- Uncomment the following to fix the data:
/*
UPDATE user_roles
SET id = gen_random_uuid()
WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
*/
