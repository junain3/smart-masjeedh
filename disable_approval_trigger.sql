-- Disable the conflicting approval trigger
-- The RPC function approve_subscription_collections handles commission creation
-- This trigger is causing conflicts and staff_user_id errors

DROP TRIGGER IF EXISTS subscription_collections_approval_trigger ON public.subscription_collections;

-- Also drop the function to avoid any conflicts
DROP FUNCTION IF EXISTS public.approve_subscription_collection();
