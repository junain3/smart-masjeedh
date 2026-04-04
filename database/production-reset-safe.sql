-- =====================================================
-- SAFE PRODUCTION RESET - EXISTING TABLES ONLY
-- =====================================================
-- This script clears ALL DATA from existing tables only
-- Run this FIRST before creating new tables
-- =====================================================

-- Disable foreign key constraints temporarily
SET session_replication_role = replica;

-- =====================================================
-- 1. TRUNCATE EXISTING DATA TABLES ONLY
-- =====================================================

-- Clear core tables (these should exist)
TRUNCATE TABLE IF EXISTS masjids CASCADE;
TRUNCATE TABLE IF EXISTS families CASCADE;
TRUNCATE TABLE IF EXISTS user_roles CASCADE;
TRUNCATE TABLE IF EXISTS invitations CASCADE;

-- Clear subscription tables (these may or may not exist yet)
TRUNCATE TABLE IF EXISTS subscription_collections CASCADE;
TRUNCATE TABLE IF EXISTS collector_commission_payments CASCADE;
TRUNCATE TABLE IF EXISTS subscription_collector_profiles CASCADE;

-- Clear trial system tables (these may not exist yet)
TRUNCATE TABLE IF EXISTS subscription_history CASCADE;
TRUNCATE TABLE IF EXISTS trial_extensions CASCADE;

-- =====================================================
-- 2. RESET AUTO-INCREMENT SEQUENCES (for existing tables)
-- =====================================================

-- Reset sequences for existing tables
ALTER SEQUENCE IF EXISTS masjids_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS families_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS user_roles_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS invitations_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS subscription_collections_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS collector_commission_payments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS subscription_collector_profiles_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS subscription_history_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS trial_extensions_id_seq RESTART WITH 1;

-- Reset UUID sequences if they exist
SELECT setval('masjids_id_seq', 1, false);
SELECT setval('families_id_seq', 1, false);
SELECT setval('user_roles_id_seq', 1, false);
SELECT setval('invitations_id_seq', 1, false);
SELECT setval('subscription_collections_id_seq', 1, false);
SELECT setval('collector_commission_payments_id_seq', 1, false);
SELECT setval('subscription_collector_profiles_id_seq', 1, false);
SELECT setval('subscription_history_id_seq', 1, false);
SELECT setval('trial_extensions_id_seq', 1, false);

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

SELECT 'SAFE PRODUCTION RESET COMPLETED' as status,
       'All existing data cleared, sequences reset' as details,
       NOW() as reset_timestamp;
