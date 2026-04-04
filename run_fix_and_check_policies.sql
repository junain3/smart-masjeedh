-- RUN FIX AND CHECK INSERT POLICIES
-- Apply the fix and verify all INSERT policies on events table

-- Step 1: Drop existing insert policy
DROP POLICY IF EXISTS "Users can insert events in their masjid" ON public.events;

-- Step 2: Create correct policy using user_id
CREATE POLICY "Insert events for correct masjid"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (
  masjid_id IN (
    SELECT masjid_id
    FROM public.user_roles
    WHERE user_id = auth.uid()
  )
);

-- Step 3: Re-check all INSERT policies on public.events
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename = 'events'
AND cmd = 'INSERT'
ORDER BY policyname;

-- Step 4: Check if RLS is enabled on events
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'events';

-- Step 5: Check current user context
SELECT 
    auth.uid() as current_user_id,
    auth.jwt() ->> 'email' as current_email,
    auth.role() as current_role;

-- Step 6: Test if current user has any roles
SELECT 
    ur.user_id,
    ur.masjid_id,
    ur.role,
    ur.email,
    m.masjid_name
FROM public.user_roles ur
LEFT JOIN public.masjids m ON ur.masjid_id = m.id
WHERE ur.user_id = auth.uid();
