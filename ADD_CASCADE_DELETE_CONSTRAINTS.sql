-- Add ON DELETE CASCADE to foreign key constraints
-- This script updates foreign key constraints to automatically delete related records
-- when a parent record (masjid or user) is deleted

-- ============================================
-- Step 1: Drop existing foreign key constraints
-- ============================================

-- Drop user_roles -> masjids foreign key
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_masjid_id_fkey;

-- Drop any other tables that reference masjids
-- (Add more as needed based on your schema)

-- Drop any tables that reference user_roles
-- (Add more as needed based on your schema)

-- ============================================
-- Step 2: Recreate foreign keys with ON DELETE CASCADE
-- ============================================

-- user_roles -> masjids: When masjid is deleted, delete all user_roles for that masjid
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_masjid_id_fkey
FOREIGN KEY (masjid_id)
REFERENCES public.masjids(id)
ON DELETE CASCADE;

-- ============================================
-- Additional common foreign keys (uncomment if these tables exist)
-- ============================================

-- Example: If you have a members table referencing masjids
-- ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_masjid_id_fkey;
-- ALTER TABLE public.members
-- ADD CONSTRAINT members_masjid_id_fkey
-- FOREIGN KEY (masjid_id)
-- REFERENCES public.masjids(id)
-- ON DELETE CASCADE;

-- Example: If you have an events table referencing masjids
-- ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_masjid_id_fkey;
-- ALTER TABLE public.events
-- ADD CONSTRAINT events_masjid_id_fkey
-- FOREIGN KEY (masjid_id)
-- REFERENCES public.masjids(id)
-- ON DELETE CASCADE;

-- Example: If you have a subscriptions table referencing masjids
-- ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_masjid_id_fkey;
-- ALTER TABLE public.subscriptions
-- ADD CONSTRAINT subscriptions_masjid_id_fkey
-- FOREIGN KEY (masjid_id)
-- REFERENCES public.masjids(id)
-- ON DELETE CASCADE;

-- ============================================
-- Verification Query
-- ============================================

-- Run this to verify the constraints were added correctly
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;
