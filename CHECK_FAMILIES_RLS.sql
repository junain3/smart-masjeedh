-- CHECK FAMILIES RLS POLICIES
-- Verify permissions for family operations

-- Step 1: Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'families';

-- Step 2: Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'families';

-- Step 3: Check if user has access to families
-- This should be run by an authenticated user
SELECT 
  COUNT(*) as family_count,
  masjid_id
FROM families 
GROUP BY masjid_id;

-- Step 4: Test insert permission (should fail if no proper policy)
-- This should be run by an authenticated user
INSERT INTO families (
  family_code, 
  family_name, 
  address, 
  phone, 
  subscription_amount, 
  opening_balance, 
  is_widow_head, 
  masjid_id
) VALUES (
  'TEST001', 
  'Test Family', 
  'Test Address', 
  '1234567890', 
  1000.00, 
  0.00, 
  false, 
  'test-masjid-id'
);

-- Rollback the test insert
ROLLBACK;
