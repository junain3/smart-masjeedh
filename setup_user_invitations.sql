-- USER INVITATIONS SYSTEM SETUP
-- Create table for email OTP invitations

-- Create user_invitations table
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID REFERENCES masjids(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'co_admin', 'staff')),
  permissions JSONB DEFAULT '{}',
  commission_percent DECIMAL(5,2),
  otp VARCHAR(10) NOT NULL,
  token VARCHAR(100) NOT NULL UNIQUE,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES auth.users(id) -- When user accepts invitation
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_used ON user_invitations(used);

-- Function to validate OTP
CREATE OR REPLACE FUNCTION validate_invitation_otp(p_email VARCHAR, p_otp VARCHAR)
RETURNS TABLE (
  token VARCHAR,
  role TEXT,
  permissions JSONB,
  commission_percent DECIMAL(5,2),
  expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ui.token,
    ui.role,
    ui.permissions,
    ui.commission_percent,
    ui.expires_at
  FROM user_invitations ui
  WHERE ui.email = p_email
    AND ui.otp = p_otp
    AND ui.used = FALSE
    AND ui.expires_at > NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to mark invitation as used
CREATE OR REPLACE FUNCTION mark_invitation_used(p_token VARCHAR, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_invitations 
  SET used = TRUE, 
      used_at = NOW(),
      user_id = p_user_id
  WHERE token = p_token;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Verify setup
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'user_invitations';
