-- =====================================================
-- SUPER ADMIN SETUP SCRIPT
-- =====================================================
-- Run this AFTER signing up with Mohammedjunain@gmail.com
-- This script assigns Super Admin role and links to first masjid
-- =====================================================

-- 1. FIND THE NEW USER ID AND MASJID
-- =====================================================

-- Get the user ID for Mohammedjunain@gmail.com
DO $$
DECLARE
    super_admin_user_id UUID;
    first_masjid_id UUID;
BEGIN
    -- Find the user ID for Mohammedjunain@gmail.com
    SELECT id INTO super_admin_user_id
    FROM auth.users 
    WHERE email = 'mohammedjunain@gmail.com' 
    LIMIT 1;
    
    IF super_admin_user_id IS NULL THEN
        RAISE EXCEPTION 'User Mohammedjunain@gmail.com not found. Please sign up first.';
    END IF;
    
    -- Get the first (and only) masjid ID
    SELECT id INTO first_masjid_id
    FROM masjids 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF first_masjid_id IS NULL THEN
        RAISE EXCEPTION 'No masjid found. Please create a masjid first.';
    END IF;
    
    -- =====================================================
    -- 2. CREATE SUPER ADMIN USER ROLE
    -- =====================================================
    
    -- Insert user_roles entry for Super Admin
    INSERT INTO user_roles (
        user_id, 
        masjid_id, 
        role, 
        status,
        created_at
    ) VALUES (
        super_admin_user_id,
        first_masjid_id,
        'super_admin',
        'active',
        NOW()
    ) ON CONFLICT (user_id, masjid_id) DO UPDATE SET
        role = 'super_admin',
        status = 'active',
        updated_at = NOW();
    
    -- =====================================================
    -- 3. UPDATE MASJID WITH SUPER ADMIN INFO
    -- =====================================================
    
    -- Update masjid to show it's owned by Super Admin
    UPDATE masjids 
    SET 
        created_by = super_admin_user_id,
        subscription_status = 'trial',
        is_active = true
    WHERE id = first_masjid_id;
    
    -- =====================================================
    -- 4. CREATE SUBSCRIPTION HISTORY ENTRY
    -- =====================================================
    
    -- Log the trial start
    INSERT INTO subscription_history (
        masjid_id,
        old_status,
        new_status,
        payment_date,
        notes,
        created_by
    ) VALUES (
        first_masjid_id,
        NULL,
        'trial',
        NOW(),
        'Super Admin trial period started',
        super_admin_user_id
    );
    
    -- =====================================================
    -- 5. VERIFICATION OUTPUT
    -- =====================================================
    
    RAISE NOTICE 'Super Admin setup completed successfully!';
    RAISE NOTICE 'User ID: %', super_admin_user_id;
    RAISE NOTICE 'Masjid ID: %', first_masjid_id;
    RAISE NOTICE 'Role: super_admin';
    RAISE NOTICE 'Trial Status: Active (90 days)';
    
END $$;

-- =====================================================
-- 6. VERIFICATION QUERY
-- =====================================================

-- Show the Super Admin setup details
SELECT 
    u.email as super_admin_email,
    u.id as user_id,
    m.masjid_name,
    m.id as masjid_id,
    ur.role,
    ur.status as role_status,
    m.subscription_status,
    m.created_at as masjid_created_at,
    NOW() as setup_timestamp
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN masjids m ON ur.masjid_id = m.id
WHERE u.email = 'mohammedjunain@gmail.com';

-- =====================================================
-- 7. CONFIRMATION MESSAGE
-- =====================================================

SELECT 
    'SUPER ADMIN SETUP COMPLETED' as status,
    'Mohammedjunain@gmail.com is now Super Admin' as details,
    'Ready for production use' as next_step,
    NOW() as setup_timestamp;
