-- IMPLEMENT SOFT DELETE SCHEMA FOR FAMILIES AND MEMBERS
-- Add status, status_reason, status_changed_at, status_changed_by columns

-- Step 1: Add soft delete columns to families table
ALTER TABLE families 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Moved Out', 'Left', 'Deceased')),
ADD COLUMN IF NOT EXISTS status_reason TEXT,
ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES auth.users(id);

-- Step 2: Add soft delete columns to members table
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Moved Out', 'Left', 'Deceased')),
ADD COLUMN IF NOT EXISTS status_reason TEXT,
ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES auth.users(id);

-- Step 3: Create indexes for status filtering
CREATE INDEX IF NOT EXISTS idx_families_status ON families(status);
CREATE INDEX IF NOT EXISTS idx_families_masjid_status ON families(masjid_id, status);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_masjid_status ON members(masjid_id, status);

-- Step 4: Verify columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'families' 
AND column_name IN ('status', 'status_reason', 'status_changed_at', 'status_changed_by')
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'members' 
AND column_name IN ('status', 'status_reason', 'status_changed_at', 'status_changed_by')
ORDER BY ordinal_position;
