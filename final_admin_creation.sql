-- Final Correct Admin User Creation - Based on Actual Column Names

-- Step 1: Get user ID (already have: 6021e985-e8b9-44cb-b29d-e586d6f7d1fb)
SELECT id, email FROM auth.users WHERE email = 'mohammedjunain@gmail.com';

-- Step 2: Create masjid with correct column name
INSERT INTO masjids (masjid_name, created_at)
VALUES ('Smart Masjeedh', NOW())
RETURNING id;

-- Step 3: Create user role
-- Replace MASJID_ID with actual ID from step 2
INSERT INTO user_roles (masjid_id, user_id, role, permissions, created_at)
VALUES ('MASJID_ID_HERE', '6021e985-e8b9-44cb-b29d-e586d6f7d1fb', 'super_admin', 
        '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true}', 
        NOW());

-- Step 4: Verify
SELECT 
    u.email,
    u.email_confirmed_at,
    m.masjid_name,
    ur.role,
    ur.permissions
FROM auth.users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN masjids m ON m.id = ur.masjid_id
WHERE u.email = 'mohammedjunain@gmail.com';
