-- CHECK ACTUAL EVENTS TABLE SCHEMA
-- Find what columns actually exist

-- Step 1: Check all columns in events table
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;

-- Step 2: Show sample data to see actual structure
SELECT * FROM events LIMIT 1;

-- Step 3: Check if there's a title column with different name
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'events' 
AND (column_name LIKE '%title%' OR column_name LIKE '%name%' OR column_name LIKE '%event%');
