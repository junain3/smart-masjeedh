-- CHECK USER_ROLES TABLE STRUCTURE
-- Verify column names and RLS status

-- Step 1: Check table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
ORDER BY ordinal_position;

-- Step 2: Check if RLS is enabled
SELECT relname, relrowsecurity, relforcerls 
FROM pg_class 
WHERE relname = 'user_roles';

-- Step 3: Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'user_roles';

-- Step 4: Show sample data (if any)
SELECT * FROM user_roles LIMIT 1;

-- Step 5: Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'user_roles'
);
