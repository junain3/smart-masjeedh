-- CHECK ALL TABLES FOR USER REFERENCES
-- See what data exists before deletion

-- Step 1: Find user ID
SELECT id, email FROM auth.users WHERE email = 'mohammedjunain@gmail.com';

-- Step 2: Check all tables that might reference the user
SELECT 'user_roles' as table_name, COUNT(*) as count FROM user_roles WHERE auth_user_id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
UNION ALL
SELECT 'masjids', COUNT(*) FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
UNION ALL
SELECT 'invitations', COUNT(*) FROM invitations WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 3: Find all masjids created by user
SELECT id, name, created_at FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 4: Check what tables reference masjids
SELECT table_name, constraint_name 
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
AND table_schema = 'public';

-- Step 5: Check transactions table specifically
SELECT COUNT(*) as transaction_count FROM transactions WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

-- Step 6: Sample transaction data
SELECT * FROM transactions WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
) LIMIT 5;
