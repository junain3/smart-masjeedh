-- =====================================================
-- SECURE MULTI-USER TRANSACTIONS TABLE SETUP
-- =====================================================
-- This migration creates a secure multi-user expense tracking system
-- Each user can only access their own transactions
-- No cross-user data leakage possible

-- Step 1: Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 2: Drop existing table and policies (safe recreation)
DROP TABLE IF EXISTS transactions CASCADE;

-- Step 3: Create secure transactions table
CREATE TABLE transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('income', 'expense', 'subscription')),
    amount numeric NOT NULL CHECK (amount > 0),
    description text,
    category text,
    date date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Step 4: Add indexes for performance
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_category ON transactions(category);

-- Step 5: Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view transactions of their masjid" ON transactions;
DROP POLICY IF EXISTS "Users can insert transactions in their masjid" ON transactions;
DROP POLICY IF EXISTS "Users can update transactions in their masjid" ON transactions;
DROP POLICY IF EXISTS "Users can delete transactions in their masjid" ON transactions;

-- Step 7: Create secure RLS policies - STRICT USER ISOLATION
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON transactions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON transactions
    FOR DELETE USING (auth.uid() = user_id);

-- Step 8: Add trigger for updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Step 9: Verification query to check policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename = 'transactions'
ORDER BY policyname;

-- =====================================================
-- SECURITY NOTES:
-- 1. Each transaction MUST have user_id
-- 2. RLS policies use auth.uid() = user_id (strict)
-- 3. No masjid_id - pure user isolation
-- 4. No service role keys in frontend
-- 5. All queries MUST include user filter
-- =====================================================
