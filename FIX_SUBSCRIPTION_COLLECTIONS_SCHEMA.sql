-- FIX SUBSCRIPTION_COLLECTIONS TABLE SCHEMA FOR MULTI-MASJID SUPPORT
-- Add missing masjid_id column and fix foreign key constraints

-- Step 1: Add masjid_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='subscription_collections' 
        AND column_name='masjid_id'
    ) THEN
        ALTER TABLE subscription_collections ADD COLUMN masjid_id UUID REFERENCES masjids(id) ON DELETE CASCADE;
        RAISE NOTICE 'masjid_id column added to subscription_collections table';
    ELSE
        RAISE NOTICE 'masjid_id column already exists in subscription_collections table';
    END IF;
END $$;

-- Step 2: Verify the current schema
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'subscription_collections' 
ORDER BY ordinal_position;

-- Step 3: Backfill existing collections with masjid_id based on collected_by_user_id
UPDATE subscription_collections 
SET masjid_id = (
    SELECT ur.masjid_id 
    FROM user_roles ur 
    WHERE ur.auth_user_id = subscription_collections.collected_by_user_id 
    LIMIT 1
)
WHERE masjid_id IS NULL 
AND collected_by_user_id IS NOT NULL;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_collections_masjid_id ON subscription_collections(masjid_id);

-- Step 5: Update RLS policies for masjid-based access
DROP POLICY IF EXISTS "Users can view collections of their masjid" ON subscription_collections;
DROP POLICY IF EXISTS "Users can insert collections in their masjid" ON subscription_collections;

CREATE POLICY "Users can view collections of their masjid" ON subscription_collections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.masjid_id = subscription_collections.masjid_id 
            AND ur.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert collections in their masjid" ON subscription_collections
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.masjid_id = masjid_id 
            AND ur.auth_user_id = auth.uid()
        )
    );

-- Step 6: Verify the fix
SELECT 
    COUNT(*) as total_collections,
    COUNT(masjid_id) as collections_with_masjid_id
FROM subscription_collections;
