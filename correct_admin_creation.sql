-- Correct Admin User Creation - Based on Actual Table Structure

-- Step 1: Get user ID
SELECT id, email FROM auth.users WHERE email = 'mohammedjunain@gmail.com';

-- Step 2: Create masjid (without owner_id - we'll link via user_roles)
INSERT INTO masjids (name, created_at)
VALUES ('Smart Masjeedh', NOW())
RETURNING id;

-- Step 3: Create user role (this links user to masjid)
-- Replace USER_ID and MASJID_ID with actual values from steps 1 & 2
INSERT INTO user_roles (masjid_id, user_id, role, permissions, created_at)
VALUES ('MASJID_ID_HERE', 'USER_ID_HERE', 'super_admin', 
        '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true}', 
        NOW());

-- Step 4: Alternative - If masjid already exists, just create user role
-- First check existing masjids
SELECT * FROM masjids;

-- Then create user role with existing masjid
INSERT INTO user_roles (masjid_id, user_id, role, permissions, created_at)
SELECT id, 'USER_ID_HERE', 'super_admin', 
       '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true}', 
       NOW()
FROM masjids 
WHERE name = 'Smart Masjeedh' OR id = 'EXISTING_MASJID_ID';

-- Step 5: Verify
SELECT 
    u.email,
    u.email_confirmed_at,
    m.name as masjid_name,
    ur.role,
    ur.permissions
FROM auth.users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN masjids m ON m.id = ur.masjid_id
WHERE u.email = 'mohammedjunain@gmail.com';
