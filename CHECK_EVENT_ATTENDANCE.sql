-- CHECK EVENT ATTENDANCE TABLE
-- Understand the dependency

-- Step 1: Check event_attendance table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'event_attendance' 
ORDER BY ordinal_position;

-- Step 2: Check foreign key constraints on event_attendance
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'event_attendance' AND tc.constraint_type = 'FOREIGN KEY';

-- Step 3: Check data in event_attendance
SELECT COUNT(*) as total_event_attendance FROM event_attendance;

-- Step 4: Show sample data
SELECT * FROM event_attendance LIMIT 3;

-- Step 5: Check all foreign key constraints on events table
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'events' AND tc.constraint_type = 'FOREIGN KEY';
