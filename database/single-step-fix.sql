-- =====================================================
-- SINGLE STEP SUPER ADMIN FIX
-- =====================================================
-- This creates masjid, finds user, and links them in one block
-- =====================================================

-- Complete setup in single transaction
DO $$
DECLARE
    new_masjid_id UUID;
    super_admin_user_id UUID;
BEGIN
    -- Step 1: Insert new masjid record
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
    
    -- Step 2: Find user ID for Mohammedjunain@gmail.com
    SELECT id INTO super_admin_user_id
    FROM auth.users 
    WHERE email = 'mohammedjunain@gmail.com' 
    LIMIT 1;
    
    -- Step 3: Insert user_roles record linking user to masjid
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
        'Super Admin trial period started - Single step fix',
        super_admin_user_id
    );
    
    -- Output success message
    RAISE NOTICE 'Single step Super Admin fix completed!';
    RAISE NOTICE 'Masjid ID: %', new_masjid_id;
    RAISE NOTICE 'User ID: %', super_admin_user_id;
    RAISE NOTICE 'Role: super_admin';
    RAISE NOTICE 'Trial Status: Active (90 days)';
    
END $$;

-- =====================================================
-- VERIFICATION QUERY
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
-- CONFIRMATION MESSAGE
-- =====================================================

SELECT 
    'SINGLE STEP SUPER ADMIN FIX COMPLETED' as status,
    'Masjid created and Super Admin linked successfully' as details,
    'Ready for login' as next_step,
    NOW() as setup_timestamp;
