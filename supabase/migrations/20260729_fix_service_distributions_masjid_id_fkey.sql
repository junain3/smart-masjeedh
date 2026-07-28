-- Fix the foreign key constraint on service_distributions.masjid_id
-- The constraint was incorrectly pointing to users table, should point to masjids table

-- First, drop the incorrect foreign key constraint
ALTER TABLE service_distributions 
DROP CONSTRAINT IF EXISTS service_distributions_masjid_id_fkey;

-- Then, add the correct foreign key constraint pointing to masjids table
ALTER TABLE service_distributions 
ADD CONSTRAINT service_distributions_masjid_id_fkey 
FOREIGN KEY (masjid_id) 
REFERENCES masjids(id) 
ON DELETE CASCADE;
