-- Create invitations table for masjid invitation system
CREATE TABLE IF NOT EXISTS invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    masjid_id UUID NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('staff', 'co_admin')),
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- Add RLS policies
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see invitations for their own masjid
CREATE POLICY "Users can view invitations for their masjid"
    ON invitations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.masjid_id = invitations.masjid_id 
            AND user_roles.auth_user_id = auth.uid()
        )
    );

-- Policy: Super admins can create invitations for their masjid
CREATE POLICY "Super admins can create invitations"
    ON invitations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.masjid_id = invitations.masjid_id 
            AND user_roles.auth_user_id = auth.uid()
            AND user_roles.role = 'super_admin'
        )
    );

-- Policy: Users can update invitation status (for accepting)
CREATE POLICY "Users can update invitation status"
    ON invitations FOR UPDATE
    USING (
        invitations.email = auth.email()
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_invitations_updated_at 
    BEFORE UPDATE ON invitations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
