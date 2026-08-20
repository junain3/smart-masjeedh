-- Fix insert_family_with_auto_code RPC to use TRUE mathematical numeric max
-- instead of string-based ORDER BY (which ranks M100 > M733 lexicographically)
-- Maintains strict multi-tenant isolation by p_masjid_id

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
  v_match TEXT[];
  v_family_id UUID;
  -- Variables for true numeric max scan
  v_current_code TEXT;
  v_current_parts TEXT[];
  v_current_num INTEGER;
  v_max_num INTEGER := 0;
  v_best_prefix TEXT := 'M';
  v_best_pad INTEGER := 1;
  v_has_parseable BOOLEAN := FALSE;
  v_codes_cursor CURSOR FOR
    SELECT family_code
    FROM families
    WHERE masjid_id = p_masjid_id;
BEGIN
  -- Lock families table for this masjid_id to prevent concurrent inserts
  -- This ensures atomicity of the code generation and insert
  PERFORM pg_advisory_xact_lock(hashtext(p_masjid_id::text));

  -- ---------------------------------------------------------------------
  -- Step 1: Scan ALL family codes for this masjid to find TRUE numeric max
  --         (Defeats string-sort issue like M100 > M733)
  -- ---------------------------------------------------------------------
  OPEN v_codes_cursor;
  LOOP
    FETCH v_codes_cursor INTO v_current_code;
    EXIT WHEN NOT FOUND;

    IF v_current_code IS NULL THEN
      CONTINUE;
    END IF;

    v_current_parts := regexp_matches(v_current_code, '^([A-Za-z\s-]*)(\d+)$');
    IF v_current_parts IS NOT NULL AND array_length(v_current_parts, 1) >= 2 THEN
      BEGIN
        v_current_num := (v_current_parts[2])::INTEGER;

        IF NOT v_has_parseable OR v_current_num > v_max_num THEN
          v_has_parseable := TRUE;
          v_max_num := v_current_num;
          v_best_prefix  := v_current_parts[1];
          v_best_pad     := LENGTH(v_current_parts[2]);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Skip un-castable numbers
        NULL;
      END;
    END IF;
  END LOOP;
  CLOSE v_codes_cursor;

  -- ---------------------------------------------------------------------
  -- Step 2: Generate next sequential family_code
  -- ---------------------------------------------------------------------
  IF NOT v_has_parseable THEN
    -- No parseable numeric families yet, start with M1
    v_next_code := 'M1';
  ELSE
    v_next_num := v_max_num + 1;

    IF v_best_pad > 1 THEN
      v_next_code := v_best_prefix || LPAD(v_next_num::TEXT, v_best_pad, '0');
    ELSE
      v_next_code := v_best_prefix || v_next_num::TEXT;
    END IF;
  END IF;

  -- ---------------------------------------------------------------------
  -- Step 3: Insert the family with the generated code
  -- ---------------------------------------------------------------------
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
  RETURNING id INTO v_family_id;

  -- ---------------------------------------------------------------------
  -- Step 4: Auto-create Family Head member
  -- ---------------------------------------------------------------------
  DELETE FROM members
  WHERE family_id = v_family_id
  AND (relationship = 'Head' OR relationship = 'Family Head');

  INSERT INTO members (
    family_id,
    name,
    full_name,
    relationship,
    civil_status,
    user_id,
    masjid_id
  ) VALUES (
    v_family_id,
    p_head_name,
    p_head_name,
    'Family Head',
    '',
    p_user_id,
    p_masjid_id
  );

  RETURN QUERY SELECT
    id, family_code, head_name, address, phone,
    subscription_amount, opening_balance, is_widow_head,
    house_type, has_toilet, special_needs_details,
    foreign_members_details, health_details, has_car,
    has_three_wheeler, has_van, has_lorry, has_tractor,
    extra_notes, user_id, masjid_id, created_at
  FROM families
  WHERE id = v_family_id;
END;
$$;

-- Re-grant permissions explicitly
GRANT EXECUTE ON FUNCTION insert_family_with_auto_code TO authenticated;
GRANT EXECUTE ON FUNCTION insert_family_with_auto_code TO anon;
