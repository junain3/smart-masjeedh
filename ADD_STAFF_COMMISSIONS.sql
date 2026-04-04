-- Add basic_salary column to staff table (if it doesn't exist)
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS basic_salary DECIMAL(10,2) DEFAULT 0.00;

-- Create staff_commissions table for pending commissions
CREATE TABLE IF NOT EXISTS staff_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
  staff_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES subscription_collections(id) ON DELETE CASCADE,
  commission_amount DECIMAL(10,2) NOT NULL,
  commission_percent DECIMAL(5,2) NOT NULL,
  collection_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by_user_id UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_commissions_masjid_id ON staff_commissions(masjid_id);
CREATE INDEX IF NOT EXISTS idx_staff_commissions_staff_user_id ON staff_commissions(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_commissions_status ON staff_commissions(status);
CREATE INDEX IF NOT EXISTS idx_staff_commissions_collection_id ON staff_commissions(collection_id);

-- Enable RLS on staff_commissions
ALTER TABLE staff_commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_commissions
DROP POLICY IF EXISTS "Users can view own staff_commissions" ON staff_commissions;
DROP POLICY IF EXISTS "Admins can manage staff_commissions" ON staff_commissions;

CREATE POLICY "Users can view own staff_commissions" ON staff_commissions
  FOR SELECT USING (
    auth.uid() = staff_user_id AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.masjid_id = staff_commissions.masjid_id
    )
  );

CREATE POLICY "Admins can manage staff_commissions" ON staff_commissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.masjid_id = staff_commissions.masjid_id
      AND user_roles.role IN ('super_admin', 'co_admin')
    )
  );

-- Create function to automatically create staff commissions on collection
CREATE OR REPLACE FUNCTION create_staff_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create commission if collection has a staff member
  -- This assumes we have a way to track which staff member collected
  -- For now, we'll skip auto-creation and handle it in the application logic
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create commission (optional - can be handled in app)
-- DROP TRIGGER IF EXISTS on_collection_create_commission ON subscription_collections;
-- CREATE TRIGGER on_collection_create_commission
--   AFTER INSERT ON subscription_collections
--   FOR EACH ROW EXECUTE FUNCTION create_staff_commission();
