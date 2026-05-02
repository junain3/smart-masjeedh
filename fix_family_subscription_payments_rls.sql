-- Fix RLS policy for family_subscription_payments table
-- Add missing INSERT policy to allow authenticated users to insert records for their masjid

-- Step 1: Verify current RLS status and policies
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'family_subscription_payments'
AND schemaname = 'public';

SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'family_subscription_payments'
AND schemaname = 'public'
ORDER BY policyname;

-- Step 2: Create INSERT policy for family_subscription_payments
-- Allow users with admin, subscriptions_collect, or subscriptions_approve permissions
DROP POLICY IF EXISTS family_subscription_payments_insert ON public.family_subscription_payments;

CREATE POLICY family_subscription_payments_insert
ON public.family_subscription_payments
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_masjid_admin(masjid_id)
  OR public.has_masjid_permission(masjid_id, 'subscriptions_collect'::text)
  OR public.has_masjid_permission(masjid_id, 'subscriptions_approve'::text)
);

-- Step 3: Create UPDATE policy for family_subscription_payments
-- Allow only admin or subscriptions_approve permissions (more restrictive)
DROP POLICY IF EXISTS family_subscription_payments_update ON public.family_subscription_payments;

CREATE POLICY family_subscription_payments_update
ON public.family_subscription_payments
FOR UPDATE
TO authenticated
USING (
  public.is_masjid_admin(masjid_id)
  OR public.has_masjid_permission(masjid_id, 'subscriptions_approve'::text)
)
WITH CHECK (
  public.is_masjid_admin(masjid_id)
  OR public.has_masjid_permission(masjid_id, 'subscriptions_approve'::text)
);

-- Step 4: Verify the policies were created
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'family_subscription_payments'
AND schemaname = 'public'
ORDER BY policyname;
