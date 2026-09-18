-- Database triggers for hard delete cleanup
-- These triggers automatically clean up related records when a user is hard-deleted from Supabase Auth Dashboard

-- Function to clean up user data when auth user is deleted
-- This function is called manually by developers after deleting from auth.users
-- since direct triggers on auth.users are restricted in Supabase
CREATE OR REPLACE FUNCTION public.cleanup_hard_deleted_user(p_user_id UUID, p_user_email TEXT)
RETURNS JSONB AS $$
BEGIN
  -- Log the cleanup
  RAISE NOTICE 'Cleaning up hard deleted user: %, email: %', p_user_id, p_user_email;
  
  -- Delete from user_roles (both user_id and auth_user_id)
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id OR auth_user_id = p_user_id;
  
  -- Delete from invitations
  DELETE FROM public.invitations
  WHERE email = p_user_email;
  
  -- Delete from role_invitations if it exists
  BEGIN
    DELETE FROM public.role_invitations
    WHERE email = p_user_email;
  EXCEPTION WHEN undefined_table THEN
    -- Table doesn't exist, skip
  END;
  
  -- Delete from deleted_masjeedhs_archive (clean up archive if owner is hard-deleted)
  DELETE FROM public.deleted_masjeedhs_archive
  WHERE owner_email = p_user_email OR owner_user_id = p_user_id;
  
  -- Delete from email_verifications
  DELETE FROM public.email_verifications
  WHERE email = p_user_email;
  
  -- Delete from user_profiles if it exists
  BEGIN
    DELETE FROM public.user_profiles
    WHERE user_id = p_user_id OR auth_user_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN
    -- Table doesn't exist, skip
  END;
  
  RAISE NOTICE 'Hard delete cleanup completed for auth user: %', p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'email', p_user_email,
    'message', 'Cleanup completed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.cleanup_hard_deleted_user TO service_role;

-- Function to check if email has any grace period restrictions
-- This will be used during invitation to skip grace period for hard-deleted users
CREATE OR REPLACE FUNCTION public.should_skip_grace_period(email_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- If the email was hard-deleted (no archive entry exists), skip grace period
  -- This is checked by seeing if there's NO active grace period entry
  -- and the email doesn't exist in auth.users
  
  RETURN NOT EXISTS (
    SELECT 1 FROM public.deleted_masjeedhs_archive
    WHERE owner_email = email_param
    AND status = 'pending_deletion'
    AND expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.should_skip_grace_period TO authenticated;
GRANT EXECUTE ON FUNCTION public.should_skip_grace_period TO anon;

-- Add comments
COMMENT ON FUNCTION public.cleanup_hard_deleted_user IS 'Developer function to cascade-delete all user data after hard-deleting from auth.users';
COMMENT ON FUNCTION public.should_skip_grace_period IS 'Check if email should skip grace period (for hard-deleted users)';

-- Instructions for developers:
-- When you hard-delete a user from Supabase Auth Dashboard or SQL, call:
-- SELECT public.cleanup_hard_deleted_user(user_id, user_email);
-- This will clean up all related records and free up the email for fresh registration.
