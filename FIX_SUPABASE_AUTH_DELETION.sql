-- Fix Supabase Auth Dashboard User Deletion with Role-Based Cascading
-- This script sets up proper foreign key constraints to support:
-- 1. Masjid Creator deletion: cascade delete entire masjid
-- 2. Invited Member deletion: selective deletion only

-- ============================================
-- Step 1: Check existing foreign key constraints
-- ============================================

-- View all foreign key constraints
SELECT
    tc.table_name,
    tc.constraint_name,
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

-- ============================================
-- Step 2: Drop existing constraints that block deletion
-- ============================================

-- Drop user_roles foreign keys that reference auth.users
DO $$
BEGIN
    -- Drop any auth_user_id foreign key constraints
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'user_roles'
        AND constraint_name LIKE '%auth_user%'
    ) THEN
        ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_auth_user_id_fkey;
        RAISE NOTICE 'Dropped auth_user_id foreign key constraints';
    END IF;
END $$;

-- ============================================
-- Step 3: Make auth_user_id nullable in user_roles
-- ============================================

-- This allows the record to exist even if the auth user is deleted
ALTER TABLE public.user_roles ALTER COLUMN auth_user_id DROP NOT NULL;

-- ============================================
-- Step 4: Set up proper foreign key constraints
-- ============================================

-- user_roles -> masjids: NO CASCADE (API handles deletion logic)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'user_roles'
        AND constraint_name = 'user_roles_masjid_id_fkey'
    ) THEN
        ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_masjid_id_fkey;
        RAISE NOTICE 'Dropped existing user_roles_masjid_id_fkey';
    END IF;
    
    -- Recreate without CASCADE - API handles deletion logic
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_masjid_id_fkey
    FOREIGN KEY (masjid_id)
    REFERENCES public.masjids(id)
    ON DELETE RESTRICT;  -- Prevent accidental deletion via database
    RAISE NOTICE 'Recreated user_roles_masjid_id_fkey with ON DELETE RESTRICT';
END $$;

-- ============================================
-- Step 5: Create cleanup function for orphaned records
-- ============================================

-- This function cleans up records when users are deleted from Auth Dashboard
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_auth_users()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update user_roles to set auth_user_id to NULL if the auth user no longer exists
    UPDATE public.user_roles
    SET auth_user_id = NULL
    WHERE auth_user_id IS NOT NULL
    AND auth_user_id NOT IN (SELECT id FROM auth.users);
    
    RAISE NOTICE 'Cleaned up orphaned auth_user_id references in user_roles';
    
    -- Delete user_roles that have no auth_user_id and no user_id (completely orphaned)
    DELETE FROM public.user_roles
    WHERE auth_user_id IS NULL AND user_id IS NULL;
    
    RAISE NOTICE 'Deleted completely orphaned user_roles';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_auth_users() TO service_role;

-- ============================================
-- Step 6: Verification
-- ============================================

-- Verify no foreign keys reference auth schema (should return 0 rows)
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND ccu.table_schema = 'auth';

-- ============================================
-- Step 7: Manual cleanup (run once)
-- ============================================

-- Clean up any existing orphaned records
SELECT public.cleanup_orphaned_auth_users();

-- ============================================
-- Important Notes
-- ============================================

-- 1. Database constraints do NOT cascade delete (API handles logic)
-- 2. Masjid Creator deletion: API deletes entire masjid + all user_roles + auth user
-- 3. Invited Member deletion: API deletes only their user_roles entry + auth user
-- 4. Auth Dashboard deletion: auth_user_id set to NULL, cleanup function handles orphans
-- 5. Run cleanup_orphaned_auth_users() periodically to clean up orphaned records
-- 6. Your API route (app/api/user/delete-account/route.ts) implements the deletion logic
