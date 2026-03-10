-- Step 1: Check current masjids table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'masjids' 
ORDER BY ordinal_position;

-- Step 2: Check RLS policies for INSERT
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'masjids';

-- Step 3: Test INSERT manually (simulate what app does)
INSERT INTO masjids (name, tagline, created_by) 
VALUES ('Test Masjid', 'Test Tagline', '6021e985-e8b9-44cb-b29d-e586d6f7d1fb')
RETURNING *;

-- Step 4: Check if user has permission to INSERT
SELECT auth.uid() as current_user_id;

-- Step 5: Check if there are any constraints
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'masjids'::regclass;

-- Step 6: Show sample data to understand expected format
SELECT * FROM masjids LIMIT 1;
