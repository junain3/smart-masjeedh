-- =====================================================
-- MANUAL MASJID CREATION & SUPER ADMIN LINK
-- =====================================================
-- This script creates the masjid record and links Super Admin
-- Run this to bypass registration and login directly
-- =====================================================

-- =====================================================
-- 1. CREATE MASJID RECORD FOR MUBEEN JUMMA MASJEEDH
-- =====================================================

-- Insert the masjid record
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
) RETURNING id;

-- =====================================================
-- 2. GET THE NEW MASJID AND USER ID
-- =====================================================

-- Store the new masjid ID and user ID
DO $$
DECLARE
    new_masjid_id UUID;
    super_admin_user_id UUID;
BEGIN
    -- Get the newly created masjid ID
    SELECT id INTO new_masjid_id
    FROM masjids 
    WHERE masjid_name = 'MUBEEN JUMMA MASJEEDH'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Get Super Admin user ID
    SELECT id INTO super_admin_user_id
    FROM auth.users 
    WHERE email = 'mohammedjunain@gmail.com' 
    LIMIT 1;
    
    -- =====================================================
    -- 3. CREATE USER ROLE LINK
    -- =====================================================
    
    -- Link Super Admin to masjid
    INSERT INTO user_roles (
        user_id, 
        masjid_id, 
        role, 
        status,
        created_at
    ) VALUES (
        super_admin_user_id,
        new_masjid_id,
        'super_admin',
        'active',
        NOW()
    ) ON CONFLICT (user_id, masjid_id) DO UPDATE SET
        role = 'super_admin',
        status = 'active',
        updated_at = NOW();
    
    -- Update masjid with owner info
    UPDATE masjids 
    SET 
        created_by = super_admin_user_id
    WHERE id = new_masjid_id;
    
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
        new_masjid_id,
        NULL,
        'trial',
        NOW(),
        'Super Admin trial period started - Manual setup',
        super_admin_user_id
    );
    
    -- =====================================================
    -- 5. VERIFICATION OUTPUT
    -- =====================================================
    
    RAISE NOTICE 'Manual masjid creation completed successfully!';
    RAISE NOTICE 'Masjid ID: %', new_masjid_id;
    RAISE NOTICE 'User ID: %', super_admin_user_id;
    RAISE NOTICE 'Role: super_admin';
    RAISE NOTICE 'Trial Status: Active (90 days)';
    RAISE NOTICE 'Trial End Date: %', NOW() + INTERVAL '90 days';
    
END $$;

-- =====================================================
-- 6. FINAL VERIFICATION QUERY
-- =====================================================

-- Show the complete setup details
SELECT 
    u.email as super_admin_email,
    u.id as user_id,
    m.masjid_name,
    m.id as masjid_id,
    ur.role,
    ur.status as role_status,
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
-- 7. CONFIRMATION MESSAGE
-- =====================================================

SELECT 
    'MANUAL MASJID SETUP COMPLETED' as status,
    'MUBEEN JUMMA MASJEEDH created and Super Admin linked' as details,
    'Ready for direct login' as next_step,
    NOW() as setup_timestamp;
