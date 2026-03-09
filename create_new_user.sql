-- Create New User with Known Password (if needed)

-- Option 1: Check if user exists with different email
SELECT email, created_at, email_confirmed_at 
FROM auth.users 
WHERE email ILIKE '%mohammed%' OR email ILIKE '%junain%';

-- Option 2: If user exists but password unknown, create new admin
-- First, create a new user with simple password
-- You'll need to do this through Supabase Dashboard -> Authentication -> Users

-- Option 3: Create new admin user with different email
-- Step 1: Create user through signup (http://localhost:3000/register)
-- Email: admin@smartmasjeedh.com
-- Password: admin123

-- Step 2: Then run this to give admin role
INSERT INTO user_roles (masjid_id, user_id, role, permissions, created_at)
SELECT 
    id,
    (SELECT id FROM auth.users WHERE email = 'admin@smartmasjeedh.com'),
    'super_admin',
    '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true}',
    NOW()
FROM masjids 
WHERE masjid_name = 'Smart Masjeedh';
