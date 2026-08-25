-- CHECK MASJIDS TABLE SCHEMA
-- Verify the column names in the masjids table

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'masjids' 
ORDER BY ordinal_position;
