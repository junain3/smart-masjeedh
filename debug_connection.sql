-- Debug Supabase Connection

-- Check if Supabase is responding
SELECT 1 as test_connection;

-- Check authentication service
SELECT * FROM auth.users LIMIT 1;

-- Check if our user exists
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'mohammedjunain@gmail.com';

-- Check if user_roles table is accessible
SELECT * FROM user_roles LIMIT 1;

-- Check if masjids table is accessible  
SELECT * FROM masjids LIMIT 1;
