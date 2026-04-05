-- CHECK ACTUAL MASJIDS TABLE STRUCTURE
-- Verify what columns actually exist in masjids table

SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'masjids' 
AND table_schema = 'public'
ORDER BY ordinal_position;
