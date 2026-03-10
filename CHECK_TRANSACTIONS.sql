-- CHECK TRANSACTION DATA AND RELATIONSHIPS
-- Understand the foreign key constraints

-- Step 1: Find user's masjids
SELECT id, name FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 2: Check transactions for those masjids
SELECT COUNT(*) as transaction_count FROM transactions WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

-- Step 3: Show sample transaction data
SELECT * FROM transactions WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
) LIMIT 5;

-- Step 4: Check foreign key constraints
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
    AND (tc.table_name = 'transactions' OR tc.table_name = 'masjids');
