-- FIX TRANSACTIONS TABLE SCHEMA FOR MULTI-MASJID SUPPORT
-- Add missing masjid_id column and fix foreign key constraints

-- Step 1: Add masjid_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='transactions' 
        AND column_name='masjid_id'
    ) THEN
        ALTER TABLE transactions ADD COLUMN masjid_id UUID REFERENCES masjids(id) ON DELETE CASCADE;
        RAISE NOTICE 'masjid_id column added to transactions table';
    ELSE
        RAISE NOTICE 'masjid_id column already exists in transactions table';
    END IF;
END $$;

-- Step 2: Add family_id column if it doesn't exist (for subscriptions)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='transactions' 
        AND column_name='family_id'
    ) THEN
        ALTER TABLE transactions ADD COLUMN family_id UUID REFERENCES families(id) ON DELETE SET NULL;
        RAISE NOTICE 'family_id column added to transactions table';
    ELSE
        RAISE NOTICE 'family_id column already exists in transactions table';
    END IF;
END $$;

-- Step 3: Verify the current schema
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
ORDER BY ordinal_position;

-- Step 4: Backfill existing transactions with masjid_id based on user_id
-- This assigns existing transactions to the user's masjid
UPDATE transactions 
SET masjid_id = (
    SELECT ur.masjid_id 
    FROM user_roles ur 
    WHERE ur.auth_user_id = transactions.user_id 
    LIMIT 1
)
WHERE masjid_id IS NULL 
AND user_id IS NOT NULL;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_masjid_id ON transactions(masjid_id);
CREATE INDEX IF NOT EXISTS idx_transactions_family_id ON transactions(family_id);

-- Step 6: Update RLS policies to support masjid-based access
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

-- Step 7: Create masjid-aware RLS policies
CREATE POLICY "Users can view transactions of their masjid" ON transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.masjid_id = transactions.masjid_id 
            AND ur.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert transactions in their masjid" ON transactions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.masjid_id = masjid_id 
            AND ur.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update transactions in their masjid" ON transactions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.masjid_id = transactions.masjid_id 
            AND ur.auth_user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.masjid_id = masjid_id 
            AND ur.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete transactions in their masjid" ON transactions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.masjid_id = transactions.masjid_id 
            AND ur.auth_user_id = auth.uid()
        )
    );

-- Step 8: Verify the fix
SELECT 
    COUNT(*) as total_transactions,
    COUNT(masjid_id) as transactions_with_masjid_id,
    COUNT(family_id) as transactions_with_family_id
FROM transactions;

-- Step 9: Show sample data to verify structure
SELECT id, user_id, masjid_id, family_id, type, amount, description, date
FROM transactions 
LIMIT 3;
