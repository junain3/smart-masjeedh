-- Fix Invitation Roles Check Constraints
-- This script updates the check constraints on invitation tables to include all four roles:
-- super_admin, co_admin, staff, editor
-- This script is defensive and checks for table/constraint existence before making changes

DO $$
DECLARE
    table_exists BOOLEAN;
    constraint_exists BOOLEAN;
BEGIN
    -- Step 1: Update user_invitations table constraint (if table exists)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_invitations'
    ) INTO table_exists;

    IF table_exists THEN
        RAISE NOTICE 'Table user_invitations exists. Checking constraint...';
        
        -- Check if constraint exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_schema = 'public'
            AND tc.table_name = 'user_invitations'
            AND tc.constraint_name = 'user_invitations_role_check'
        ) INTO constraint_exists;

        IF constraint_exists THEN
            RAISE NOTICE 'Dropping existing user_invitations_role_check constraint';
            ALTER TABLE user_invitations DROP CONSTRAINT user_invitations_role_check;
        END IF;

        RAISE NOTICE 'Adding new user_invitations_role_check constraint with all four roles';
        ALTER TABLE user_invitations 
        ADD CONSTRAINT user_invitations_role_check 
        CHECK (role IN ('super_admin', 'co_admin', 'staff', 'editor'));
        
        RAISE NOTICE 'user_invitations constraint updated successfully';
    ELSE
        RAISE NOTICE 'Table user_invitations does not exist. Skipping.';
    END IF;

    -- Step 2: Update invitations table constraint (if table exists)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invitations'
    ) INTO table_exists;

    IF table_exists THEN
        RAISE NOTICE 'Table invitations exists. Checking constraint...';
        
        -- Check if constraint exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_schema = 'public'
            AND tc.table_name = 'invitations'
            AND tc.constraint_name = 'invitations_role_check'
        ) INTO constraint_exists;

        IF constraint_exists THEN
            RAISE NOTICE 'Dropping existing invitations_role_check constraint';
            ALTER TABLE invitations DROP CONSTRAINT invitations_role_check;
        END IF;

        RAISE NOTICE 'Adding new invitations_role_check constraint with all four roles';
        ALTER TABLE invitations 
        ADD CONSTRAINT invitations_role_check 
        CHECK (role IN ('super_admin', 'co_admin', 'staff', 'editor'));
        
        RAISE NOTICE 'invitations constraint updated successfully';
    ELSE
        RAISE NOTICE 'Table invitations does not exist. Skipping.';
    END IF;
END $$;

-- Verification: Check the constraints are updated correctly
RAISE NOTICE '=== Verification Results ===';
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid::regclass::text IN ('user_invitations', 'invitations')
AND conname LIKE '%role%';

-- Verify no data is affected (should return 0 rows for each table)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_invitations') THEN
        RAISE NOTICE 'Checking user_invitations for invalid role values...';
        PERFORM COUNT(*) FROM user_invitations WHERE role NOT IN ('super_admin', 'co_admin', 'staff', 'editor');
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invitations') THEN
        RAISE NOTICE 'Checking invitations for invalid role values...';
        PERFORM COUNT(*) FROM invitations WHERE role NOT IN ('super_admin', 'co_admin', 'staff', 'editor');
    END IF;
END $$;
