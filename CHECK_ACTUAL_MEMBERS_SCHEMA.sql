-- CHECK ACTUAL MEMBERS TABLE SCHEMA
-- Find what columns actually exist

-- Step 1: Check all columns in members table
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'members' 
ORDER BY ordinal_position;

-- Step 2: Show sample data to see actual structure
SELECT * FROM members LIMIT 1;

-- Step 3: Check if there's a name column with different name
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'members' 
AND (column_name LIKE '%name%' OR column_name LIKE '%member%');

-- Step 4: Show table structure using information_schema
SELECT 
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    c.character_maximum_length
FROM information_schema.columns c
WHERE c.table_name = 'members'
ORDER BY c.ordinal_position;

-- Step 5: Show table constraints
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'members';
