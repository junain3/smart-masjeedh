-- Fix families table to ensure user_id is properly set for multi-user isolation
-- This migration handles existing families and ensures new families always have user_id

-- Step 1: Add user_id column if it doesn't exist (for safety)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'families' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE families ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Step 2: Update families with missing user_id by assigning them to the first user found
-- This is a one-time fix for existing data
UPDATE families 
SET user_id = (
    SELECT id FROM auth.users LIMIT 1
)
WHERE user_id IS NULL;

-- Step 3: Make user_id NOT NULL for future inserts
ALTER TABLE families ALTER COLUMN user_id SET NOT NULL;

-- Step 4: Create index for performance
CREATE INDEX IF NOT EXISTS idx_families_user_id ON families(user_id);

-- Step 5: Enable RLS if not already enabled
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies if they exist
DROP POLICY IF EXISTS "families_select_policy" ON families;
DROP POLICY IF EXISTS "families_insert_policy" ON families;
DROP POLICY IF EXISTS "families_update_policy" ON families;
DROP POLICY IF EXISTS "families_delete_policy" ON families;

-- Step 7: Create secure RLS policies
CREATE POLICY "families_select_policy" ON families
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "families_insert_policy" ON families
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "families_update_policy" ON families
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "families_delete_policy" ON families
    FOR DELETE USING (auth.uid() = user_id);

-- Step 8: Verify the fix
SELECT 
    COUNT(*) as total_families,
    COUNT(user_id) as families_with_user_id,
    COUNT(*) - COUNT(user_id) as families_missing_user_id
FROM families;
