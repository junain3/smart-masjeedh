-- ADD STATUS COLUMN TO FAMILIES TABLE
-- Safe migration for soft delete functionality

-- Step 1: Add status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='families' 
        AND column_name='status'
    ) THEN
        ALTER TABLE families ADD COLUMN status TEXT DEFAULT 'Active';
        RAISE NOTICE 'status column added to families table';
    ELSE
        RAISE NOTICE 'status column already exists in families table';
    END IF;
END $$;

-- Step 2: Verify column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'families' 
AND column_name = 'status';

-- Step 3: Show sample data with new column
SELECT id, family_code, head_name, status FROM families LIMIT 3;

-- Step 4: Update existing families with default status (optional)
UPDATE families 
SET status = 'Active' 
WHERE status IS NULL;

-- Step 5: Show updated data
SELECT id, family_code, head_name, status FROM families LIMIT 3;
