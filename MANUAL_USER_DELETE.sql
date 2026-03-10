-- MANUAL USER DELETE - Delete Users One by One
-- Avoid system trigger issues

-- Step 1: List all users to see what we have
SELECT id, email, created_at FROM auth.users ORDER BY created_at;

-- Step 2: Delete user data for each user
-- Replace with actual user emails from your database

-- Example for mohammedjunain@gmail.com:
DELETE FROM user_roles WHERE auth_user_id = (SELECT id FROM auth.users WHERE email = 'mohammedjunain@gmail.com');
DELETE FROM masjids WHERE created_by = (SELECT id FROM auth.users WHERE email = 'mohammedjunain@gmail.com');
DELETE FROM invitations WHERE created_by = (SELECT id FROM auth.users WHERE email = 'mohammedjunain@gmail.com');
DELETE FROM auth.users WHERE email = 'mohammedjunain@gmail.com';

-- Example for testuser2024@gmail.com:
DELETE FROM user_roles WHERE auth_user_id = (SELECT id FROM auth.users WHERE email = 'testuser2024@gmail.com');
DELETE FROM masjids WHERE created_by = (SELECT id FROM auth.users WHERE email = 'testuser2024@gmail.com');
DELETE FROM invitations WHERE created_by = (SELECT id FROM auth.users WHERE email = 'testuser2024@gmail.com');
DELETE FROM auth.users WHERE email = 'testuser2024@gmail.com';

-- Step 3: Check what's left
SELECT id, email, created_at FROM auth.users ORDER BY created_at;

-- Step 4: If you have other users, add them above following the same pattern
