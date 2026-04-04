-- GET VALID MASJID_ID FOR TESTING
-- Find an existing masjid to use for temporary hardcoded fix

-- Step 1: Get any existing masjid_id
SELECT id, name, created_at 
FROM masjids 
ORDER BY created_at DESC 
LIMIT 1;

-- Step 2: If no masjids, create one for testing
INSERT INTO masjids (id, name, tagline) 
VALUES (
  gen_random_uuid(),
  'Test Masjid for Event Creation',
  'Test masjid for debugging'
) 
ON CONFLICT (id) DO NOTHING
RETURNING id, name;

-- Step 3: Show final result
SELECT id, name, created_at 
FROM masjids 
ORDER BY created_at DESC 
LIMIT 1;
