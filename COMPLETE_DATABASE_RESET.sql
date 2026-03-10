-- COMPLETE DATABASE RESET - FRESH START
-- This will delete ALL user data and start fresh

-- Step 1: Disable constraints temporarily
ALTER TABLE transactions DISABLE TRIGGER ALL;
ALTER TABLE user_roles DISABLE TRIGGER ALL;
ALTER TABLE invitations DISABLE TRIGGER ALL;
ALTER TABLE masjids DISABLE TRIGGER ALL;

-- Step 2: Delete ALL data in correct order (child tables first)

-- Delete transactions (if exists)
DELETE FROM transactions;

-- Delete user roles
DELETE FROM user_roles;

-- Delete invitations
DELETE FROM invitations;

-- Delete masjids
DELETE FROM masjids;

-- Delete auth users (this will remove all registered emails)
DELETE FROM auth.users;

-- Step 3: Re-enable constraints
ALTER TABLE transactions ENABLE TRIGGER ALL;
ALTER TABLE user_roles ENABLE TRIGGER ALL;
ALTER TABLE invitations ENABLE TRIGGER ALL;
ALTER TABLE masjids ENABLE TRIGGER ALL;

-- Step 4: Reset sequences (if any)
-- This ensures new records start from ID 1
--ALTER TABLE masjids ALTER COLUMN id RESTART WITH 1;
--ALTER TABLE user_roles ALTER COLUMN id RESTART WITH 1;
--ALTER TABLE invitations ALTER COLUMN id RESTART WITH 1;

-- Step 5: Verify complete deletion
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles
UNION ALL
SELECT 'masjids', COUNT(*) FROM masjids
UNION ALL
SELECT 'invitations', COUNT(*) FROM invitations
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions;

-- All counts should be 0 for complete reset

-- Step 6: Show remaining auth users (should be empty)
SELECT id, email, created_at FROM auth.users;

-- Step 7: Show remaining masjids (should be empty)
SELECT id, masjid_name, created_by FROM masjids;

-- COMPLETE RESET DONE - FRESH START READY!
