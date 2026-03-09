-- Check masjids table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'masjids' 
ORDER BY ordinal_position;

-- Check existing masjids data
SELECT * FROM masjids LIMIT 5;

-- Check user_roles table structure  
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_roles'
ORDER BY ordinal_position;

-- Check existing user_roles data
SELECT * FROM user_roles LIMIT 5;
