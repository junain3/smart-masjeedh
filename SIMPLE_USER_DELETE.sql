-- SIMPLE USER DELETE - Alternative Approach
-- Delete users without touching system triggers

-- Step 1: List all current users first
SELECT id, email, created_at FROM auth.users ORDER BY created_at;

-- Step 2: Delete user roles first (child records)
DELETE FROM user_roles;

-- Step 3: Delete invitations 
DELETE FROM invitations;

-- Step 4: Delete masjids
DELETE FROM masjids;

-- Step 5: Delete transactions (if exists)
DELETE FROM transactions;

-- Step 6: Now try to delete auth users
-- This might work without trigger issues
DELETE FROM auth.users;

-- Step 7: Verify deletion
SELECT COUNT(*) as remaining_users FROM auth.users;
SELECT COUNT(*) as remaining_masjids FROM masjids;
SELECT COUNT(*) as remaining_roles FROM user_roles;

-- If still have users, try individual deletion
-- Uncomment and run if needed:

-- DELETE FROM auth.users WHERE email = 'mohammedjunain@gmail.com';
-- DELETE FROM auth.users WHERE email = 'testuser2024@gmail.com';
-- Add more emails as needed
