-- CHECK ACTUAL FAMILIES TABLE SCHEMA
-- Find correct column names

-- Step 1: Check all columns in families table
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'families' 
ORDER BY ordinal_position;

-- Step 2: Show sample data to see actual column names
SELECT * FROM families LIMIT 1;

-- Step 3: Check if there's a name column with different name
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'families' 
AND (column_name LIKE '%name%' OR column_name LIKE '%code%');

-- Step 4: Show table structure
\d families;
