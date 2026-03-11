-- FIX EVENTS TABLE COLUMNS
-- Add missing columns that code expects

-- Step 1: Check if title exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='events' 
        AND column_name='title'
    ) THEN
        ALTER TABLE events ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT 'Untitled Event';
        RAISE NOTICE 'title column added to events table';
    ELSE
        RAISE NOTICE 'title column already exists in events table';
    END IF;
END $$;

-- Step 2: Check if description exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='events' 
        AND column_name='description'
    ) THEN
        ALTER TABLE events ADD COLUMN description TEXT;
        RAISE NOTICE 'description column added to events table';
    ELSE
        RAISE NOTICE 'description column already exists in events table';
    END IF;
END $$;

-- Step 3: Check if event_date exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='events' 
        AND column_name='event_date'
    ) THEN
        ALTER TABLE events ADD COLUMN event_date DATE DEFAULT CURRENT_DATE;
        RAISE NOTICE 'event_date column added to events table';
    ELSE
        RAISE NOTICE 'event_date column already exists in events table';
    END IF;
END $$;

-- Step 4: Check if event_time exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='events' 
        AND column_name='event_time'
    ) THEN
        ALTER TABLE events ADD COLUMN event_time TIME DEFAULT '10:00:00';
        RAISE NOTICE 'event_time column added to events table';
    ELSE
        RAISE NOTICE 'event_time column already exists in events table';
    END IF;
END $$;

-- Step 5: Check if location exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='events' 
        AND column_name='location'
    ) THEN
        ALTER TABLE events ADD COLUMN location VARCHAR(255);
        RAISE NOTICE 'location column added to events table';
    ELSE
        RAISE NOTICE 'location column already exists in events table';
    END IF;
END $$;

-- Step 6: Check if created_by exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='events' 
        AND column_name='created_by'
    ) THEN
        ALTER TABLE events ADD COLUMN created_by UUID REFERENCES auth.users(id);
        RAISE NOTICE 'created_by column added to events table';
    ELSE
        RAISE NOTICE 'created_by column already exists in events table';
    END IF;
END $$;

-- Step 7: Verify all columns exist
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;

-- Step 8: Show sample data
SELECT * FROM events LIMIT 1;
