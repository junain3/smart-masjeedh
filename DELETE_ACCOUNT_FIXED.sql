-- FIXED COMPLETE ACCOUNT DELETION
-- Handle foreign key constraints properly

-- Step 1: Find user and related data
SELECT id, email FROM auth.users WHERE email = 'mohammedjunain@gmail.com';

-- Step 2: Find all masjids created by user
SELECT id, name FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 3: Delete transactions first (foreign key constraint)
DELETE FROM transactions WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

-- Step 4: Delete collections (if exists)
DELETE FROM collections WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

-- Step 5: Delete events (if exists)
DELETE FROM events WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

-- Step 6: Delete members (if exists)
DELETE FROM members WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

-- Step 7: Delete families (if exists)
DELETE FROM families WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

-- Step 8: Delete user roles
DELETE FROM user_roles WHERE auth_user_id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 9: Delete invitations
DELETE FROM invitations WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 10: Delete masjids (after all references deleted)
DELETE FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 11: Finally delete the auth user
DELETE FROM auth.users WHERE id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 12: Verify complete deletion
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users WHERE email = 'mohammedjunain@gmail.com'
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles WHERE auth_user_id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
UNION ALL
SELECT 'masjids', COUNT(*) FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
UNION ALL
SELECT 'invitations', COUNT(*) FROM invitations WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

-- All counts should be 0 if deletion successful
