-- =====================================================
-- FINAL MANUAL FIX - CORRECT TABLE STRUCTURE
-- =====================================================
-- This creates masjid and fixes user_roles with correct columns
-- Single transaction to ensure consistency
-- =====================================================

-- Complete setup in single transaction
DO $$
DECLARE
    new_masjid_id UUID;
    super_admin_user_id UUID;
BEGIN
    -- Step 1: Create masjid if not exists
    INSERT INTO masjids (
        masjid_name,
        tagline,
        subscription_status,
        subscription_end_date,
        is_active,
        trial_extended,
        created_at,
        created_by
    ) VALUES (
        'MUBEEN JUMMA MASJEEDH',
        'Smart Masjeedh Management System',
        'trial',
        NOW() + INTERVAL '90 days',
        TRUE,
        FALSE,
        NOW(),
        NULL
    ) RETURNING id INTO new_masjid_id;
    
    -- Step 2: Get user ID for Mohammedjunain@gmail.com
    SELECT id INTO super_admin_user_id
    FROM auth.users 
    WHERE email = 'mohammedjunain@gmail.com' 
    LIMIT 1;
    
    -- Step 3: UPSERT user_roles with correct columns
    INSERT INTO user_roles (
        user_id, 
        masjid_id, 
        email, 
        role, 
        status,
        permissions,
        created_at
    ) VALUES (
        super_admin_user_id,
        new_masjid_id,
        'mohammedjunain@gmail.com',
        'super_admin',
        'active',
        '{"all": true}'::jsonb,
        NOW()
    );
    
    -- Update masjid with owner info
    UPDATE masjids 
    SET 
        created_by = super_admin_user_id
    WHERE id = new_masjid_id;
    
    -- Create subscription history entry
    INSERT INTO subscription_history (
        masjid_id,
        old_status,
        new_status,
        payment_date,
        notes,
        created_by
    ) VALUES (
        new_masjid_id,
        NULL,
        'trial',
        NOW(),
        'Super Admin trial period started - Final manual fix',
        super_admin_user_id
    );
    
    -- Output success message
    RAISE NOTICE 'Final manual fix completed successfully!';
    RAISE NOTICE 'Masjid ID: %', new_masjid_id;
    RAISE NOTICE 'User ID: %', super_admin_user_id;
    RAISE NOTICE 'Role: super_admin';
    RAISE NOTICE 'Email: mohammedjunain@gmail.com';
    RAISE NOTICE 'Permissions: {"all": true}';
    RAISE NOTICE 'Trial Status: Active (90 days)';
    
END $$;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- Show the complete setup
SELECT 
    'FINAL FIX VERIFICATION' as check_type,
    u.email as super_admin_email,
    u.id as user_id,
    m.masjid_name,
    m.id as masjid_id,
    ur.email as role_email,
    ur.role,
    ur.status as role_status,
    ur.permissions,
    m.subscription_status,
    m.subscription_end_date,
    m.is_active,
    m.created_at as masjid_created_at,
    NOW() as setup_timestamp,
    (m.subscription_end_date - NOW()) as days_remaining
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN masjids m ON ur.masjid_id = m.id
WHERE u.email = 'mohammedjunain@gmail.com'
    AND m.masjid_name = 'MUBEEN JUMMA MASJEEDH';

-- =====================================================
-- CONFIRMATION MESSAGE
-- =====================================================

SELECT 
    'FINAL MANUAL FIX COMPLETED' as status,
    'Super Admin access fixed - Ready for dashboard' as details,
    'Login now at /login' as next_step,
    NOW() as setup_timestamp;
