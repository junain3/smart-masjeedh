-- CHECK MASJID TABLE SCHEMA
-- Verify actual column names

SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'masjids' 
ORDER BY ordinal_position;

-- Check if there's a masjid_name column
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'masjids' 
AND column_name IN ('name', 'masjid_name');

-- Show sample data structure
SELECT * FROM masjids LIMIT 1;
