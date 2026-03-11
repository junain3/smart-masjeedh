-- CREATE MEMBERS TABLE IF MISSING
-- Fix missing members table issue

-- Step 1: Create members table if it doesn't exist
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  date_of_birth DATE,
  gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Other')),
  member_type VARCHAR(20) DEFAULT 'Regular' CHECK (member_type IN ('Regular', 'Staff', 'Volunteer')),
  is_active BOOLEAN DEFAULT TRUE,
  join_date DATE DEFAULT CURRENT_DATE,
  subscription_amount DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Enable RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policies
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

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_masjid_id ON members(masjid_id);
CREATE INDEX IF NOT EXISTS idx_members_family_id ON members(family_id);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);

-- Step 5: Verify table creation
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'members' 
ORDER BY ordinal_position;

-- Step 6: Test with sample data (optional)
-- INSERT INTO members (masjid_id, family_id, name, email, phone, address, gender)
-- VALUES ('your-masjid-id', 'your-family-id', 'Test Member', 'test@example.com', '1234567890', 'Test Address', 'Male');

-- Step 7: Show sample data
SELECT * FROM members LIMIT 1;
