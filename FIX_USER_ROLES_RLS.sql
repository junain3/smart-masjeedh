-- FIX USER_ROLES RLS POLICIES
-- Allow authenticated users to insert and read their own roles

-- Step 1: Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can insert their own user_roles row" ON user_roles;
DROP POLICY IF EXISTS "Users can read their own user_roles row" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can insert their own user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can update their own user_roles" ON user_roles;

-- Step 2: Create proper INSERT policy
CREATE POLICY "Users can insert their own user_roles row"
ON user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id);

-- Step 3: Create proper SELECT policy
CREATE POLICY "Users can read their own user_roles row"
ON user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

-- Step 4: Create UPDATE policy (for future use)
CREATE POLICY "Users can update their own user_roles row"
ON user_roles
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Step 5: Create DELETE policy (for future use)
CREATE POLICY "Users can delete their own user_roles row"
ON user_roles
FOR DELETE
TO authenticated
USING (auth.uid() = auth_user_id);

-- Step 6: Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_roles';

-- Step 7: Test the policy (optional)
-- This should work after the policy is created
-- SELECT * FROM user_roles WHERE auth_user_id = auth.uid();
