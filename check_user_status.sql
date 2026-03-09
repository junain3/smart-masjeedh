-- Check User Status in Detail

-- Check user confirmation status
SELECT 
    id, 
    email, 
    email_confirmed_at, 
    created_at, 
    last_sign_in_at,
    phone,
    phone_confirmed_at
FROM auth.users 
WHERE email = 'mohammedjunain@gmail.com';

-- Check if user has any failed login attempts
SELECT * FROM auth.audit_log 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'mohammedjunain@gmail.com')
ORDER BY created_at DESC 
LIMIT 10;

-- Check user role exists
SELECT * FROM user_roles 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'mohammedjunain@gmail.com');
