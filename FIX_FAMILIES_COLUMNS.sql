-- FIX FAMILIES COLUMNS BASED ON ACTUAL SCHEMA
-- Add missing columns that code expects

-- Step 1: Check if family_name exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='families' 
        AND column_name='family_name'
    ) THEN
        ALTER TABLE families ADD COLUMN family_name VARCHAR(255);
        RAISE NOTICE 'family_name column added to families table';
    ELSE
        RAISE NOTICE 'family_name column already exists in families table';
    END IF;
END $$;

-- Step 2: Check if opening_balance exists, if not add it
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

-- Step 3: Check if address exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='families' 
        AND column_name='address'
    ) THEN
        ALTER TABLE families ADD COLUMN address TEXT;
        RAISE NOTICE 'address column added to families table';
    ELSE
        RAISE NOTICE 'address column already exists in families table';
    END IF;
END $$;

-- Step 4: Check if phone exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='families' 
        AND column_name='phone'
    ) THEN
        ALTER TABLE families ADD COLUMN phone VARCHAR(20);
        RAISE NOTICE 'phone column added to families table';
    ELSE
        RAISE NOTICE 'phone column already exists in families table';
    END IF;
END $$;

-- Step 5: Check if subscription_amount exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='families' 
        AND column_name='subscription_amount'
    ) THEN
        ALTER TABLE families ADD COLUMN subscription_amount DECIMAL(10,2) DEFAULT 0.00;
        RAISE NOTICE 'subscription_amount column added to families table';
    ELSE
        RAISE NOTICE 'subscription_amount column already exists in families table';
    END IF;
END $$;

-- Step 6: Check if is_widow_head exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='families' 
        AND column_name='is_widow_head'
    ) THEN
        ALTER TABLE families ADD COLUMN is_widow_head BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'is_widow_head column added to families table';
    ELSE
        RAISE NOTICE 'is_widow_head column already exists in families table';
    END IF;
END $$;

-- Step 7: Verify all columns exist
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'families' 
ORDER BY ordinal_position;

-- Step 8: If family_code exists and family_name doesn't, copy data
UPDATE families 
SET family_name = family_code 
WHERE family_name IS NULL AND family_code IS NOT NULL;

-- Step 9: Show sample data
SELECT id, family_code, family_name, address, phone, subscription_amount, opening_balance, is_widow_head 
FROM families LIMIT 3;
