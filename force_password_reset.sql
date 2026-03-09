-- Force Password Reset through SQL

-- Step 1: Check current user status
SELECT id, email, email_confirmed_at, last_sign_in_at, created_at 
FROM auth.users 
WHERE email = 'mohammedjunain@gmail.com';

-- Step 2: Force email confirmation (if needed)
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'mohammedjunain@gmail.com';

-- Step 3: Create a magic link (temporary solution)
-- This will send a reset link to your email
-- Run this in Supabase Dashboard -> Authentication -> Email Templates -> Magic Link

-- Step 4: Alternative - Create new admin user with known password
-- If all else fails, we can create a new admin user

-- Step 5: Check if there are any authentication issues
SELECT * FROM auth.sessions 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'mohammedjunain@gmail.com');
