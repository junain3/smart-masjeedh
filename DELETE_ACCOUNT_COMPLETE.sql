-- COMPLETE ACCOUNT DELETION FOR TESTING
-- This will remove all traces of the user account

-- Step 1: Find user ID (for verification)
SELECT id, email, created_at FROM auth.users WHERE email = 'mohammedjunain@gmail.com';

-- Step 2: Delete user roles (permissions)
DELETE FROM user_roles WHERE auth_user_id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 3: Delete masjids created by user
DELETE FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 4: Delete invitations sent by user
DELETE FROM invitations WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 5: Delete any family records (if exists)
-- Note: Add this if you have families table with user references
-- DELETE FROM families WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 6: Delete any member records (if exists)
-- Note: Add this if you have members table with user references
-- DELETE FROM members WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 7: Finally delete the auth user
DELETE FROM auth.users WHERE id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 8: Verify complete deletion
SELECT * FROM auth.users WHERE email = 'mohammedjunain@gmail.com';
SELECT * FROM user_roles WHERE auth_user_id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';
SELECT * FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';
SELECT * FROM invitations WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- All queries should return 0 rows if deletion successful
