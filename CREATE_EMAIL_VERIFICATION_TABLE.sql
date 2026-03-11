-- CREATE EMAIL VERIFICATION TABLE
-- For OTP-based email verification system

-- Step 1: Create email_verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  temp_password VARCHAR(255) DEFAULT 'verified',
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  
  -- Constraints
  CONSTRAINT email_verifications_email_code_key UNIQUE (email, code, used)
);

-- Step 2: Enable RLS
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policies
CREATE POLICY "Users can insert their own email verification"
ON email_verifications
FOR INSERT
TO authenticated
WITH CHECK (email = auth.email());

CREATE POLICY "Users can view their own email verification"
ON email_verifications
FOR SELECT
TO authenticated
USING (email = auth.email());

CREATE POLICY "Users can update their own email verification"
ON email_verifications
FOR UPDATE
TO authenticated
USING (email = auth.email())
WITH CHECK (email = auth.email());

-- Step 4: Create index for performance
CREATE INDEX IF NOT EXISTS idx_email_verifications_email_code ON email_verifications(email, code, used);

-- Step 5: Clean up expired codes (optional function)
CREATE OR REPLACE FUNCTION cleanup_expired_verifications()
RETURNS VOID AS $$
BEGIN
  DELETE FROM email_verifications 
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Test the table
SELECT * FROM email_verifications LIMIT 1;
