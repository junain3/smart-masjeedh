-- Add full_name column to user_roles table for better accountability
-- This allows displaying actual administrator names instead of just user IDs

ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Add comment to document the purpose
COMMENT ON COLUMN public.user_roles.full_name IS 'Full name of the user/administrator for display purposes in transaction logs and activity records';
