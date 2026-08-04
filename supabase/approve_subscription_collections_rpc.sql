-- RPC function for atomic approval of subscription collections
-- Creates one batch transaction, calculates commissions, and updates all collections atomically
-- Handles both collector and admin_direct collection sources

CREATE OR REPLACE FUNCTION public.approve_subscription_collections(
    p_collection_ids TEXT[],
    p_user_id UUID,
    p_masjid_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_main_transaction_id UUID;
    v_total_amount DECIMAL;
    v_collection RECORD;
    v_collector_profile RECORD;
    v_commission_amount DECIMAL;
    v_success_count INTEGER := 0;
    v_failure_count INTEGER := 0;
    v_failures TEXT[] := ARRAY[]::TEXT[];
    v_result JSON;
    v_current_collection_ids TEXT[];
    v_unique_collector_ids UUID[];
    v_existing_commission_ids UUID[];
    v_existing_staff_commission_user_ids UUID[];
    v_collection_sources TEXT[];
    v_admin_direct_count INTEGER := 0;
    v_collector_count INTEGER := 0;
BEGIN
    -- Validate input parameters
    IF p_collection_ids IS NULL OR array_length(p_collection_ids, 1) = 0 THEN
        RETURN json_build_object('success', false, 'error', 'No collection IDs provided');
    END IF;
    
    -- Step 1: Validate all collections exist and are still pending
    SELECT array_agg(id) INTO v_current_collection_ids
    FROM public.subscription_collections
    WHERE id = ANY(p_collection_ids)
      AND masjid_id = p_masjid_id
      AND status = 'pending';
    
    IF array_length(v_current_collection_ids, 1) != array_length(p_collection_ids, 1) THEN
        RETURN json_build_object('success', false, 'error', 'Some collections are no longer pending or do not exist');
    END IF;
    
    -- Step 2: Calculate total amount
    SELECT COALESCE(SUM(amount), 0) INTO v_total_amount
    FROM public.subscription_collections
    WHERE id = ANY(p_collection_ids);
    
    -- Step 3: Get unique collector IDs for profile fetching
    SELECT array_agg(DISTINCT collected_by_user_id) INTO v_unique_collector_ids
    FROM public.subscription_collections
    WHERE id = ANY(p_collection_ids);
    
    -- Step 3.1: Get collection sources for description
    SELECT array_agg(DISTINCT collection_source) INTO v_collection_sources
    FROM public.subscription_collections
    WHERE id = ANY(p_collection_ids);
    
    -- Step 3.2: Count admin_direct vs collector collections
    SELECT COUNT(*) INTO v_admin_direct_count
    FROM public.subscription_collections
    WHERE id = ANY(p_collection_ids) AND collection_source = 'admin_direct';
    
    SELECT COUNT(*) INTO v_collector_count
    FROM public.subscription_collections
    WHERE id = ANY(p_collection_ids) AND collection_source = 'collector';
    
    -- Step 4: Create ONE batch transaction (family_id must be null for batch)
    -- Description includes breakdown of collection sources
    INSERT INTO public.transactions (
        masjid_id,
        user_id,
        family_id,  -- NULL for batch transactions
        amount,
        description,
        type,
        category,
        date
    ) VALUES (
        p_masjid_id,
        p_user_id,
        NULL,
        v_total_amount,
        format('சந்தா வசூல் — %s குடும்பங்கள் (நிர்வாகி: %s, சேகரிப்பாளர்: %s)', 
                array_length(p_collection_ids, 1),
                v_admin_direct_count,
                v_collector_count),
        'income',
        'subscription',
        NOW()
    ) RETURNING id INTO v_main_transaction_id;
    
    -- Step 5: Check for existing employee commissions to prevent duplicates
    SELECT array_agg(collection_id) INTO v_existing_commission_ids
    FROM public.employee_commissions
    WHERE collection_id = ANY(p_collection_ids);
    
    -- Step 5.1: Check for existing staff commissions to prevent duplicates
    SELECT array_agg(DISTINCT collector_user_id) INTO v_existing_staff_commission_user_ids
    FROM public.staff_commissions
    WHERE collector_user_id IN (
        SELECT collected_by_user_id FROM public.subscription_collections
        WHERE id = ANY(p_collection_ids)
    )
    AND created_at >= NOW() - INTERVAL '1 hour';
    
    -- Step 6: Process each collection
    FOR v_collection IN 
        SELECT sc.*, f.family_code
        FROM public.subscription_collections sc
        JOIN public.families f ON sc.family_id = f.id
        WHERE sc.id = ANY(p_collection_ids)
        ORDER BY sc.created_at
    LOOP
        BEGIN
            -- Skip if commission already exists
            IF v_collection.id = ANY(v_existing_commission_ids) THEN
                v_failures := array_append(v_failures, format('Collection %s already has commission record', v_collection.id));
                v_failure_count := v_failure_count + 1;
                CONTINUE;
            END IF;
            
            -- Skip if staff commission already exists for this collector recently
            IF v_collection.collected_by_user_id = ANY(v_existing_staff_commission_user_ids) THEN
                v_failures := array_append(v_failures, format('Staff commission already exists for collector %s', v_collection.collected_by_user_id));
                v_failure_count := v_failure_count + 1;
                CONTINUE;
            END IF;
            
            -- Step 6a: Get collector profile for commission rate
            SELECT default_commission_percent INTO v_collector_profile
            FROM public.subscription_collector_profiles
            WHERE user_id = v_collection.collected_by_user_id
              AND masjid_id = p_masjid_id;
            
            -- Step 6b: Calculate commission (fallback to 0% if no profile)
            v_commission_amount := COALESCE(v_collector_profile.default_commission_percent, 0) * v_collection.amount / 100;
            
            -- Step 6c: Create employee commission record
            INSERT INTO public.employee_commissions (
                masjid_id,
                employee_id,
                collection_id,
                amount,
                created_at
            ) VALUES (
                p_masjid_id,
                v_collection.collected_by_user_id,
                v_collection.id,
                v_commission_amount,
                NOW()
            );
            
            -- Step 6c.1: Create staff commission record for admin dashboard
            INSERT INTO public.staff_commissions (
                masjid_id,
                collector_user_id,
                amount,
                status,
                created_at
            ) VALUES (
                p_masjid_id,
                v_collection.collected_by_user_id,
                v_commission_amount,
                'pending',
                NOW()
            );
            
            -- Step 6d: Update collection with all required fields
            UPDATE public.subscription_collections
            SET 
                status = 'accepted',
                commission_percent = COALESCE(v_collector_profile.default_commission_percent, 0),
                commission_amount = v_commission_amount,
                main_transaction_id = v_main_transaction_id,
                accepted_by_user_id = p_user_id,
                accepted_at = NOW()
            WHERE id = v_collection.id;
            
            v_success_count := v_success_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            v_failures := array_append(v_failures, format('Collection %s failed: %s', v_collection.id, SQLERRM));
            v_failure_count := v_failure_count + 1;
        END;
    END LOOP;
    
    -- Step 7: Build result
    v_result := json_build_object(
        'success', v_failure_count = 0,
        'main_transaction_id', v_main_transaction_id,
        'total_amount', v_total_amount,
        'success_count', v_success_count,
        'failure_count', v_failure_count,
        'failures', v_failures,
        'admin_direct_count', v_admin_direct_count,
        'collector_count', v_collector_count
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    -- Rollback everything on any error
    RETURN json_build_object(
        'success', false, 
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$;
