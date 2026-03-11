-- FIX MEMBERS TABLE COLUMNS
-- Add missing columns that code expects

-- Step 1: Check if name exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='members' 
        AND column_name='name'
    ) THEN
        ALTER TABLE members ADD COLUMN name VARCHAR(255);
        RAISE NOTICE 'name column added to members table';
    ELSE
        RAISE NOTICE 'name column already exists in members table';
    END IF;
END $$;

-- Step 2: Check if email exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='members' 
        AND column_name='email'
    ) THEN
        ALTER TABLE members ADD COLUMN email VARCHAR(255);
        RAISE NOTICE 'email column added to members table';
    ELSE
        RAISE NOTICE 'email column already exists in members table';
    END IF;
END $$;

-- Step 3: Check if phone exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='members' 
        AND column_name='phone'
    ) THEN
        ALTER TABLE members ADD COLUMN phone VARCHAR(20);
        RAISE NOTICE 'phone column added to members table';
    ELSE
        RAISE NOTICE 'phone column already exists in members table';
    END IF;
END $$;

-- Step 4: Check if address exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='members' 
        AND column_name='address'
    ) THEN
        ALTER TABLE members ADD COLUMN address TEXT;
        RAISE NOTICE 'address column added to members table';
    ELSE
        RAISE NOTICE 'address column already exists in members table';
    END IF;
END $$;

-- Step 5: Check if gender exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='members' 
        AND column_name='gender'
    ) THEN
        ALTER TABLE members ADD COLUMN gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Other'));
        RAISE NOTICE 'gender column added to members table';
    ELSE
        RAISE NOTICE 'gender column already exists in members table';
    END IF;
END $$;

-- Step 6: Check if family_id exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='members' 
        AND column_name='family_id'
    ) THEN
        ALTER TABLE members ADD COLUMN family_id UUID REFERENCES families(id) ON DELETE CASCADE;
        RAISE NOTICE 'family_id column added to members table';
    ELSE
        RAISE NOTICE 'family_id column already exists in members table';
    END IF;
END $$;

-- Step 7: Check if masjid_id exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='members' 
        AND column_name='masjid_id'
    ) THEN
        ALTER TABLE members ADD COLUMN masjid_id UUID NOT NULL REFERENCES masjids(id) ON DELETE CASCADE;
        RAISE NOTICE 'masjid_id column added to members table';
    ELSE
        RAISE NOTICE 'masjid_id column already exists in members table';
    END IF;
END $$;

-- Step 8: Verify all columns exist
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'members' 
ORDER BY ordinal_position;

-- Step 9: Show sample data
SELECT * FROM members LIMIT 1;
