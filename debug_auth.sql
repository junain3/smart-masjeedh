-- Debug Auth Issues - Run this in Supabase SQL Editor

-- Check if user exists in auth.users
SELECT id, email, email_confirmed_at, created_at, last_sign_in_at 
FROM auth.users 
WHERE email = 'mohammedjunain@gmail.com';

-- Check if user has role in user_roles
SELECT * FROM user_roles 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'mohammedjunain@gmail.com');

-- Check if user has any masjid association
SELECT * FROM masjids 
WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'mohammedjunain@gmail.com');

-- Also check all masjids for this user
SELECT * FROM user_roles 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'mohammedjunain@gmail.com');
