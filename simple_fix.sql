-- Simple Fix - Run step by step

-- Step 1: Check user ID
SELECT id, email FROM auth.users WHERE email = 'mohammedjunain@gmail.com';

-- Step 2: Create masjid (replace USER_ID with actual ID from step 1)
INSERT INTO masjids (name, owner_id, created_at)
VALUES ('Test Masjid', 'USER_ID_HERE', NOW());

-- Step 3: Create user role (replace USER_ID and MASJID_ID)
INSERT INTO user_roles (masjid_id, user_id, role, permissions, created_at)
VALUES ('MASJID_ID_HERE', 'USER_ID_HERE', 'super_admin', 
        '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true}', 
        NOW());

-- Step 4: Verify
SELECT u.email, m.name as masjid_name, ur.role 
FROM auth.users u
JOIN masjids m ON m.owner_id = u.id  
JOIN user_roles ur ON ur.user_id = u.id
WHERE u.email = 'mohammedjunain@gmail.com';
