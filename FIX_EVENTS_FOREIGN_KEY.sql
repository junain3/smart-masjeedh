-- FIX EVENTS FOREIGN KEY CONSTRAINT ISSUES
-- Ensure proper masjid_id handling

-- Step 1: Check if user has valid masjid context
-- This query should be run by the authenticated user
SELECT 
    auth.uid() as current_user_id,
    ur.masjid_id as user_masjid_id,
    m.masjid_name,
    m.id as masjid_table_id
FROM user_roles ur
JOIN masjids m ON ur.masjid_id = m.id
WHERE ur.auth_user_id = auth.uid()
LIMIT 1;

-- Step 2: If user has no masjid context, create one
-- This should only be run if the user has no masjid
DO $$
DECLARE
    user_masjid_id UUID;
    current_auth_user UUID := auth.uid()::UUID;
BEGIN
    -- Check if user has masjid context
    SELECT masjid_id INTO user_masjid_id
    FROM user_roles 
    WHERE auth_user_id = current_auth_user 
    LIMIT 1;
    
    -- If no masjid context, check if user created a masjid
    IF user_masjid_id IS NULL THEN
        SELECT id INTO user_masjid_id
        FROM masjids 
        WHERE created_by = current_auth_user 
        LIMIT 1;
        
        -- If masjid exists but no user_roles, create user_roles
        IF user_masjid_id IS NOT NULL THEN
            INSERT INTO user_roles (
                masjid_id, 
                user_id, 
                auth_user_id, 
                email, 
                role, 
                permissions, 
                verified
            ) VALUES (
                user_masjid_id,
                current_auth_user,
                current_auth_user,
                (SELECT email FROM auth.users WHERE id = current_auth_user),
                'super_admin',
                '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true, "staff_management": true, "reports": true, "settings": true}',
                true
            );
            
            RAISE NOTICE 'Created user_roles for existing masjid';
        END IF;
    END IF;
    
    IF user_masjid_id IS NULL THEN
        RAISE NOTICE 'User has no masjid context and no masjid created';
    ELSE
        RAISE NOTICE 'User masjid context: %', user_masjid_id;
    END IF;
END $$;

-- Step 3: Verify user context after fix
SELECT 
    auth.uid() as current_user_id,
    ur.masjid_id as user_masjid_id,
    m.masjid_name
FROM user_roles ur
JOIN masjids m ON ur.masjid_id = m.id
WHERE ur.auth_user_id = auth.uid()
LIMIT 1;

-- Step 4: Test event insertion with proper masjid_id
-- This should be run by the authenticated user
DO $$
DECLARE
    user_masjid_id UUID;
    current_auth_user UUID := auth.uid()::UUID;
BEGIN
    -- Get user's masjid_id
    SELECT masjid_id INTO user_masjid_id
    FROM user_roles 
    WHERE auth_user_id = current_auth_user 
    LIMIT 1;
    
    -- Test insertion
    IF user_masjid_id IS NOT NULL THEN
        INSERT INTO events (
            masjid_id,
            title,
            description,
            event_date,
            event_time,
            location,
            created_by
        ) VALUES (
            user_masjid_id,
            'Test Event',
            'This is a test event',
            CURRENT_DATE,
            '10:00',
            'Main Hall',
            current_auth_user
        );
        
        RAISE NOTICE 'Test event created successfully with masjid_id: %', user_masjid_id;
    ELSE
        RAISE NOTICE 'Cannot create event - no masjid context';
    END IF;
END $$;

-- Step 5: Show created events
SELECT id, title, masjid_id, created_by, created_at 
FROM events 
ORDER BY created_at DESC 
LIMIT 3;
