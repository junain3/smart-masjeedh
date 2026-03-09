-- Quick Admin Fix - Create New Admin User

-- Step 1: Go to http://localhost:3000/register
-- Email: admin@smartmasjeedh.com
-- Password: admin123
-- Register first, then run this SQL

-- Step 2: Give admin role to new user
INSERT INTO user_roles (masjid_id, user_id, role, permissions, created_at)
SELECT 
    (SELECT id FROM masjids WHERE masjid_name = 'Smart Masjeedh'),
    (SELECT id FROM auth.users WHERE email = 'admin@smartmasjeedh.com'),
    'super_admin',
    '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true}',
    NOW();

-- Step 3: Verify
SELECT 
    u.email,
    u.email_confirmed_at,
    ur.role,
    m.masjid_name
FROM auth.users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN masjids m ON m.id = ur.masjid_id
WHERE u.email = 'admin@smartmasjeedh.com';
