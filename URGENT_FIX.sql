-- URGENT: Fix masjids table immediately
-- Check current structure first
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'masjids' 
ORDER BY ordinal_position;

-- Add missing columns if they don't exist
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() PRIMARY KEY;
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Default Masjid';
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_masjids_created_by ON masjids(created_by);
CREATE INDEX IF NOT EXISTS idx_masjids_name ON masjids(name);

-- Enable RLS
ALTER TABLE masjids ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own masjids" ON masjids;
DROP POLICY IF EXISTS "Users can insert their own masjids" ON masjids;
DROP POLICY IF EXISTS "Users can update their own masjids" ON masjids;

-- Create new policies
CREATE POLICY "Users can view their own masjids"
    ON masjids FOR SELECT
    USING (
        auth.uid() = created_by
    );

CREATE POLICY "Users can insert their own masjids"
    ON masjids FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
    );

CREATE POLICY "Users can update their own masjids"
    ON masjids FOR UPDATE
    USING (
        auth.uid() = created_by
    );

-- Test the table
SELECT * FROM masjids LIMIT 1;

-- Verify structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'masjids' 
ORDER BY ordinal_position;
