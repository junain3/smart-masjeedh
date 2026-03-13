-- CHECK MASJID_ID COLUMNS IN ALL TABLES
-- Verify masjid_id columns exist in all required tables

-- Check events table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events' 
AND table_schema = 'public'
AND column_name = 'masjid_id';

-- If masjid_id doesn't exist in events, add it
ALTER TABLE events ADD COLUMN IF NOT EXISTS masjid_id TEXT;

-- Check families table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'families' 
AND table_schema = 'public'
AND column_name = 'masjid_id';

-- If masjid_id doesn't exist in families, add it
ALTER TABLE families ADD COLUMN IF NOT EXISTS masjid_id TEXT;

-- Check members table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'members' 
AND table_schema = 'public'
AND column_name = 'masjid_id';

-- If masjid_id doesn't exist in members, add it
ALTER TABLE members ADD COLUMN IF NOT EXISTS masjid_id TEXT;

-- Check user_roles table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND table_schema = 'public'
AND column_name = 'masjid_id';

-- If masjid_id doesn't exist in user_roles, add it
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS masjid_id TEXT;

-- Verify all columns exist now
SELECT 'events' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events' AND column_name = 'masjid_id'
UNION ALL
SELECT 'families' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'families' AND column_name = 'masjid_id'
UNION ALL
SELECT 'members' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'members' AND column_name = 'masjid_id'
UNION ALL
SELECT 'user_roles' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles' AND column_name = 'masjid_id';
