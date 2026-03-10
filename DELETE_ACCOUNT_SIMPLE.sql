-- SIMPLE ACCOUNT DELETION
-- Only delete tables that actually exist

-- Step 1: Find user and masjids
SELECT id, email FROM auth.users WHERE email = 'mohammedjunain@gmail.com';
SELECT id, name FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 2: Delete transactions (if exists)
DELETE FROM transactions WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

-- Step 3: Delete user roles
DELETE FROM user_roles WHERE auth_user_id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 4: Delete invitations
DELETE FROM invitations WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 5: Delete masjids
DELETE FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 6: Delete auth user
DELETE FROM auth.users WHERE id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 7: Verify deletion
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users WHERE email = 'mohammedjunain@gmail.com'
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles WHERE auth_user_id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
UNION ALL
SELECT 'masjids', COUNT(*) FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
UNION ALL
SELECT 'invitations', COUNT(*) FROM invitations WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';
