-- QUICK EVENTS FIX - Type Casting Corrected
-- Fix all type casting issues

-- Step 1: Simple User Context Check (Fixed)
SELECT 
    auth.uid() as current_user_id,
    ur.masjid_id as user_masjid_id,
    m.masjid_name
FROM user_roles ur
JOIN masjids m ON ur.masjid_id = m.id
WHERE ur.auth_user_id = auth.uid()::UUID
LIMIT 1;

-- Step 2: Simple Context Fix (Fixed Type Casting)
DO $$
DECLARE
    user_masjid_id UUID;
    current_user UUID := auth.uid()::UUID;
BEGIN
    -- Get user's masjid_id
    SELECT masjid_id INTO user_masjid_id
    FROM user_roles 
    WHERE auth_user_id = current_user 
    LIMIT 1;
    
    -- If no masjid_id, get from masjids table
    IF user_masjid_id IS NULL THEN
        SELECT id INTO user_masjid_id
        FROM masjids 
        WHERE created_by = current_user 
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
                current_user,
                current_user,
                (SELECT email FROM auth.users WHERE id = current_user),
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
    auth.uid() as current_user_id,
    ur.masjid_id as user_masjid_id,
    m.masjid_name
FROM user_roles ur
JOIN masjids m ON ur.masjid_id = m.id
WHERE ur.auth_user_id = auth.uid()::UUID
LIMIT 1;

-- Step 4: Test Event Creation (Fixed)
DO $$
DECLARE
    user_masjid_id UUID;
    current_user UUID := auth.uid()::UUID;
BEGIN
    -- Get user's masjid_id
    SELECT masjid_id INTO user_masjid_id
    FROM user_roles 
    WHERE auth_user_id = current_user 
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
            current_user
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
