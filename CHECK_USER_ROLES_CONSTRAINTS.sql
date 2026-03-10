-- CHECK USER_ROLES TABLE CONSTRAINTS
-- Verify role check constraint

-- Step 1: Check table constraints
SELECT conname, contype, consrc 
FROM pg_constraint 
WHERE conrelid = 'user_roles'::regclass;

-- Step 2: Check specifically for role constraint
SELECT conname, contype, consrc 
FROM pg_constraint 
WHERE conrelid = 'user_roles'::regclass 
AND conname LIKE '%role%';

-- Step 3: Check column definition
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND column_name = 'role';

-- Step 4: Check existing role values in table
SELECT DISTINCT role FROM user_roles;

-- Step 5: Show sample data
SELECT * FROM user_roles LIMIT 3;
