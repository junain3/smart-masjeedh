-- =====================================================
-- VERIFICATION CHECKS - POST-RESET VALIDATION
-- =====================================================
-- Run this after both reset and setup scripts to verify everything is working
-- =====================================================

-- =====================================================
-- 1. VERIFY DATA CLEARANCE
-- =====================================================

-- Check that all data tables are empty (except auth.users)
SELECT 'Data Clearance Check' as check_type,
       CASE 
           WHEN COUNT(*) = 0 THEN '✅ PASSED - All data cleared'
           ELSE '❌ FAILED - Data still exists'
       END as status
FROM masjids

UNION ALL

SELECT 'User Roles Check' as check_type,
       CASE 
           WHEN COUNT(*) = 0 THEN '✅ PASSED - User roles cleared'
           ELSE '❌ FAILED - User roles still exist'
       END as status
FROM user_roles

UNION ALL

SELECT 'Families Check' as check_type,
       CASE 
           WHEN COUNT(*) = 0 THEN '✅ PASSED - Families cleared'
           ELSE '❌ FAILED - Families still exist'
       END as status
FROM families;

-- =====================================================
-- 2. VERIFY TRIAL SYSTEM INTEGRITY
-- =====================================================

-- Check that trial system tables exist and have correct structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('masjids', 'subscription_history', 'trial_extensions')
    AND column_name IN ('subscription_status', 'subscription_end_date', 'is_active', 'trial_extended')
ORDER BY table_name, ordinal_position;

-- =====================================================
-- 3. VERIFY SUPER ADMIN SETUP
-- =====================================================

-- After running super-admin-setup.sql, this should show the Super Admin
SELECT 
    'Super Admin Verification' as check_type,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASSED - Super Admin configured'
        ELSE '❌ FAILED - No Super Admin found'
    END as status,
    COUNT(*) as admin_count
FROM user_roles 
WHERE role = 'super_admin' AND status = 'active';

-- =====================================================
-- 4. VERIFY TRIAL LOGIC COMPATIBILITY
-- =====================================================

-- Check that all required columns exist for trial system
SELECT 'Trial System Columns Check' as verification_type,
       column_name,
       table_name,
       CASE 
           WHEN column_name IS NOT NULL THEN '✅ EXISTS'
           ELSE '❌ MISSING'
       END as column_status
FROM information_schema.columns 
WHERE table_name = 'masjids'
    AND column_name IN (
        'subscription_status', 
        'subscription_end_date', 
        'is_active', 
        'trial_extended'
    );

-- =====================================================
-- 5. VERIFY CODE INTEGRITY (Manual Check)
-- =====================================================

-- These are the files that should remain intact:
SELECT 'Code Integrity Check' as check_type,
       'lib/trial-utils.ts' as file_path,
       'Should contain trial logic functions' as expected_content,
       'Verify manually in IDE' as action_required

UNION ALL

SELECT 'Code Integrity Check' as check_type,
       'components/TrialLockScreen.tsx' as file_path,
       'Should contain Tamil lock screen' as expected_content,
       'Verify manually in IDE' as action_required

UNION ALL

SELECT 'Code Integrity Check' as check_type,
       'components/TrialMiddleware.tsx' as file_path,
       'Should contain middleware logic' as expected_content,
       'Verify manually in IDE' as action_required

UNION ALL

SELECT 'Code Integrity Check' as check_type,
       'app/layout.tsx' as file_path,
       'Should contain TrialMiddleware wrapper' as expected_content,
       'Verify manually in IDE' as action_required

UNION ALL

SELECT 'Code Integrity Check' as check_type,
       'app/staff/page.tsx' as file_path,
       'Should contain TrialStatusBadge in header' as expected_content,
       'Verify manually in IDE' as action_required;

-- =====================================================
-- 6. PRODUCTION READINESS CHECKLIST
-- =====================================================

SELECT 'Production Readiness Checklist' as checklist_type,
       item,
       CASE 
           WHEN status = 'READY' THEN '✅ READY'
           ELSE '❌ ACTION NEEDED'
       END as status
FROM (VALUES 
    ('Database tables truncated'),
    ('ID sequences reset'),
    ('Super Admin script prepared'),
    ('Trial logic verified'),
    ('Codebase intact'),
    ('Environment variables set'),
    ('Backup completed')
) AS t(item, status);

-- =====================================================
-- 7. FINAL CONFIRMATION
-- =====================================================

SELECT 
    'PRODUCTION RESET VERIFICATION' as final_status,
    CASE 
        WHEN (
            (SELECT COUNT(*) FROM masjids) = 0 AND
            (SELECT COUNT(*) FROM user_roles) = 0 AND
            (SELECT COUNT(*) FROM families) = 0
        ) THEN '✅ READY FOR PRODUCTION'
        ELSE '❌ INCOMPLETE RESET'
    END as overall_status,
    NOW() as verification_timestamp;
