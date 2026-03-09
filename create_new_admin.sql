-- Create New Admin User with Temporary Password

-- Option 1: Create new admin user (if current one has issues)
-- You'll need to sign up with this email first

-- Step 1: Create masjid if not exists (we already have one)
SELECT * FROM masjids WHERE masjid_name = 'Smart Masjeedh';

-- Step 2: After sign-up, create role for new user
-- Replace NEW_USER_EMAIL with the email you used for sign-up
INSERT INTO user_roles (masjid_id, user_id, role, permissions, created_at)
SELECT 
    id,
    (SELECT id FROM auth.users WHERE email = 'NEW_USER_EMAIL'),
    'super_admin',
    '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true}',
    NOW()
FROM masjids 
WHERE masjid_name = 'Smart Masjeedh';

-- Option 2: Test with existing user but reset through signup flow
-- Go to /register page and try to create a new account with a different email
