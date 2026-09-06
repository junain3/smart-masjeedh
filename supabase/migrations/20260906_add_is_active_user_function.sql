-- Migration: Add is_active_user() SECURITY DEFINER function
-- This function checks if a user has active access based on user_roles and masjids status
-- It runs with SECURITY DEFINER to bypass RLS and check the actual status

CREATE OR REPLACE FUNCTION public.is_active_user(user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user has an active user_roles entry
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE auth_user_id = user_id
    AND status = 'active'
  ) THEN
    -- Check if the associated masjid is also active
    RETURN EXISTS (
      SELECT 1 FROM public.masjids m
      INNER JOIN public.user_roles ur ON ur.masjid_id = m.id
      WHERE ur.auth_user_id = user_id
      AND m.status = 'active'
    );
  END IF;

  RETURN FALSE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_active_user(UUID) TO authenticated;
