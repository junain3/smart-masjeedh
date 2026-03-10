-- Create masjids table if it doesn't exist
CREATE TABLE IF NOT EXISTS masjids (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    tagline TEXT,
    logo_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_masjids_created_by ON masjids(created_by);
CREATE INDEX IF NOT EXISTS idx_masjids_name ON masjids(name);

-- Enable RLS
ALTER TABLE masjids ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own masjids"
    ON masjids FOR SELECT
    USING (
        auth.uid() = created_by
    );

CREATE POLICY "Users can insert their own masjids"
    ON masjids FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
    );

CREATE POLICY "Users can update their own masjids"
    ON masjids FOR UPDATE
    USING (
        auth.uid() = created_by
    );

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_masjids_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
CREATE TRIGGER update_masjids_updated_at 
    BEFORE UPDATE ON masjids 
    FOR EACH ROW 
    EXECUTE FUNCTION update_masjids_updated_at();
