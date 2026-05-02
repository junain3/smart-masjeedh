-- Fix RLS policy for staff_commissions table
-- Update policies to match project's security pattern using helper functions

-- Step 1: Verify current RLS status and policies
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'staff_commissions'
AND schemaname = 'public';

SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'staff_commissions'
AND schemaname = 'public'
ORDER BY policyname;

-- Step 2: Drop existing policies (they use old pattern)
DROP POLICY IF EXISTS "Users can view own staff_commissions" ON staff_commissions;
DROP POLICY IF EXISTS "Admins can manage staff_commissions" ON staff_commissions;

-- Step 3: Create SELECT policy following project pattern
CREATE POLICY staff_commissions_select
ON public.staff_commissions
FOR SELECT
TO authenticated
USING (
  public.is_masjid_admin(masjid_id)
  OR public.has_masjid_permission(masjid_id, 'subscriptions_approve'::text)
  OR (auth.uid() = staff_user_id AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.auth_user_id = auth.uid() 
      AND ur.masjid_id = masjid_id
      AND ur.verified = true
  ))
);

-- Step 4: Create INSERT policy (admin and subscriptions_approve only)
CREATE POLICY staff_commissions_insert
ON public.staff_commissions
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_masjid_admin(masjid_id)
  OR public.has_masjid_permission(masjid_id, 'subscriptions_approve'::text)
);

-- Step 5: Create UPDATE policy (admin and subscriptions_approve only)
CREATE POLICY staff_commissions_update
ON public.staff_commissions
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

-- Step 6: Verify the policies were created
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'staff_commissions'
AND schemaname = 'public'
ORDER BY policyname;
