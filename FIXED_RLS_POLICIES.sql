-- FIXED RLS POLICIES - No Self-References
-- Simple, direct policies without recursion

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
DROP POLICY IF EXISTS "Users can delete members of their masjid" ON members;

DROP POLICY IF EXISTS "Users can view user_roles of their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can insert user_roles in their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can update user_roles in their masjid" ON user_roles;
DROP POLICY IF EXISTS "Users can delete user_roles in their masjid" ON user_roles;

DROP POLICY IF EXISTS "Users can view masjids they have access to" ON masjids;
DROP POLICY IF EXISTS "Users can update their own masjids" ON masjids;

-- Step 2: Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE masjids ENABLE ROW LEVEL SECURITY;

-- Step 3: Simple user_roles policies - NO SELF-REFERENCES
CREATE POLICY "Users can view their own user_roles"
ON user_roles
FOR SELECT
TO authenticated
USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert their own user_roles"
ON user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update their own user_roles"
ON user_roles
FOR UPDATE
TO authenticated
USING (auth.uid()::TEXT = user_id)
WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can delete their own user_roles"
ON user_roles
FOR DELETE
TO authenticated
USING (auth.uid()::TEXT = user_id);

-- Step 4: Simple masjids policies
CREATE POLICY "Users can view their own masjids"
ON masjids
FOR SELECT
TO authenticated
USING (created_by = auth.uid()::TEXT OR id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

CREATE POLICY "Users can update their own masjids"
ON masjids
FOR UPDATE
TO authenticated
USING (created_by = auth.uid()::TEXT)
WITH CHECK (created_by = auth.uid()::TEXT);

CREATE POLICY "Users can insert their own masjids"
ON masjids
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid()::TEXT);

-- Step 5: Events policies - Direct masjid_id check
CREATE POLICY "Users can view events of their masjid"
ON events
FOR SELECT
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

CREATE POLICY "Users can insert events in their masjid"
ON events
FOR INSERT
TO authenticated
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

CREATE POLICY "Users can update events of their masjid"
ON events
FOR UPDATE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
))
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

CREATE POLICY "Users can delete events of their masjid"
ON events
FOR DELETE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

-- Step 6: Families policies
CREATE POLICY "Users can view families of their masjid"
ON families
FOR SELECT
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

CREATE POLICY "Users can insert families in their masjid"
ON families
FOR INSERT
TO authenticated
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

CREATE POLICY "Users can update families of their masjid"
ON families
FOR UPDATE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
))
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

CREATE POLICY "Users can delete families of their masjid"
ON families
FOR DELETE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

-- Step 7: Members policies
CREATE POLICY "Users can view members of their masjid"
ON members
FOR SELECT
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

CREATE POLICY "Users can insert members in their masjid"
ON members
FOR INSERT
TO authenticated
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

CREATE POLICY "Users can update members of their masjid"
ON members
FOR UPDATE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
))
WITH CHECK (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

CREATE POLICY "Users can delete members of their masjid"
ON members
FOR DELETE
TO authenticated
USING (masjid_id IN (
  SELECT masjid_id FROM user_roles WHERE auth_user_id = auth.uid()::TEXT
));

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
