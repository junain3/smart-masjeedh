-- Fix User Confirmation Issues

-- Force email confirmation (if needed)
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'mohammedjunain@gmail.com' 
AND email_confirmed_at IS NULL;

-- Check if user exists and is confirmed
SELECT 
    id, 
    email, 
    email_confirmed_at, 
    created_at,
    CASE 
        WHEN email_confirmed_at IS NULL THEN 'NOT CONFIRMED'
        ELSE 'CONFIRMED'
    END as status
FROM auth.users 
WHERE email = 'mohammedjunain@gmail.com';

-- If user doesn't exist, we need to create one
-- But first let's check if there are any similar emails
SELECT email, created_at, email_confirmed_at 
FROM auth.users 
WHERE email LIKE '%mohammedjunain%' OR email LIKE '%junain%';
