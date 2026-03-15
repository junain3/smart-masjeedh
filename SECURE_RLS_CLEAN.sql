-- SECURE RLS POLICIES - Clean Multi-Tenant Implementation
-- Proper tenant isolation without broad public access

-- Step 1: Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view events of their masjid" ON events;
DROP POLICY IF EXISTS "Users can insert events in their masjid" ON events;
DROP POLICY IF EXISTS "Users can update events in their masjid" ON events;
DROP POLICY IF EXISTS "Users can delete events in their masjid" ON events;

DROP POLICY IF EXISTS "Users can view families of their masjid" ON families;
DROP POLICY IF EXISTS "Users can insert families in their masjid" ON families;
DROP POLICY IF EXISTS "Users can update families in their masjid" ON families;
DROP POLICY IF EXISTS "Users can delete families in their masjid" ON families;

DROP POLICY IF EXISTS "Users can view members of their masjid" ON members;
DROP POLICY IF EXISTS "Users can insert members in their masjid" ON members;
DROP POLICY IF EXISTS "Users can update members in their masjid" ON members;
DROP POLICY IF EXISTS "Users can delete members in their masjid" ON members;

DROP POLICY IF EXISTS "Users can view user_roles of their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can insert user_roles in their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can update user_roles in their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can delete user_roles of their masjid" ON user_roles;

DROP POLICY IF EXISTS "Users can view transactions of their masjid" ON transactions;
DROP POLICY IF EXISTS "Users can insert transactions in their masjid" ON transactions;
DROP POLICY IF EXISTS "Users can update transactions in their masjid" ON transactions;
DROP POLICY IF EXISTS "Users can delete transactions in their masjid" ON transactions;

-- Step 2: Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE masjids ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Step 3: Create secure policies for events table
CREATE POLICY "Users can view events of their masjid"
ON events
FOR SELECT
TO authenticated
USING (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can insert events in their masjid"
ON events
FOR INSERT
TO authenticated
WITH CHECK (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can update events of their masjid"
ON events
FOR UPDATE
TO authenticated
USING (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
))
WITH CHECK (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete events of their masjid"
ON events
FOR DELETE
TO authenticated
USING (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
));

-- Step 4: Create secure policies for families table
CREATE POLICY "Users can view families of their masjid"
ON families
FOR SELECT
TO authenticated
USING (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can insert families in their masjid"
ON families
FOR INSERT
TO authenticated
WITH CHECK (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can update families in their masjid"
ON families
FOR UPDATE
TO authenticated
USING (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
))
WITH CHECK (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete families in their masjid"
ON families
FOR DELETE
TO authenticated
USING (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
));

-- Step 5: Create secure policies for members table
CREATE POLICY "Users can view members of their masjid"
ON members
FOR SELECT
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can insert members in their masjid"
ON members
FOR INSERT
TO authenticated
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can update members of their masjid"
ON members
FOR UPDATE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
))
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete members of their masjid"
ON members
FOR DELETE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

-- Step 6: Create secure policies for user_roles table
CREATE POLICY "Users can view user_roles of their masjid"
ON user_roles
FOR SELECT
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can insert user_roles in their masjid"
ON user_roles
FOR INSERT
TO authenticated
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can update user_roles of their masjid"
ON user_roles
FOR UPDATE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
))
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete user_roles of their masjid"
ON user_roles
FOR DELETE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

-- Step 7: Create secure policies for transactions table
CREATE POLICY "Users can view transactions of their masjid"
ON transactions
FOR SELECT
TO authenticated
USING (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can insert transactions in their masjid"
ON transactions
FOR INSERT
TO authenticated
WITH CHECK (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can update transactions in their masjid"
ON transactions
FOR UPDATE
TO authenticated
USING (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
))
WITH CHECK (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete transactions in their masjid"
ON transactions
FOR DELETE
TO authenticated
USING (masjid_id = (
  SELECT masjid_id FROM user_profiles WHERE auth_user_id = auth.uid()
));

-- Step 8: Create secure policies for masjids table
CREATE POLICY "Users can view masjids they have access to"
ON masjids
FOR SELECT
TO authenticated
USING (id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
) OR created_by = auth.uid());

CREATE POLICY "Users can update their own masjids"
ON masjids
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Step 8: Verification
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
ORDER BY tablename, policyname;
