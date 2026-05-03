-- Enhance Families and Members Data Collection
-- Add new columns for detailed family and member information
-- Safe approach: Only ADD new columns, no drops to preserve existing data

-- Step 1: Add new columns to families table (keep existing person-specific fields)
ALTER TABLE families 
ADD COLUMN IF NOT EXISTS house_type VARCHAR(20) CHECK (house_type IN ('own', 'rent')),
ADD COLUMN IF NOT EXISTS has_toilet BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_car BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_three_wheeler BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_van BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_lorry BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_tractor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS extra_notes TEXT;
-- NOTE: special_needs_details, foreign_members_details, health_details REMAIN in families table

-- Step 2: Add new columns to members table (existing + new person-specific fields)
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS education VARCHAR(100),
ADD COLUMN IF NOT EXISTS occupation VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_moulavi BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_new_muslim BOOLEAN DEFAULT FALSE,
-- New person-specific fields moved from family level
ADD COLUMN IF NOT EXISTS is_foreign_resident BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS foreign_country TEXT,
ADD COLUMN IF NOT EXISTS foreign_contact TEXT,
ADD COLUMN IF NOT EXISTS has_special_needs BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS special_needs_details TEXT,
ADD COLUMN IF NOT EXISTS has_health_issue BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS health_details TEXT;

-- Step 3: Verify the columns were added successfully
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('families', 'members')
    AND column_name IN (
        'house_type', 'has_toilet', 'special_needs_details', 'foreign_members_details', 
        'health_details', 'has_car', 'has_three_wheeler', 'has_van', 'has_lorry', 
        'has_tractor', 'extra_notes', 'education', 'occupation', 'is_moulavi', 'is_new_muslim'
    )
ORDER BY table_name, ordinal_position;
