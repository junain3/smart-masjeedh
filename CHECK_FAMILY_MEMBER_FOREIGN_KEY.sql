-- CHECK FOREIGN KEY RELATIONSHIP BETWEEN FAMILIES AND MEMBERS
-- Check if members.family_id has ON DELETE CASCADE

-- Step 1: Check foreign key constraints on members table
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
WHERE
    tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'members'
    AND kcu.column_name = 'family_id';

-- Step 2: If no cascade exists, add it
-- Run this only if the above query shows delete_rule is not 'CASCADE'
-- ALTER TABLE members
-- DROP CONSTRAINT IF EXISTS members_family_id_fkey,
-- ADD CONSTRAINT members_family_id_fkey
-- FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;
