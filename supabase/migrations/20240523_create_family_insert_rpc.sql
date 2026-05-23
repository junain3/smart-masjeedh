-- Create RPC function for atomic family insertion with auto-generated family_code
-- This prevents race conditions when multiple users add families simultaneously

CREATE OR REPLACE FUNCTION insert_family_with_auto_code(
  p_masjid_id UUID,
  p_head_name TEXT,
  p_address TEXT,
  p_phone TEXT,
  p_subscription_amount NUMERIC DEFAULT 0,
  p_opening_balance NUMERIC DEFAULT 0,
  p_is_widow_head BOOLEAN DEFAULT FALSE,
  p_house_type TEXT DEFAULT NULL,
  p_has_toilet BOOLEAN DEFAULT FALSE,
  p_special_needs_details TEXT DEFAULT NULL,
  p_foreign_members_details TEXT DEFAULT NULL,
  p_health_details TEXT DEFAULT NULL,
  p_has_car BOOLEAN DEFAULT FALSE,
  p_has_three_wheeler BOOLEAN DEFAULT FALSE,
  p_has_van BOOLEAN DEFAULT FALSE,
  p_has_lorry BOOLEAN DEFAULT FALSE,
  p_has_tractor BOOLEAN DEFAULT FALSE,
  p_extra_notes TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  family_code TEXT,
  head_name TEXT,
  address TEXT,
  phone TEXT,
  subscription_amount NUMERIC,
  opening_balance NUMERIC,
  is_widow_head BOOLEAN,
  house_type TEXT,
  has_toilet BOOLEAN,
  special_needs_details TEXT,
  foreign_members_details TEXT,
  health_details TEXT,
  has_car BOOLEAN,
  has_three_wheeler BOOLEAN,
  has_van BOOLEAN,
  has_lorry BOOLEAN,
  has_tractor BOOLEAN,
  extra_notes TEXT,
  user_id UUID,
  masjid_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_code TEXT;
  v_prefix TEXT;
  v_next_num INTEGER;
  v_max_code TEXT;
  v_match TEXT;
BEGIN
  -- Lock families table for this masjid_id to prevent concurrent inserts
  -- This ensures atomicity of the code generation and insert
  PERFORM pg_advisory_xact_lock(hashtext(p_masjid_id::text));
  
  -- Get the maximum family_code for this masjid_id
  SELECT family_code INTO v_max_code
  FROM families
  WHERE masjid_id = p_masjid_id
  ORDER BY family_code DESC
  LIMIT 1;
  
  -- Generate next code
  IF v_max_code IS NULL THEN
    -- No families yet, start with M1
    v_next_code := 'M1';
  ELSE
    -- Extract prefix and number from existing code
    -- Supports formats like M35, M-35, FM-01, etc.
    v_match := regexp_matches(v_max_code, '^([A-Za-z\s-]*)(\d+)$');
    
    IF v_match IS NOT NULL THEN
      v_prefix := v_match[1];
      v_next_num := (v_match[2])::INTEGER + 1;
      
      -- Pad with zeros to maintain format (e.g., M01 -> M02)
      IF LENGTH(v_match[2]) > 1 THEN
        v_next_code := v_prefix || LPAD(v_next_num::TEXT, LENGTH(v_match[2]), '0');
      ELSE
        v_next_code := v_prefix || v_next_num::TEXT;
      END IF;
    ELSE
      -- Fallback: if format is unexpected, start with M1
      v_next_code := 'M1';
    END IF;
  END IF;
  
  -- Insert the family with the generated code
  INSERT INTO families (
    family_code,
    head_name,
    address,
    phone,
    subscription_amount,
    opening_balance,
    is_widow_head,
    house_type,
    has_toilet,
    special_needs_details,
    foreign_members_details,
    health_details,
    has_car,
    has_three_wheeler,
    has_van,
    has_lorry,
    has_tractor,
    extra_notes,
    user_id,
    masjid_id
  ) VALUES (
    v_next_code,
    p_head_name,
    p_address,
    p_phone,
    p_subscription_amount,
    p_opening_balance,
    p_is_widow_head,
    p_house_type,
    p_has_toilet,
    p_special_needs_details,
    p_foreign_members_details,
    p_health_details,
    p_has_car,
    p_has_three_wheeler,
    p_has_van,
    p_has_lorry,
    p_has_tractor,
    p_extra_notes,
    p_user_id,
    p_masjid_id
  )
  RETURNING 
    id, family_code, head_name, address, phone, 
    subscription_amount, opening_balance, is_widow_head,
    house_type, has_toilet, special_needs_details,
    foreign_members_details, health_details, has_car,
    has_three_wheeler, has_van, has_lorry, has_tractor,
    extra_notes, user_id, masjid_id, created_at;
    
  RETURN QUERY SELECT 
    id, family_code, head_name, address, phone, 
    subscription_amount, opening_balance, is_widow_head,
    house_type, has_toilet, special_needs_details,
    foreign_members_details, health_details, has_car,
    has_three_wheeler, has_van, has_lorry, has_tractor,
    extra_notes, user_id, masjid_id, created_at
  FROM families
  WHERE id = (
    SELECT id FROM families
    WHERE family_code = v_next_code AND masjid_id = p_masjid_id
    LIMIT 1
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION insert_family_with_auto_code TO authenticated;
GRANT EXECUTE ON FUNCTION insert_family_with_auto_code TO anon;
