-- CHECK EVENTS TABLE FOREIGN KEY CONSTRAINTS
-- Verify masjid_id foreign key relationship

-- Step 1: Check events table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;

-- Step 2: Check foreign key constraints
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
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
AND tc.table_name = 'events';

-- Step 3: Check user's current masjid context
SELECT 
    auth.uid() as current_user_id,
    ur.masjid_id,
    m.masjid_name
FROM user_roles ur
JOIN masjids m ON ur.masjid_id = m.id
WHERE ur.auth_user_id = auth.uid()
LIMIT 1;

-- Step 4: Check available masjids
SELECT id, masjid_name, created_by 
FROM masjids
ORDER BY created_at DESC
LIMIT 5;

-- Step 5: Check if events table exists and has data
SELECT COUNT(*) as event_count FROM events;
