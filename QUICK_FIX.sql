-- QUICK FIX - Check and Fix Column Names
-- Run this immediately

-- Check what columns actually exist in user_roles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if there's any data
SELECT COUNT(*) as total_records FROM user_roles;

-- If you have data, check what it looks like
SELECT * FROM user_roles LIMIT 3;
