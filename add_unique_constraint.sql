-- Run this in Supabase SQL Editor to add unique constraint
-- This prevents duplicate family_code per masjid_id

-- First, check for existing duplicates (run this first)
SELECT family_code, masjid_id, COUNT(*) as count
FROM families
GROUP BY family_code, masjid_id
HAVING COUNT(*) > 1;

-- If no duplicates found, run this to add the constraint
ALTER TABLE families 
ADD CONSTRAINT IF NOT EXISTS families_family_code_masjid_id_key 
UNIQUE (family_code, masjid_id);
