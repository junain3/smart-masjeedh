-- Password Reset Options

-- Option 1: Check user status
SELECT id, email, email_confirmed_at, last_sign_in_at, created_at 
FROM auth.users 
WHERE email = 'mohammedjunain@gmail.com';

-- Option 2: Force email confirmation (if needed)
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'mohammedjunain@gmail.com';

-- Option 3: Check if there are any failed login attempts
-- (This might help identify the issue)

-- Option 4: Test with a simple password reset request
-- You can do this through Supabase Dashboard -> Authentication -> Users
-- Find your user and click "Reset Password"
