-- Create Admin User for Mohammed Junain

-- First get the user ID
SELECT id, email FROM auth.users WHERE email = 'mohammedjunain@gmail.com';

-- If user exists, create masjid and role
-- Replace USER_ID with the actual ID from above query

-- Step 1: Create masjid
INSERT INTO masjids (name, owner_id, created_at)
SELECT 'Smart Masjeedh', id, NOW()
FROM auth.users 
WHERE email = 'mohammedjunain@gmail.com'
AND NOT EXISTS (SELECT 1 FROM masjids WHERE owner_id = id);

-- Step 2: Create user role
INSERT INTO user_roles (masjid_id, user_id, role, permissions, created_at)
SELECT 
    m.id,
    u.id,
    'super_admin',
    '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true}',
    NOW()
FROM auth.users u
JOIN masjids m ON m.owner_id = u.id
WHERE u.email = 'mohammedjunain@gmail.com'
AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = u.id);

-- Step 3: Verify
SELECT 
    u.email,
    u.email_confirmed_at,
    m.name as masjid_name,
    ur.role,
    ur.permissions
FROM auth.users u
JOIN masjids m ON m.owner_id = u.id
JOIN user_roles ur ON ur.user_id = u.id
WHERE u.email = 'mohammedjunain@gmail.com';
