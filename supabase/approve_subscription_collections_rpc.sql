-- RPC function for atomic approval of subscription collections
-- Creates one batch transaction, calculates commissions, and updates all collections atomically

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
    
    -- Step 4: Create ONE batch transaction (family_id must be null for batch)
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
        format('Subscription Collections Batch - %s families', array_length(p_collection_ids, 1)),
        'income',
        'subscription',
        NOW()
    ) RETURNING id INTO v_main_transaction_id;
    
    -- Step 5: Check for existing employee commissions to prevent duplicates
    SELECT array_agg(collection_id) INTO v_existing_commission_ids
    FROM public.employee_commissions
    WHERE collection_id = ANY(p_collection_ids);
    
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
        'failures', v_failures
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
