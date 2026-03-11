-- CHECK MEMBERS TABLE SCHEMA
-- Verify members table exists and has correct structure

-- Step 1: Check if members table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'members'
);

-- Step 2: Check table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'members' 
ORDER BY ordinal_position;

-- Step 3: Check if table has any data
SELECT COUNT(*) as member_count FROM members;

-- Step 4: Show sample data if exists
SELECT * FROM members LIMIT 3;

-- Step 5: Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'members';

-- Step 6: Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'members';
