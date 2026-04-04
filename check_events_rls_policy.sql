-- CHECK EVENTS RLS AND ADD POLICY IF NEEDED
-- Verify RLS status and add insert policy for testing

-- Step 1: Check if RLS is enabled on events table
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'events';

-- Step 2: Check existing policies on events table
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
WHERE tablename = 'events';

-- Step 3: If RLS is enabled but no insert policy, add one
-- Option A: Allow all authenticated users (for testing)
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.events;
CREATE POLICY "Allow insert for authenticated users"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Option B: Safer version - only if masjid_id is provided (recommended)
DROP POLICY IF EXISTS "Allow insert only for user's masjid" ON public.events;
CREATE POLICY "Allow insert only for user's masjid"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (masjid_id IS NOT NULL);

-- Step 4: Verify policies after creation
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
WHERE tablename = 'events';
