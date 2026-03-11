-- SECURE RLS POLICIES - Fix Security Issues
-- Enable proper RLS and create secure policies

-- Step 1: Enable RLS on all tables
ALTER TABLE masjids ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies (start fresh)
DROP POLICY IF EXISTS "Users can view their own masjids" ON masjids;
DROP POLICY IF EXISTS "Users can insert their own masjids" ON masjids;
DROP POLICY IF EXISTS "Users can update their own masjids" ON masjids;
DROP POLICY IF EXISTS "Users can delete their own masjids" ON masjids;

DROP POLICY IF EXISTS "Users can insert their own user_roles row" ON user_roles;
DROP POLICY IF EXISTS "Users can read their own user_roles row" ON user_roles;
DROP POLICY IF EXISTS "Users can update their own user_roles row" ON user_roles;
DROP POLICY IF EXISTS "Users can delete their own user_roles row" ON user_roles;

DROP POLICY IF EXISTS "Users can view all members" ON members;
DROP POLICY IF EXISTS "Users can insert members" ON members;
DROP POLICY IF EXISTS "Users can update members" ON members;
DROP POLICY IF EXISTS "Users can delete members" ON members;

DROP POLICY IF EXISTS "Users can view all families" ON families;
DROP POLICY IF EXISTS "Users can insert families" ON families;
DROP POLICY IF EXISTS "Users can update families" ON families;
DROP POLICY IF EXISTS "Users can delete families" ON families;

DROP POLICY IF EXISTS "Users can view invitations" ON invitations;
DROP POLICY IF EXISTS "Users can insert invitations" ON invitations;
DROP POLICY IF EXISTS "Users can update invitations" ON invitations;
DROP POLICY IF EXISTS "Users can delete invitations" ON invitations;

DROP POLICY IF EXISTS "Users can view transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete transactions" ON transactions;

-- Step 3: Create secure MASJIDS policies
CREATE POLICY "Users can view their own masjids"
ON masjids
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Users can insert their own masjids"
ON masjids
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own masjids"
ON masjids
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own masjids"
ON masjids
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Step 4: Create secure USER_ROLES policies
CREATE POLICY "Users can view their own user_roles"
ON user_roles
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own user_roles"
ON user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own user_roles"
ON user_roles
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can delete their own user_roles"
ON user_roles
FOR DELETE
TO authenticated
USING (auth_user_id = auth.uid());

-- Step 5: Create secure MEMBERS policies (masjid-based access)
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

CREATE POLICY "Users can update members in their masjid"
ON members
FOR UPDATE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
))
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete members in their masjid"
ON members
FOR DELETE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

-- Step 6: Create secure FAMILIES policies (masjid-based access)
CREATE POLICY "Users can view families of their masjid"
ON families
FOR SELECT
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can insert families in their masjid"
ON families
FOR INSERT
TO authenticated
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can update families in their masjid"
ON families
FOR UPDATE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
))
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete families in their masjid"
ON families
FOR DELETE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

-- Step 7: Create secure INVITATIONS policies (masjid-based access)
CREATE POLICY "Users can view invitations of their masjid"
ON invitations
FOR SELECT
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can insert invitations in their masjid"
ON invitations
FOR INSERT
TO authenticated
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can update invitations in their masjid"
ON invitations
FOR UPDATE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
))
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete invitations in their masjid"
ON invitations
FOR DELETE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

-- Step 8: Create secure TRANSACTIONS policies (masjid-based access)
CREATE POLICY "Users can view transactions of their masjid"
ON transactions
FOR SELECT
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can insert transactions in their masjid"
ON transactions
FOR INSERT
TO authenticated
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can update transactions in their masjid"
ON transactions
FOR UPDATE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
))
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can delete transactions in their masjid"
ON transactions
FOR DELETE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()
));

-- Step 9: Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('masjids', 'user_roles', 'members', 'families', 'invitations', 'transactions')
ORDER BY tablename, cmd;

-- Step 10: Verify no anon/public access
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies 
WHERE tablename IN ('masjids', 'user_roles', 'members', 'families', 'invitations', 'transactions')
AND (roles = 'anon'::name OR roles = 'public'::name OR roles = '{anon,authenticated}'::name[]);
