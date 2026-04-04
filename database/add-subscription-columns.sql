-- =====================================================
-- ADD SUBSCRIPTION COLUMNS TO MASJIDS TABLE
-- =====================================================
-- This script adds missing subscription tracking columns
-- and creates the subscription_history table if needed
-- =====================================================

-- =====================================================
-- 1. ADD SUBSCRIPTION COLUMNS TO MASJIDS TABLE
-- =====================================================

-- Add subscription_status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'masjids' 
        AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE masjids ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'trial';
        RAISE NOTICE 'Added subscription_status column to masjids table';
    ELSE
        RAISE NOTICE 'subscription_status column already exists in masjids table';
    END IF;
END $$;

-- Add subscription_end_date column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'masjids' 
        AND column_name = 'subscription_end_date'
    ) THEN
        ALTER TABLE masjids ADD COLUMN subscription_end_date TIMESTAMP NULL;
        RAISE NOTICE 'Added subscription_end_date column to masjids table';
    ELSE
        RAISE NOTICE 'subscription_end_date column already exists in masjids table';
    END IF;
END $$;

-- Add is_active column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'masjids' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE masjids ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added is_active column to masjids table';
    ELSE
        RAISE NOTICE 'is_active column already exists in masjids table';
    END IF;
END $$;

-- Add trial_extended column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'masjids' 
        AND column_name = 'trial_extended'
    ) THEN
        ALTER TABLE masjids ADD COLUMN trial_extended BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added trial_extended column to masjids table';
    ELSE
        RAISE NOTICE 'trial_extended column already exists in masjids table';
    END IF;
END $$;

-- =====================================================
-- 2. CREATE SUBSCRIPTION_HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID REFERENCES masjids(id) ON DELETE CASCADE,
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  payment_amount DECIMAL(10,2),
  payment_method VARCHAR(50),
  payment_date TIMESTAMP,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 3. CREATE TRIAL_EXTENSIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS trial_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID REFERENCES masjids(id) ON DELETE CASCADE,
  days_extended INTEGER DEFAULT 30,
  reason TEXT,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_masjids_subscription_status ON masjids(subscription_status);
CREATE INDEX IF NOT EXISTS idx_masjids_subscription_end_date ON masjids(subscription_end_date);
CREATE INDEX IF NOT EXISTS idx_masjids_is_active ON masjids(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_history_masjid_id ON subscription_history(masjid_id);
CREATE INDEX IF NOT EXISTS idx_trial_extensions_masjid_id ON trial_extensions(masjid_id);

-- =====================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_extensions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. CREATE RLS POLICIES
-- =====================================================

-- Policy for subscription_history
DROP POLICY IF EXISTS "Users can view their own subscription history" ON subscription_history;
CREATE POLICY "Users can view their own subscription history" ON subscription_history
FOR SELECT USING (
  masjid_id IN (
    SELECT masjid_id FROM user_roles 
    WHERE user_id = auth.uid()
  )
);

-- Policy for trial_extensions
DROP POLICY IF EXISTS "Users can view their own trial extensions" ON trial_extensions;
CREATE POLICY "Users can view their own trial extensions" ON trial_extensions
FOR SELECT USING (
  masjid_id IN (
    SELECT masjid_id FROM user_roles 
    WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- 7. UPDATE EXISTING MASJIDS WITH DEFAULT VALUES
-- =====================================================

-- Set default values for any existing masjids
UPDATE masjids 
SET 
    subscription_status = 'trial',
    is_active = TRUE 
WHERE subscription_status IS NULL;

-- =====================================================
-- 8. VERIFICATION
-- =====================================================

-- Show masjids table structure
SELECT 
    table_name,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'masjids'
    AND column_name IN ('subscription_status', 'subscription_end_date', 'is_active', 'trial_extended')
ORDER BY ordinal_position;

-- Show subscription_history table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'subscription_history'
ORDER BY ordinal_position;

-- =====================================================
-- 9. CONFIRMATION MESSAGE
-- =====================================================

SELECT 'SUBSCRIPTION SYSTEM SETUP COMPLETED' as status,
       'All subscription columns and tables created' as details,
       NOW() as setup_timestamp;
