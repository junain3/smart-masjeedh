-- Fix RLS Policies for Multi-Masjid Support
-- Allow authenticated users to perform operations on their own masjid data

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

DROP POLICY IF EXISTS "Users can view own families" ON families;
DROP POLICY IF EXISTS "Users can insert own families" ON families;
DROP POLICY IF EXISTS "Users can update own families" ON families;
DROP POLICY IF EXISTS "Users can delete own families" ON families;

DROP POLICY IF EXISTS "Users can view own subscription_collections" ON subscription_collections;
DROP POLICY IF EXISTS "Users can insert own subscription_collections" ON subscription_collections;
DROP POLICY IF EXISTS "Users can update own subscription_collections" ON subscription_collections;

-- Transactions RLS Policies
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.masjid_id = transactions.masjid_id
    )
  );

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.masjid_id = masjid_id
    )
  );

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.masjid_id = transactions.masjid_id
    )
  );

CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.masjid_id = transactions.masjid_id
    )
  );

-- Families RLS Policies
CREATE POLICY "Users can view own families" ON families
  FOR SELECT USING (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.masjid_id = families.masjid_id
    )
  );

CREATE POLICY "Users can insert own families" ON families
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.masjid_id = masjid_id
    )
  );

CREATE POLICY "Users can update own families" ON families
  FOR UPDATE USING (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.masjid_id = families.masjid_id
    )
  );

CREATE POLICY "Users can delete own families" ON families
  FOR DELETE USING (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.masjid_id = families.masjid_id
    )
  );

-- Subscription Collections RLS Policies
CREATE POLICY "Users can view own subscription_collections" ON subscription_collections
  FOR SELECT USING (
    auth.uid() = collected_by_user_id AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.masjid_id = subscription_collections.masjid_id
    )
  );

CREATE POLICY "Users can insert own subscription_collections" ON subscription_collections
  FOR INSERT WITH CHECK (
    auth.uid() = collected_by_user_id AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.masjid_id = masjid_id
    )
  );

CREATE POLICY "Users can update own subscription_collections" ON subscription_collections
  FOR UPDATE USING (
    auth.uid() = collected_by_user_id AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.masjid_id = subscription_collections.masjid_id
    )
  );

-- Enable RLS on all tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_collections ENABLE ROW LEVEL SECURITY;
