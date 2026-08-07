-- Create RPC function to fetch user roles for the current user
-- This bypasses RLS issues and ensures tenant context loads correctly

CREATE OR REPLACE FUNCTION public.get_current_user_roles()
RETURNS TABLE (
  masjid_id UUID,
  role TEXT,
  permissions JSONB,
  onboarding_completed BOOLEAN,
  full_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ur.masjid_id,
    ur.role,
    ur.permissions,
    ur.onboarding_completed,
    ur.full_name
  FROM public.user_roles ur
  WHERE ur.auth_user_id = auth.uid()
     OR ur.user_id = auth.uid()
  ORDER BY ur.created_at DESC;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_user_roles() TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_current_user_roles() IS 'Helper function to fetch current user''s roles bypassing RLS for tenant context loading';
