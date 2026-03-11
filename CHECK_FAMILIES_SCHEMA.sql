-- CHECK FAMILIES TABLE SCHEMA
-- Verify opening_balance column exists

-- Step 1: Check table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'families' 
ORDER BY ordinal_position;

-- Step 2: Check specifically for opening_balance column
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'families' 
AND column_name = 'opening_balance';

-- Step 3: Show sample data
SELECT * FROM families LIMIT 3;

-- Step 4: Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'families'
);
