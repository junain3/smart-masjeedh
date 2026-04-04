-- =====================================================
-- FIXED PRODUCTION RESET - CORRECT POSTGRESQL SYNTAX
-- =====================================================
-- This script clears ALL DATA from existing tables only
-- Uses correct PostgreSQL syntax for TRUNCATE
-- =====================================================

-- Disable foreign key constraints temporarily
SET session_replication_role = replica;

-- =====================================================
-- 1. TRUNCATE EXISTING DATA TABLES
-- =====================================================

-- Clear core tables (these should exist)
TRUNCATE TABLE masjids CASCADE;
TRUNCATE TABLE families CASCADE;
TRUNCATE TABLE user_roles CASCADE;
TRUNCATE TABLE invitations CASCADE;

-- Clear subscription tables (these may or may not exist yet)
-- Note: We'll handle these with DO blocks to avoid errors

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_collections') THEN
        TRUNCATE TABLE subscription_collections CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'collector_commission_payments') THEN
        TRUNCATE TABLE collector_commission_payments CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_collector_profiles') THEN
        TRUNCATE TABLE subscription_collector_profiles CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_history') THEN
        TRUNCATE TABLE subscription_history CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'trial_extensions') THEN
        TRUNCATE TABLE trial_extensions CASCADE;
    END IF;
END $$;

-- =====================================================
-- 2. RESET AUTO-INCREMENT SEQUENCES
-- =====================================================

-- Reset sequences for existing tables
ALTER SEQUENCE masjids_id_seq RESTART WITH 1;
ALTER SEQUENCE families_id_seq RESTART WITH 1;
ALTER SEQUENCE user_roles_id_seq RESTART WITH 1;
ALTER SEQUENCE invitations_id_seq RESTART WITH 1;

-- Reset sequences for optional tables (using DO blocks)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'subscription_collections_id_seq') THEN
        ALTER SEQUENCE subscription_collections_id_seq RESTART WITH 1;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'collector_commission_payments_id_seq') THEN
        ALTER SEQUENCE collector_commission_payments_id_seq RESTART WITH 1;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'subscription_collector_profiles_id_seq') THEN
        ALTER SEQUENCE subscription_collector_profiles_id_seq RESTART WITH 1;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'subscription_history_id_seq') THEN
        ALTER SEQUENCE subscription_history_id_seq RESTART WITH 1;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'trial_extensions_id_seq') THEN
        ALTER SEQUENCE trial_extensions_id_seq RESTART WITH 1;
    END IF;
END $$;

-- Reset UUID sequences if they exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'masjids_id_seq') THEN
        PERFORM setval('masjids_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'families_id_seq') THEN
        PERFORM setval('families_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'user_roles_id_seq') THEN
        PERFORM setval('user_roles_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'invitations_id_seq') THEN
        PERFORM setval('invitations_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'subscription_collections_id_seq') THEN
        PERFORM setval('subscription_collections_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'collector_commission_payments_id_seq') THEN
        PERFORM setval('collector_commission_payments_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'subscription_collector_profiles_id_seq') THEN
        PERFORM setval('subscription_collector_profiles_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'subscription_history_id_seq') THEN
        PERFORM setval('subscription_history_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'trial_extensions_id_seq') THEN
        PERFORM setval('trial_extensions_id_seq', 1, false);
    END IF;
END $$;

-- =====================================================
-- 3. RE-ENABLE FOREIGN KEY CONSTRAINTS
-- =====================================================

SET session_replication_role = DEFAULT;

-- =====================================================
-- 4. VERIFY RESET
-- =====================================================

-- Show table counts to verify reset (only existing tables)
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
-- 5. CONFIRMATION MESSAGE
-- =====================================================

SELECT 'FIXED PRODUCTION RESET COMPLETED' as status,
       'All existing data cleared, sequences reset' as details,
       NOW() as reset_timestamp;
