-- FIX AUTHENTICATION CONTEXT
-- Ensure proper user authentication

-- Step 1: Check if we need to authenticate properly
-- This should be run from the browser, not SQL Editor
-- But let's create a proper fix for when authenticated

-- Step 2: Create a safer event creation that handles auth context
DO $$
DECLARE
    user_masjid_id UUID;
    auth_user_id TEXT;
    is_authenticated BOOLEAN := FALSE;
BEGIN
    -- Check if user is properly authenticated
    auth_user_id := auth.uid()::TEXT;
    
    -- Validate if it's a real UUID (contains dashes)
    IF auth_user_id LIKE '%-%-%-%-%' THEN
        is_authenticated := TRUE;
        
        -- Get user's masjid_id
        SELECT masjid_id INTO user_masjid_id
        FROM user_roles 
        WHERE auth_user_id = auth_user_id::UUID 
        LIMIT 1;
        
        -- If no masjid_id, get from masjids table
        IF user_masjid_id IS NULL THEN
            SELECT id INTO user_masjid_id
            FROM masjids 
            WHERE created_by = auth_user_id::UUID 
            LIMIT 1;
            
            -- Create user_roles if missing
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
                    auth_user_id::UUID,
                    auth_user_id::UUID,
                    (SELECT email FROM auth.users WHERE id = auth_user_id::UUID),
                    'super_admin',
                    '{"accounts": true, "events": true, "members": true}',
                    true
                );
                
                RAISE NOTICE 'User context created: %', user_masjid_id;
            END IF;
        END IF;
        
        -- Test event insertion only if authenticated
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
                auth_user_id::UUID
            );
            
            RAISE NOTICE 'Test event created successfully with masjid_id: %', user_masjid_id;
        ELSE
            RAISE NOTICE 'Cannot create event - no masjid context';
        END IF;
        
    ELSE
        RAISE NOTICE 'User not properly authenticated. Current uid: %', auth_user_id;
        RAISE NOTICE 'Please authenticate through the browser, not SQL Editor.';
    END IF;
END $$;

-- Step 3: Show current status
SELECT 
    auth.uid()::TEXT as current_user_id,
    CASE 
        WHEN auth.uid()::TEXT LIKE '%-%-%-%-%' THEN 'Authenticated'
        ELSE 'Not Authenticated'
    END as auth_status;

-- Step 4: Show events if any
SELECT id, title, masjid_id, created_by, created_at 
FROM events 
ORDER BY created_at DESC 
LIMIT 3;
