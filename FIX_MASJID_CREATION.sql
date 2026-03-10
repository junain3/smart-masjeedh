-- FIX MASJID CREATION ISSUES

-- Step 1: Ensure table has all required columns
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() PRIMARY KEY;
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS name TEXT NOT NULL;
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE masjids ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 2: Drop and recreate RLS policies properly
ALTER TABLE masjids DISABLE ROW LEVEL SECURITY;
ALTER TABLE masjids ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own masjids" ON masjids;
DROP POLICY IF EXISTS "Users can insert their own masjids" ON masjids;
DROP POLICY IF EXISTS "Users can update their own masjids" ON masjids;

-- Create proper INSERT policy that allows authenticated users to create masjids
CREATE POLICY "Allow authenticated users to create masjids"
    ON masjids FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        created_by = auth.uid()
    );

-- Create proper SELECT policy
CREATE POLICY "Allow users to view their own masjids"
    ON masjids FOR SELECT
    USING (
        auth.uid() = created_by
    );

-- Create proper UPDATE policy
CREATE POLICY "Allow users to update their own masjids"
    ON masjids FOR UPDATE
    USING (
        auth.uid() = created_by
    );

-- Step 3: Test the INSERT operation (this should work now)
-- First, let's see what the current user ID is
SELECT auth.uid() as current_user_id;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_masjids_created_by ON masjids(created_by);
CREATE INDEX IF NOT EXISTS idx_masjids_name ON masjids(name);

-- Step 5: Verify table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'masjids' 
ORDER BY ordinal_position;

-- Step 6: Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'masjids';
