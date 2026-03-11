-- DEEP EVENTS FIX - Handle All Dependencies
-- Complete solution with event_attendance

-- Step 1: Check current user context first
SELECT 
    'Current Context' as step,
    auth.uid()::TEXT as current_uid,
    CASE 
        WHEN auth.uid()::TEXT LIKE '%-%-%-%-%' THEN 'Authenticated'
        ELSE 'Not Authenticated'
    END as auth_status;

-- Step 2: Check user's masjid context
SELECT 
    'User Masjid Context' as step,
    ur.masjid_id::TEXT as masjid_id,
    m.masjid_name,
    ur.role
FROM user_roles ur
JOIN masjids m ON ur.masjid_id = m.id
WHERE ur.auth_user_id = COALESCE(NULLIF(auth.uid()::TEXT, 'postgres')::UUID, (SELECT id FROM masjids ORDER BY created_at DESC LIMIT 1))
LIMIT 1;

-- Step 3: Create user context if missing (simplified)
DO $$
DECLARE
    user_id TEXT := auth.uid()::TEXT;
    user_uuid UUID;
    masjid_id UUID;
BEGIN
    -- Only proceed if user is authenticated
    IF user_id LIKE '%-%-%-%-%' THEN
        user_uuid := user_id::UUID;
        
        -- Get user's masjid_id
        SELECT ur.masjid_id INTO masjid_id
        FROM user_roles ur
        WHERE ur.auth_user_id = user_uuid
        LIMIT 1;
        
        -- If no user_roles, get from masjids
        IF masjid_id IS NULL THEN
            SELECT id INTO masjid_id
            FROM masjids 
            WHERE created_by = user_uuid 
            LIMIT 1;
            
            -- Create user_roles if missing
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
                    '{"accounts": true, "events": true, "members": true}',
                    true
                ) ON CONFLICT (masjid_id, user_id) DO NOTHING;
                
                RAISE NOTICE 'User context created: %', masjid_id;
            END IF;
        END IF;
        
        -- Create test event if we have masjid_id
        IF masjid_id IS NOT NULL THEN
            -- Check if events table exists and has proper structure
            PERFORM 1 FROM information_schema.tables WHERE table_name = 'events';
            
            IF FOUND THEN
                -- Check if events has required columns
                PERFORM 1 FROM information_schema.columns 
                WHERE table_name = 'events' AND column_name = 'title';
                
                IF FOUND THEN
                    -- Insert test event with proper masjid_id
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
                RAISE NOTICE 'Events table does not exist';
            END IF;
        ELSE
            RAISE NOTICE 'No masjid context found for user: %', user_id;
        END IF;
    ELSE
        RAISE NOTICE 'User not authenticated: %', user_id;
    END IF;
END $$;

-- Step 4: Show created events
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

-- Step 5: Show event_attendance if exists
SELECT 
    'Event Attendance' as step,
    COUNT(*) as total_records
FROM event_attendance;

-- Step 6: Final verification
SELECT 
    'Final Verification' as step,
    auth.uid()::TEXT as current_uid,
    ur.masjid_id::TEXT as masjid_id,
    m.masjid_name,
    COUNT(e.id) as event_count
FROM user_roles ur
JOIN masjids m ON ur.masjid_id = m.id
LEFT JOIN events e ON e.masjid_id = ur.masjid_id
WHERE ur.auth_user_id = COALESCE(NULLIF(auth.uid()::TEXT, 'postgres')::UUID, (SELECT id FROM masjids ORDER BY created_at DESC LIMIT 1))
GROUP BY auth.uid()::TEXT, ur.masjid_id, m.masjid_name;
