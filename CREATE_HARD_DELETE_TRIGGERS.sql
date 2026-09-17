-- Database triggers for hard delete cleanup
-- These triggers automatically clean up related records when a user is hard-deleted from Supabase Auth Dashboard

-- Function to clean up user data when auth user is deleted
CREATE OR REPLACE FUNCTION public.handle_auth_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the deletion
  RAISE NOTICE 'Handling hard delete for auth user: %', OLD.id;
  
  -- Delete from user_roles (both user_id and auth_user_id)
  DELETE FROM public.user_roles
  WHERE user_id = OLD.id OR auth_user_id = OLD.id;
  
  -- Delete from invitations
  DELETE FROM public.invitations
  WHERE email = OLD.email;
  
  -- Delete from role_invitations if it exists
  BEGIN
    DELETE FROM public.role_invitations
    WHERE email = OLD.email;
  EXCEPTION WHEN undefined_table THEN
    -- Table doesn't exist, skip
  END;
  
  -- Delete from deleted_masjeedhs_archive (clean up archive if owner is hard-deleted)
  DELETE FROM public.deleted_masjeedhs_archive
  WHERE owner_email = OLD.email OR owner_user_id = OLD.id;
  
  -- Delete from email_verifications
  DELETE FROM public.email_verifications
  WHERE email = OLD.email;
  
  RAISE NOTICE 'Hard delete cleanup completed for auth user: %', OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users deletion
-- Note: This requires the trigger to be created in the auth schema
-- Run this in Supabase SQL Editor with proper auth schema access

-- For Supabase, we need to create a function that can be called manually
-- or use a webhook approach since direct triggers on auth.users are restricted

-- Alternative: Create a function that can be called by admin to clean up after hard delete
CREATE OR REPLACE FUNCTION public.cleanup_hard_deleted_user(user_id UUID, user_email TEXT)
RETURNS JSONB AS $$
BEGIN
  -- Log the cleanup
  RAISE NOTICE 'Cleaning up hard deleted user: %, email: %', user_id, user_email;
  
  -- Delete from user_roles
  DELETE FROM public.user_roles
  WHERE user_id = user_id OR auth_user_id = user_id;
  
  -- Delete from invitations
  DELETE FROM public.invitations
  WHERE email = user_email;
  
  -- Delete from role_invitations if it exists
  BEGIN
    DELETE FROM public.role_invitations
    WHERE email = user_email;
  EXCEPTION WHEN undefined_table THEN
    -- Table doesn't exist, skip
  END;
  
  -- Delete from deleted_masjeedhs_archive
  DELETE FROM public.deleted_masjeedhs_archive
  WHERE owner_email = user_email OR owner_user_id = user_id;
  
  -- Delete from email_verifications
  DELETE FROM public.email_verifications
  WHERE email = user_email;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_id,
    'email', user_email,
    'message', 'Cleanup completed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.cleanup_hard_deleted_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_hard_deleted_user TO anon;

-- Create a function to check if email has any grace period restrictions
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
