-- Add onboarding_completed flag to user_roles table
-- This allows tracking whether a user has completed their first-time onboarding

ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add comment to document the purpose
COMMENT ON COLUMN public.user_roles.onboarding_completed IS 'Flag to track if user has completed first-time onboarding (entered full name and profile details)';
