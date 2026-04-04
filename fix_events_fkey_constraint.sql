-- FIX EVENTS FOREIGN KEY CONSTRAINT
-- Drop wrong constraint and add correct one referencing masjids table

-- Step 1: Drop wrong constraint (references users table instead of masjids)
ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS events_masjid_id_fkey;

-- Step 2: Add correct constraint (references masjids table)
ALTER TABLE public.events
ADD CONSTRAINT events_masjid_id_fkey
FOREIGN KEY (masjid_id)
REFERENCES public.masjids(id)
ON DELETE CASCADE;

-- Step 3: Verify the constraint was created correctly
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'events'
AND kcu.column_name = 'masjid_id';
