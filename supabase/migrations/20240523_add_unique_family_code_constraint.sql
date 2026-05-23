-- Add unique constraint to prevent duplicate family_code per masjid_id
-- This prevents race conditions when multiple users add families simultaneously

-- First, check for and handle any existing duplicates
WITH duplicates AS (
  SELECT family_code, masjid_id, COUNT(*) as count
  FROM families
  GROUP BY family_code, masjid_id
  HAVING COUNT(*) > 1
)
-- If duplicates exist, they need to be resolved manually before adding the constraint
-- This migration will fail if duplicates exist, which is intentional for safety

-- Add unique constraint on (family_code, masjid_id)
ALTER TABLE families 
ADD CONSTRAINT families_family_code_masjid_id_key 
UNIQUE (family_code, masjid_id);

-- Note: If this migration fails due to existing duplicates, you can resolve them by:
-- 1. Identifying duplicates: SELECT family_code, masjid_id, COUNT(*) FROM families GROUP BY family_code, masjid_id HAVING COUNT(*) > 1;
-- 2. Manually updating duplicate family_codes to unique values
-- 3. Re-running this migration
