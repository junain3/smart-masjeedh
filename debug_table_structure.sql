-- Check current masjids table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'masjids' 
ORDER BY ordinal_position;

-- Check if table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'masjids';

-- Show sample data (if any)
SELECT * FROM masjids LIMIT 1;
