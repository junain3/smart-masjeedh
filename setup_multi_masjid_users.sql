-- MULTI-MASJID USER SYSTEM SETUP
-- Add OTP verification and masjid segregation

-- Step 1: Add OTP columns to user_roles
ALTER TABLE user_roles 
ADD COLUMN IF NOT EXISTS otp VARCHAR(10),
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- Step 2: Create unique constraint for masjid + email
ALTER TABLE user_roles 
ADD CONSTRAINT unique_masjid_email 
UNIQUE (masjid_id, email);

-- Step 3: Function to check user exists in masjid
CREATE OR REPLACE FUNCTION check_user_in_masjid(p_masjid_id UUID, p_email VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE masjid_id = p_masjid_id 
    AND email = p_email
  );
END;
$$ LANGUAGE plpgsql;

-- Step 4: Function to verify OTP and link auth user
CREATE OR REPLACE FUNCTION verify_user_otp(p_email VARCHAR, p_otp VARCHAR, p_auth_user_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  masjid_id UUID,
  role TEXT,
  permissions JSONB,
  message TEXT
) AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Find user with valid OTP
  SELECT ur.* INTO user_record
  FROM user_roles ur
  WHERE ur.email = p_email
    AND ur.otp = p_otp
    AND ur.otp_expires_at > NOW()
    AND ur.verified = FALSE;
  
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::JSONB, 'Invalid or expired OTP'::TEXT;
    RETURN;
  END IF;
  
  -- Update user as verified and link auth account
  UPDATE user_roles 
  SET verified = TRUE,
      auth_user_id = p_auth_user_id,
      otp = NULL,
      otp_expires_at = NULL
  WHERE id = user_record.id;
  
  -- Return success with user details
  RETURN QUERY
  SELECT TRUE, 
         user_record.masjid_id, 
         user_record.role, 
         user_record.permissions,
         'OTP verified successfully'::TEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Function to get user permissions by auth user
CREATE OR REPLACE FUNCTION get_user_permissions_by_auth(p_auth_user_id UUID)
RETURNS TABLE (
  masjid_id UUID,
  role TEXT,
  permissions JSONB,
  email VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT ur.masjid_id, 
         ur.role, 
         ur.permissions,
         ur.email
  FROM user_roles ur
  WHERE ur.auth_user_id = p_auth_user_id 
    AND ur.verified = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Clean expired OTPs
CREATE OR REPLACE FUNCTION clean_expired_otps()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_roles 
  WHERE otp_expires_at < NOW() 
    AND verified = FALSE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Verify setup
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
  AND column_name IN ('otp', 'otp_expires_at', 'verified', 'auth_user_id')
ORDER BY ordinal_position;
