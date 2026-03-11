-- COMPLETE EVENTS FIX - Deep Solution
-- Fix all issues permanently

-- Step 1: Create user context if missing
DO $$
DECLARE
    user_id TEXT := auth.uid()::TEXT;
    user_uuid UUID;
    masjid_id UUID;
BEGIN
    -- Only proceed if user is authenticated
    IF user_id LIKE '%-%-%-%-%' THEN
        user_uuid := user_id::UUID;
        
        -- Check if user has user_roles
        SELECT ur.masjid_id INTO masjid_id
        FROM user_roles ur
        WHERE ur.auth_user_id = user_uuid
        LIMIT 1;
        
        -- If no user_roles, check if user created masjid
        IF masjid_id IS NULL THEN
            SELECT m.id INTO masjid_id
            FROM masjids m
            WHERE m.created_by = user_uuid
            LIMIT 1;
            
            -- If masjid exists but no user_roles, create user_roles
            IF masjid_id IS NOT NULL THEN
                INSERT INTO user_roles (
                    masjid_id,
                    user_id,
                    auth_user_id,
                    email,
                    role,
                    permissions,
                    verified
                ) VALUES (
                    masjid_id,
                    user_uuid,
                    user_uuid,
                    COALESCE((SELECT email FROM auth.users WHERE id = user_uuid), 'unknown@example.com'),
                    'super_admin',
                    '{"accounts": true, "events": true, "members": true, "subscriptions_collect": true, "subscriptions_approve": true, "staff_management": true, "reports": true, "settings": true}',
                    true
                );
                
                RAISE NOTICE 'Created user_roles for masjid: %', masjid_id;
            END IF;
        END IF;
        
        -- If we have masjid_id, create test event
        IF masjid_id IS NOT NULL THEN
            -- First check if events table has required columns
            PERFORM 1 FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = 'title';
            
            IF FOUND THEN
                INSERT INTO events (
                    masjid_id,
                    title,
                    description,
                    event_date,
                    event_time,
                    location,
                    created_by
                ) VALUES (
                    masjid_id,
                    'Test Event - ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
                    'This is a test event created by system',
                    CURRENT_DATE,
                    '10:00',
                    'Main Hall',
                    user_uuid
                );
                
                RAISE NOTICE 'Test event created successfully with masjid_id: %', masjid_id;
            ELSE
                RAISE NOTICE 'Events table missing required columns';
            END IF;
        ELSE
            RAISE NOTICE 'No masjid context found for user: %', user_id;
        END IF;
    ELSE
        RAISE NOTICE 'User not authenticated: %', user_id;
    END IF;
END $$;

-- Step 2: Verify the fix
SELECT 
    'Verification' as step,
    auth.uid()::TEXT as current_uid,
    ur.masjid_id::TEXT as masjid_id,
    m.masjid_name,
    COUNT(e.id) as event_count
FROM user_roles ur
JOIN masjids m ON ur.masjid_id = m.id
LEFT JOIN events e ON e.masjid_id = ur.masjid_id
WHERE ur.auth_user_id = auth.uid()::TEXT::UUID
GROUP BY auth.uid()::TEXT, ur.masjid_id, m.masjid_name;

-- Step 3: Show created events
SELECT 
    'Created Events' as step,
    id,
    title,
    masjid_id::TEXT as masjid_id,
    created_by::TEXT as created_by,
    created_at
FROM events 
ORDER BY created_at DESC
LIMIT 5;

-- Step 4: Show complete user context
SELECT 
    'Complete User Context' as step,
    ur.id as user_role_id,
    ur.auth_user_id::TEXT as auth_user_id,
    ur.email,
    ur.role,
    m.id as masjid_id,
    m.masjid_name,
    m.created_by::TEXT as masjid_created_by
FROM user_roles ur
JOIN masjids m ON ur.masjid_id = m.id
WHERE ur.auth_user_id = COALESCE(NULLIF(auth.uid()::TEXT, 'postgres')::UUID, (SELECT id FROM masjids ORDER BY created_at DESC LIMIT 1))
LIMIT 1;
