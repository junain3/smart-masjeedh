-- BACKUP EVENTS TABLE - Restore Working Version
-- Go back to what was working before

-- Step 1: Drop current events table (backup first)
CREATE TABLE events_backup AS SELECT * FROM events;
DROP TABLE IF EXISTS events;

-- Step 2: Recreate events table with working structure
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATE DEFAULT CURRENT_DATE,
  event_time TIME DEFAULT '10:00:00',
  location VARCHAR(255),
  masjid_id UUID NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Step 4: Create simple RLS policies (what was working before)
CREATE POLICY "Users can manage events of their masjid"
ON events
FOR ALL
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
))
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

-- Step 5: Restore data from backup if any
INSERT INTO events (id, title, description, event_date, event_time, location, masjid_id, created_by, created_at)
SELECT id, title, description, event_date, event_time, location, masjid_id, created_by, created_at
FROM events_backup;

-- Step 6: Verify table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;

-- Step 7: Show sample data
SELECT * FROM events LIMIT 3;
