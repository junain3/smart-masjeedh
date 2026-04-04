-- FIX EVENTS INSERT POLICY
-- Drop existing insert policy and create correct one using user_id

-- Step 1: Drop existing insert policy (only insert one)
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

-- Step 3: Verify the new policy was created
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
AND policyname = 'Insert events for correct masjid';

-- Step 4: Check all insert policies on events table
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
AND cmd = 'INSERT';
