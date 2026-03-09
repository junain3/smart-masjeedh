-- Simple User Status Check

-- Check user confirmation status
SELECT 
    id, 
    email, 
    email_confirmed_at, 
    created_at, 
    last_sign_in_at,
    CASE 
        WHEN email_confirmed_at IS NULL THEN 'NOT CONFIRMED'
        ELSE 'CONFIRMED'
    END as confirmation_status
FROM auth.users 
WHERE email = 'mohammedjunain@gmail.com';

-- Check user role exists
SELECT 
    ur.role,
    ur.permissions,
    m.masjid_name
FROM user_roles ur
JOIN masjids m ON m.id = ur.masjid_id
WHERE ur.user_id = (SELECT id FROM auth.users WHERE email = 'mohammedjunain@gmail.com');

-- Check if there are any similar emails
SELECT email, created_at, email_confirmed_at 
FROM auth.users 
WHERE email ILIKE '%mohammed%' OR email ILIKE '%junain%';
