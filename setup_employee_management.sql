-- ENHANCED EMPLOYEE MANAGEMENT SYSTEM
-- Complete staff management with salary and commission tracking

-- Step 1: Create/update employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID REFERENCES masjids(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  designation VARCHAR(100),
  salary_type VARCHAR(20) CHECK (salary_type IN ('monthly', 'weekly', 'daily')),
  salary_amount DECIMAL(10,2) NOT NULL,
  commission_percent DECIMAL(5,2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  hire_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(masjid_id, email)
);

-- Step 2: Create collections table with commission tracking
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID REFERENCES masjids(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  collection_amount DECIMAL(10,2) NOT NULL,
  commission_percent DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) GENERATED ALWAYS AS (collection_amount * commission_percent / 100) STORED,
  collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50) DEFAULT 'cash',
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create salary payments table
CREATE TABLE IF NOT EXISTS salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID REFERENCES masjids(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  salary_amount DECIMAL(10,2) NOT NULL,
  commission_earned DECIMAL(10,2) DEFAULT 0.00,
  total_payment DECIMAL(10,2) GENERATED ALWAYS AS (salary_amount + commission_earned) STORED,
  payment_period_start DATE NOT NULL,
  payment_period_end DATE NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50) DEFAULT 'bank_transfer',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Enhanced indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_masjid_email ON employees(masjid_id, email);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_collections_employee_date ON collections(employee_id, collection_date);
CREATE INDEX IF NOT EXISTS idx_collections_status ON collections(status);
CREATE INDEX IF NOT EXISTS idx_salary_payments_employee_period ON salary_payments(employee_id, payment_period_start);

-- Step 5: Security functions for masjid segregation

-- Function to check if user can access collections for specific masjid
CREATE OR REPLACE FUNCTION can_access_collections(p_user_id UUID, p_masjid_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.auth_user_id = p_user_id
      AND ur.masjid_id = p_masjid_id
      AND ur.verified = TRUE
      AND (ur.permissions->>'subscriptions_collect' = 'true' OR ur.role = 'super_admin')
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get employee collections with commission
CREATE OR REPLACE FUNCTION get_employee_collections(p_employee_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  collection_id UUID,
  collection_amount DECIMAL(10,2),
  commission_percent DECIMAL(5,2),
  commission_amount DECIMAL(10,2),
  collection_date DATE,
  status VARCHAR(20),
  member_name VARCHAR,
  subscription_type VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.collection_amount,
    c.commission_percent,
    c.commission_amount,
    c.collection_date,
    c.status,
    m.full_name,
    s.subscription_type
  FROM collections c
  LEFT JOIN members m ON c.member_id = m.id
  LEFT JOIN subscriptions s ON c.subscription_id = s.id
  WHERE c.employee_id = p_employee_id
    AND c.collection_date BETWEEN p_start_date AND p_end_date
    AND c.status = 'approved'
  ORDER BY c.collection_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate employee commission for period
CREATE OR REPLACE FUNCTION calculate_employee_commission(p_employee_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  total_commission DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(c.commission_amount), 0) INTO total_commission
  FROM collections c
  WHERE c.employee_id = p_employee_id
    AND c.collection_date BETWEEN p_start_date AND p_end_date
    AND c.status = 'approved';
  
  RETURN total_commission;
END;
$$ LANGUAGE plpgsql;

-- Function to validate employee before collection
CREATE OR REPLACE FUNCTION validate_employee_for_collection(p_employee_id UUID)
RETURNS TABLE (
  valid BOOLEAN,
  message TEXT,
  salary_amount DECIMAL(10,2),
  commission_percent DECIMAL(5,2)
) AS $$
DECLARE
  employee_record RECORD;
BEGIN
  -- Get employee details
  SELECT e.* INTO employee_record
  FROM employees e
  WHERE e.id = p_employee_id
    AND e.status = 'active';
  
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT FALSE, 'Employee not found or inactive'::TEXT, NULL::DECIMAL, NULL::DECIMAL;
    RETURN;
  END IF;
  
  -- Validate salary is set
  IF employee_record.salary_amount IS NULL OR employee_record.salary_amount <= 0 THEN
    RETURN QUERY
    SELECT FALSE, 'Employee salary not configured'::TEXT, NULL::DECIMAL, NULL::DECIMAL;
    RETURN;
  END IF;
  
  -- Return success
  RETURN QUERY
  SELECT TRUE, 'Employee validated for collection'::TEXT, 
         employee_record.salary_amount, employee_record.commission_percent;
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Update user_roles with employee linking
ALTER TABLE user_roles 
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS designation VARCHAR(100);

-- Step 7: Trigger to update employee_id when user is verified
CREATE OR REPLACE FUNCTION link_user_to_employee()
RETURNS TRIGGER AS $$
BEGIN
  -- Link user to employee record if exists
  UPDATE user_roles ur
  SET employee_id = e.id
  FROM employees e
  WHERE ur.email = e.email
    AND ur.masjid_id = e.masjid_id
    AND ur.id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_link_user_to_employee ON user_roles;
CREATE TRIGGER trigger_link_user_to_employee
  AFTER UPDATE OF verified ON user_roles
  FOR EACH ROW
  WHEN (NEW.verified = TRUE AND OLD.verified = FALSE)
  EXECUTE FUNCTION link_user_to_employee();

-- Step 8: Verify setup
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name IN ('employees', 'collections', 'salary_payments', 'user_roles')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;
