-- ADD OPENING_BALANCE COLUMN TO FAMILIES TABLE
-- Fix missing column issue

-- Step 1: Add opening_balance column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='families' 
        AND column_name='opening_balance'
    ) THEN
        ALTER TABLE families ADD COLUMN opening_balance DECIMAL(10,2) DEFAULT 0.00;
        RAISE NOTICE 'opening_balance column added to families table';
    ELSE
        RAISE NOTICE 'opening_balance column already exists in families table';
    END IF;
END $$;

-- Step 2: Verify column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'families' 
AND column_name = 'opening_balance';

-- Step 3: Show sample data with new column
SELECT id, family_name, opening_balance FROM families LIMIT 3;

-- Step 4: Update existing families with default opening balance (optional)
UPDATE families 
SET opening_balance = 0.00 
WHERE opening_balance IS NULL;

-- Step 5: Show updated data
SELECT id, family_name, opening_balance FROM families LIMIT 3;
