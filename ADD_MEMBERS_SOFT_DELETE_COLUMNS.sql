-- ADD SOFT DELETE COLUMNS TO MEMBERS TABLE
-- Safe migration for soft delete functionality

-- Step 1: Add status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='members' 
        AND column_name='status'
    ) THEN
        ALTER TABLE members ADD COLUMN status TEXT DEFAULT 'Active';
        RAISE NOTICE 'status column added to members table';
    ELSE
        RAISE NOTICE 'status column already exists in members table';
    END IF;
END $$;

-- Step 2: Add status_reason column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='members' 
        AND column_name='status_reason'
    ) THEN
        ALTER TABLE members ADD COLUMN status_reason TEXT;
        RAISE NOTICE 'status_reason column added to members table';
    ELSE
        RAISE NOTICE 'status_reason column already exists in members table';
    END IF;
END $$;

-- Step 3: Add status_changed_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='members' 
        AND column_name='status_changed_at'
    ) THEN
        ALTER TABLE members ADD COLUMN status_changed_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'status_changed_at column added to members table';
    ELSE
        RAISE NOTICE 'status_changed_at column already exists in members table';
    END IF;
END $$;

-- Step 4: Add status_changed_by column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='members' 
        AND column_name='status_changed_by'
    ) THEN
        ALTER TABLE members ADD COLUMN status_changed_by UUID;
        RAISE NOTICE 'status_changed_by column added to members table';
    ELSE
        RAISE NOTICE 'status_changed_by column already exists in members table';
    END IF;
END $$;

-- Step 5: Verify all columns were added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'members' 
AND column_name IN ('status', 'status_reason', 'status_changed_at', 'status_changed_by')
ORDER BY column_name;

-- Step 6: Show sample data with new columns
SELECT id, name, status, status_reason, status_changed_at, status_changed_by FROM members LIMIT 3;

-- Step 7: Update existing members with default status (optional)
UPDATE members 
SET status = 'Active' 
WHERE status IS NULL;

-- Step 8: Show updated data
SELECT id, name, status, status_reason, status_changed_at, status_changed_by FROM members LIMIT 3;
