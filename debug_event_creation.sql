-- DEBUG EVENT CREATION - Check Current User Data
-- Verify user_roles and masjids data for current user

-- Step 1: Check current authenticated user
SELECT 
    auth.uid() as current_user_id,
    auth.jwt() ->> 'email' as current_email;

-- Step 2: Check user_roles for current user
SELECT 
    id,
    masjid_id,
    user_id,
    email,
    role,
    permissions,
    created_at
FROM user_roles 
WHERE user_id = auth.uid();

-- Step 3: Check if those masjid_ids exist in masjids table
SELECT 
    ur.id as user_role_id,
    ur.masjid_id,
    ur.user_id,
    ur.role,
    m.id as masjid_exists,
    m.name as masjid_name,
    CASE 
        WHEN m.id IS NULL THEN 'MASJID NOT FOUND'
        ELSE 'MASJID EXISTS'
    END as status
FROM user_roles ur
LEFT JOIN masjids m ON ur.masjid_id = m.id
WHERE ur.user_id = auth.uid();

-- Step 4: Check all masjids created by this user (fallback)
SELECT 
    id,
    name,
    created_by,
    CASE 
        WHEN created_by = auth.uid() THEN 'OWNED BY USER'
        ELSE 'NOT OWNED'
    END as ownership_status
FROM masjids 
WHERE created_by = auth.uid();

-- Step 5: Check events table structure and constraints
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name IN ('masjid_id', 'title', 'event_date')
ORDER BY ordinal_position;

-- Step 6: Check foreign key constraint on events.masjid_id
SELECT
    tc.constraint_name,
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
AND tc.table_name = 'events';
