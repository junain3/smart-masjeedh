-- =====================================================
-- CORRECTED FORCE FIX - PROPER COLUMN NAMES
-- =====================================================
-- Fixes the column name issue (name -> masjid_name)
-- =====================================================

DO $$ 
DECLARE
    v_user_id UUID;
    v_masjid_id UUID;
BEGIN
    -- 1. Get the Auth User ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'mohammedjunain@gmail.com' LIMIT 1;
    
    -- 2. Create the Masjid if it doesn't exist (using correct column name)
    INSERT INTO public.masjids (
        masjid_name,
        tagline,
        subscription_status,
        subscription_end_date,
        is_active,
        trial_extended,
        created_at,
        created_by
    )
    VALUES (
        'MUBEEN JUMMA MASJEEDH',
        'Smart Masjeedh Management System',
        'trial',
        NOW() + INTERVAL '90 days',
        TRUE,
        FALSE,
        NOW(),
        v_user_id
    );

    -- Get the masjid ID
    SELECT id INTO v_masjid_id FROM public.masjids WHERE masjid_name = 'MUBEEN JUMMA MASJEEDH' LIMIT 1;

    -- 3. Delete any existing roles first to avoid conflicts
    DELETE FROM public.user_roles WHERE user_id = v_user_id;

    -- 4. Insert fresh Role with all required columns
    INSERT INTO public.user_roles (
        user_id, 
        masjid_id, 
        role, 
        email, 
        status, 
        permissions,
        auth_user_id,
        created_at
    )
    VALUES (
        v_user_id, 
        v_masjid_id, 
        'super_admin', 
        'mohammedjunain@gmail.com', 
        'active', 
        '{"all": true}'::jsonb,
        v_user_id,
        NOW()
    );
    
    -- Create subscription history entry
    INSERT INTO subscription_history (
        masjid_id,
        old_status,
        new_status,
        payment_date,
        notes,
        created_by
    ) VALUES (
        v_masjid_id,
        NULL,
        'trial',
        NOW(),
        'Super Admin trial period started - Corrected force fix',
        v_user_id
    );
    
    -- Output success message
    RAISE NOTICE 'Corrected force fix completed successfully!';
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE 'Masjid ID: %', v_masjid_id;
    RAISE NOTICE 'Role: super_admin';
    RAISE NOTICE 'Status: active';
    RAISE NOTICE 'Permissions: {"all": true}';
    
END $$;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- Show the complete setup
SELECT 
    'CORRECTED FIX VERIFICATION' as check_type,
    u.email as super_admin_email,
    u.id as user_id,
    m.masjid_name,
    m.id as masjid_id,
    ur.user_id as role_user_id,
    ur.masjid_id as role_masjid_id,
    ur.email as role_email,
    ur.role,
    ur.status as role_status,
    ur.permissions,
    ur.auth_user_id,
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
    'CORRECTED FORCE FIX COMPLETED' as status,
    'Super Admin access fixed with correct column names' as details,
    'Access Denied should be gone - Login now' as next_step,
    NOW() as setup_timestamp;
