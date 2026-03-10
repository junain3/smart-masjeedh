-- CORRECT DELETION ORDER - Handle foreign keys properly
-- Delete in reverse order of dependencies

-- Step 1: Find user and their masjids
SELECT id, email FROM auth.users WHERE email = 'mohammedjunain@gmail.com';
SELECT id, name FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 2: Delete transactions FIRST (child records)
DELETE FROM transactions WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

-- Verify transactions deleted
SELECT COUNT(*) as remaining_transactions FROM transactions WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

-- Step 3: Delete user roles
DELETE FROM user_roles WHERE auth_user_id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 4: Delete invitations
DELETE FROM invitations WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 5: Delete masjids (parent records)
DELETE FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 6: Finally delete auth user (root record)
DELETE FROM auth.users WHERE id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 7: Verify complete deletion
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users WHERE email = 'mohammedjunain@gmail.com'
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles WHERE auth_user_id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
UNION ALL
SELECT 'masjids', COUNT(*) FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
UNION ALL
SELECT 'invitations', COUNT(*) FROM invitations WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
UNION ALL
SELECT 'transactions', COUNT(*) as count FROM transactions WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

-- All counts should be 0
