-- Step 3: Create User Role - Copy this exactly

INSERT INTO user_roles (masjid_id, user_id, role, permissions, created_at)
VALUES ('fe25e56e-21f0-432a-8e02-ceb36b47ec00', '6021e985-e8b9-44cb-b29d-e586d6f7d1fb', 'super_admin', 
        '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true}', 
        NOW());

-- Step 4: Verify
SELECT 
    u.email,
    m.masjid_name,
    ur.role,
    ur.permissions
FROM auth.users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN masjids m ON m.id = ur.masjid_id
WHERE u.email = 'mohammedjunain@gmail.com';
