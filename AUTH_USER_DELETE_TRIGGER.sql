-- PostgreSQL Function for auth.users Deletion Cleanup
-- NOTE: Supabase does not allow creating triggers directly on auth.users schema
-- This script creates a function that can be called manually or via API
-- to clean up related data when a user is deleted

-- ============================================
-- Step 1: Create the cleanup function in public schema
-- ============================================

-- Enable the necessary extension for UUID handling (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the function that can be called to clean up user data
CREATE OR REPLACE FUNCTION public.handle_user_deletion_cleanup(user_id uuid, user_email text)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Log the deletion
    RAISE NOTICE 'Cleaning up user data for auth user ID: %, email: %', user_id, user_email;
    
    -- Step 1: Find and delete user_roles records for this user
    -- Check both auth_user_id and user_id columns
    DELETE FROM public.user_roles
    WHERE auth_user_id = user_id OR user_id = user_id;
    
    RAISE NOTICE 'Deleted user_roles for auth user ID: %', user_id;
    
    -- Step 2: Check if the masjid has any remaining users
    -- If the user was the only user for a masjid, delete the masjid too
    -- This prevents orphaned masjids
    
    -- Get masjid_ids that had this user (before deletion)
    WITH affected_masjids AS (
        SELECT DISTINCT masjid_id
        FROM public.user_roles
        WHERE auth_user_id = user_id OR user_id = user_id
    )
    
    -- Delete masjids that have no remaining users
    DELETE FROM public.masjids
    WHERE id IN (SELECT masjid_id FROM affected_masjids)
    AND NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.masjid_id = masjids.id
    );
    
    RAISE NOTICE 'Deleted orphaned masjids for auth user ID: %', user_id;
    
    -- Step 3: Delete any other related records
    -- Add more tables as needed based on your schema
    
    -- Example: Delete from email_verifications if email matches
    DELETE FROM public.email_verifications
    WHERE email = user_email;
    
    RAISE NOTICE 'Deleted email_verifications for email: %', user_email;
    
END;
$$;

-- ============================================
-- Step 2: Grant necessary permissions
-- ============================================

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_user_deletion_cleanup(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_user_deletion_cleanup(uuid, text) TO service_role;

-- ============================================
-- Step 3: Create a wrapper API endpoint (manual)
-- ============================================

-- Since we cannot create triggers on auth.users, you need to:
-- 1. Call this function from your API route when deleting a user
-- 2. Or use Supabase Database Webhooks (if available in your plan)
-- 3. Or create a scheduled job to clean up orphaned records

-- Example usage in your API:
-- SELECT public.handle_user_deletion_cleanup('user-uuid-here', 'user@example.com');

-- ============================================
-- Verification Query
-- ============================================

-- Run this to verify the function was created successfully
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'handle_user_deletion_cleanup';

-- ============================================
-- Alternative: Scheduled Cleanup Job
-- ============================================

-- Create a function to clean up orphaned records periodically
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_records()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Delete user_roles for users that no longer exist in auth.users
    DELETE FROM public.user_roles
    WHERE (auth_user_id NOT IN (SELECT id FROM auth.users)
           OR user_id NOT IN (SELECT id FROM auth.users))
    AND (auth_user_id IS NOT NULL OR user_id IS NOT NULL);
    
    RAISE NOTICE 'Cleaned up orphaned user_roles';
    
    -- Delete masjids with no users
    DELETE FROM public.masjids
    WHERE NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.masjid_id = masjids.id
    );
    
    RAISE NOTICE 'Cleaned up orphaned masjids';
    
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_records() TO service_role;

-- ============================================
-- Important Notes
-- ============================================

-- 1. Supabase does NOT allow creating triggers on auth.users schema
-- 2. The function above must be called manually from your API
-- 3. Your existing API route (app/api/user/delete-account/route.ts) 
--    already handles this correctly by calling the deletion steps
-- 4. The cleanup_orphaned_records() function can be used as a backup
--    to clean up any orphaned records that might exist
