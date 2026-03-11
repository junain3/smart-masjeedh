-- FINAL EVENTS FIX - Text Casting Approach
-- Fix all type casting issues with proper method

-- Step 1: Simple User Context Check (Fixed with TEXT)
SELECT 
    auth.uid()::TEXT as current_user_id,
    ur.masjid_id as user_masjid_id,
    m.masjid_name
FROM user_roles ur
JOIN masjids m ON ur.masjid_id = m.id
WHERE ur.auth_user_id = auth.uid()::TEXT::UUID
LIMIT 1;

-- Step 2: Simple Context Fix (Fixed with TEXT casting)
DO $$
DECLARE
    user_masjid_id UUID;
    current_user TEXT := auth.uid()::TEXT;
BEGIN
    -- Get user's masjid_id
    SELECT masjid_id INTO user_masjid_id
    FROM user_roles 
    WHERE auth_user_id = current_user::UUID 
    LIMIT 1;
    
    -- If no masjid_id, get from masjids table
    IF user_masjid_id IS NULL THEN
        SELECT id INTO user_masjid_id
        FROM masjids 
        WHERE created_by = current_user::UUID 
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
                current_user::UUID,
                current_user::UUID,
                (SELECT email FROM auth.users WHERE id = current_user::UUID),
                'super_admin',
                '{"accounts": true, "events": true, "members": true}',
                true
            );
            
            RAISE NOTICE 'User context created: %', user_masjid_id;
        END IF;
    END IF;
END $$;

-- Step 3: Verify Context After Fix
SELECT 
    auth.uid()::TEXT as current_user_id,
    ur.masjid_id as user_masjid_id,
    m.masjid_name
FROM user_roles ur
JOIN masjids m ON ur.masjid_id = m.id
WHERE ur.auth_user_id = auth.uid()::TEXT::UUID
LIMIT 1;

-- Step 4: Test Event Creation (Fixed with TEXT)
DO $$
DECLARE
    user_masjid_id UUID;
    current_user TEXT := auth.uid()::TEXT;
BEGIN
    -- Get user's masjid_id
    SELECT masjid_id INTO user_masjid_id
    FROM user_roles 
    WHERE auth_user_id = current_user::UUID 
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
            current_user::UUID
        );
        
        RAISE NOTICE 'Test event created successfully with masjid_id: %', user_masjid_id;
    ELSE
        RAISE NOTICE 'Cannot create event - no masjid context';
    END IF;
END $$;

-- Step 5: Show Created Events
SELECT id, title, masjid_id, created_by, created_at 
FROM events 
ORDER BY created_at DESC 
LIMIT 3;
