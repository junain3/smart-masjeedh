-- =====================================================
-- SIMPLE PRODUCTION RESET - NO SEQUENCE ASSUMPTIONS
-- =====================================================
-- This script clears ALL DATA without touching sequences
-- Much safer approach for unknown database state
-- =====================================================

-- Disable foreign key constraints temporarily
SET session_replication_role = replica;

-- =====================================================
-- 1. DELETE ALL DATA (safer than TRUNCATE)
-- =====================================================

-- Clear core tables (these should exist)
DELETE FROM masjids;
DELETE FROM families;
DELETE FROM user_roles;
DELETE FROM invitations;

-- Clear subscription tables (using DELETE with IF EXISTS logic)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_collections') THEN
        DELETE FROM subscription_collections;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'collector_commission_payments') THEN
        DELETE FROM collector_commission_payments;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_collector_profiles') THEN
        DELETE FROM subscription_collector_profiles;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_history') THEN
        DELETE FROM subscription_history;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'trial_extensions') THEN
        DELETE FROM trial_extensions;
    END IF;
END $$;

-- =====================================================
-- 2. RE-ENABLE FOREIGN KEY CONSTRAINTS
-- =====================================================

SET session_replication_role = DEFAULT;

-- =====================================================
-- 3. VERIFY RESET
-- =====================================================

-- Show table counts to verify reset
SELECT 
    'masjids' as table_name, 
    COALESCE(COUNT(*), 0) as record_count 
FROM masjids
UNION ALL
SELECT 
    'families' as table_name, 
    COALESCE(COUNT(*), 0) as record_count 
FROM families
UNION ALL
SELECT 
    'user_roles' as table_name, 
    COALESCE(COUNT(*), 0) as record_count 
FROM user_roles
UNION ALL
SELECT 
    'invitations' as table_name, 
    COALESCE(COUNT(*), 0) as record_count 
FROM invitations
UNION ALL
SELECT 
    'subscription_collections' as table_name, 
    COALESCE(COUNT(*), 0) as record_count 
FROM subscription_collections
UNION ALL
SELECT 
    'collector_commission_payments' as table_name, 
    COALESCE(COUNT(*), 0) as record_count 
FROM collector_commission_payments
UNION ALL
SELECT 
    'subscription_collector_profiles' as table_name, 
    COALESCE(COUNT(*), 0) as record_count 
FROM subscription_collector_profiles
UNION ALL
SELECT 
    'subscription_history' as table_name, 
    COALESCE(COUNT(*), 0) as record_count 
FROM subscription_history
UNION ALL
SELECT 
    'trial_extensions' as table_name, 
    COALESCE(COUNT(*), 0) as record_count 
FROM trial_extensions;

-- =====================================================
-- 4. CONFIRMATION MESSAGE
-- =====================================================

SELECT 'SIMPLE PRODUCTION RESET COMPLETED' as status,
       'All data cleared using DELETE (no sequence touching)' as details,
       NOW() as reset_timestamp;
