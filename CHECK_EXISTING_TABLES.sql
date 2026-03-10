-- CHECK WHAT TABLES ACTUALLY EXIST
-- Don't assume table names

-- Step 1: List all tables in public schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Step 2: Check user-specific data
SELECT 'user_roles' as table_name, COUNT(*) as count FROM user_roles WHERE auth_user_id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
UNION ALL
SELECT 'masjids', COUNT(*) FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
UNION ALL
SELECT 'invitations', COUNT(*) FROM invitations WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 3: Check if transactions exists
SELECT COUNT(*) as transaction_count FROM transactions WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

-- Step 4: Find user
SELECT id, email FROM auth.users WHERE email = 'mohammedjunain@gmail.com';

-- Step 5: Find user's masjids
SELECT id, name FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';
